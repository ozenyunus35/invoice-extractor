import { cents, near } from "./numbers";
import type { Check, Invoice } from "./types";

const money = (n: number) => n.toFixed(2);

/**
 * Arithmetic checks a bookkeeper would do before posting an invoice. A check is
 * skipped, not passed, when the numbers it needs are missing or were derived
 * from the very values it would compare.
 */
export function validateInvoice(inv: Invoice): Check[] {
  const checks: Check[] = [];
  const vatSum = cents(inv.vat.reduce((s, v) => s + v.amount, 0));
  const itemsSum = cents(inv.items.reduce((s, i) => s + i.amount, 0));
  const sub = inv.subtotal.value;
  const total = inv.total.value;

  const missing = [!inv.vendor.value && "vendor", !inv.date.value && "date", total === null && "total"].filter(Boolean);
  checks.push({
    id: "required",
    status: missing.length ? "fail" : "pass",
    label: "Required fields",
    detail: missing.length ? `Missing: ${missing.join(", ")}` : "Vendor, date and total found",
  });

  if (!inv.items.length) {
    checks.push({ id: "items-sum", status: "skip", label: "Line items add up", detail: "No line items found" });
  } else if (sub !== null && !inv.subtotal.derived && near(itemsSum, sub, 0.02)) {
    checks.push({ id: "items-sum", status: "pass", label: "Line items add up", detail: `${money(itemsSum)} = subtotal ${money(sub)}` });
  } else if (total !== null && near(itemsSum, total, 0.02)) {
    checks.push({ id: "items-sum", status: "pass", label: "Line items add up", detail: `${money(itemsSum)} = total ${money(total)} (prices include VAT)` });
  } else {
    const target = sub ?? total;
    checks.push({
      id: "items-sum",
      status: target === null ? "skip" : "fail",
      label: "Line items add up",
      detail: target === null ? "No subtotal or total to compare" : `Items sum to ${money(itemsSum)}, document says ${money(target)} (off by ${money(Math.abs(itemsSum - target))})`,
    });
  }

  if (sub === null || total === null || inv.subtotal.derived || inv.total.derived) {
    checks.push({ id: "subtotal-vat-total", status: "skip", label: "Subtotal + VAT = total", detail: "Needs a printed subtotal and total" });
  } else {
    const expected = cents(sub + vatSum);
    checks.push({
      id: "subtotal-vat-total",
      status: near(expected, total, 0.02) ? "pass" : "fail",
      label: "Subtotal + VAT = total",
      detail: near(expected, total, 0.02)
        ? `${money(sub)} + ${money(vatSum)} = ${money(total)}`
        : `${money(sub)} + ${money(vatSum)} = ${money(expected)}, document says ${money(total)}`,
    });
  }

  const rated = inv.vat.filter((v) => v.rate !== null && v.line !== null && !v.rateDerived);
  const inferred = inv.vat.find((v) => v.rateDerived);
  if (!rated.length) {
    checks.push({
      id: "vat-rate",
      status: "skip",
      label: "VAT matches its rate",
      detail: inferred ? `Rate not readable; the amounts imply ${inferred.rate}%` : "No VAT rate printed",
    });
  } else {
    const wrong: string[] = [];
    const ok: string[] = [];
    for (const v of rated) {
      // Without a printed base, a single VAT line applies to the subtotal, or to the VAT-inclusive total.
      const base = v.base ?? (rated.length === 1 ? (sub ?? (total !== null ? total - v.amount : null)) : null);
      if (base === null) continue;
      const expected = cents((base * v.rate!) / 100);
      (near(expected, v.amount, 0.02) ? ok : wrong).push(`${v.rate}% of ${money(base)} = ${money(expected)}${near(expected, v.amount, 0.02) ? "" : `, document says ${money(v.amount)}`}`);
    }
    checks.push({
      id: "vat-rate",
      status: wrong.length ? "fail" : ok.length ? "pass" : "skip",
      label: "VAT matches its rate",
      detail: (wrong.length ? wrong : ok).join("; ") || "No base amount to check against",
    });
  }

  const bad = inv.items.filter((i) => !near(cents(i.quantity * i.unitPrice), i.amount, Math.max(0.02, i.amount * 0.002)));
  checks.push({
    id: "line-math",
    status: !inv.items.length ? "skip" : bad.length ? "fail" : "pass",
    label: "Quantity × price per line",
    detail: !inv.items.length
      ? "No line items found"
      : bad.length
        ? bad.map((i) => `"${i.description}": ${i.quantity} × ${money(i.unitPrice)} ≠ ${money(i.amount)}`).join("; ")
        : `All ${inv.items.length} lines check out`,
  });

  return checks;
}
