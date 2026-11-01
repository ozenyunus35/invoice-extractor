import type { Doc } from "./documents";
import { fold } from "./extract";
import { cents, near } from "./numbers";
import type { Transaction } from "./statement";

/*
 * Cross-document checks: duplicates, due dates, and matching invoices to the
 * bank statement lines that paid them.
 */

const isBill = (d: Doc) => d.type === "invoice" || d.type === "receipt";
const norm = (s: string | null) => (s ? fold(s).replace(/[^a-z0-9]/g, "") : "");

/** For each document, another document that looks like the same invoice. */
export function findDuplicates(docs: Doc[]): Map<string, Doc> {
  const out = new Map<string, Doc>();
  const bills = docs.filter(isBill);
  for (const a of bills) {
    for (const b of bills) {
      if (a === b || out.has(a.id)) continue;
      const [ia, ib] = [a.invoice, b.invoice];
      const sameNumber = ia.invoiceNumber.value && norm(ia.invoiceNumber.value) === norm(ib.invoiceNumber.value) && norm(ia.vendor.value) === norm(ib.vendor.value);
      const sameAmountDay = ia.total.value !== null && ia.total.value === ib.total.value && ia.date.value && ia.date.value === ib.date.value && norm(ia.vendor.value) === norm(ib.vendor.value);
      if (sameNumber || sameAmountDay) out.set(a.id, b);
    }
  }
  return out;
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Days between two ISO dates, b − a. */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export type Payment = { doc: Doc; tx: Transaction };

/**
 * Finds the statement line that paid an invoice: same amount going out, and the
 * vendor's name or the invoice number in the description.
 */
export function findPayment(bill: Doc, docs: Doc[]): Payment | null {
  const inv = bill.invoice;
  if (inv.total.value === null) return null;
  const vendorWords = fold(inv.vendor.value ?? "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !["corp", "gmbh", "limited", "studio"].includes(w));
  const number = norm(inv.invoiceNumber.value);
  for (const doc of docs) {
    if (doc.type !== "statement") continue;
    for (const tx of doc.statement.transactions) {
      if (tx.amount >= 0 || !near(-tx.amount, inv.total.value, 0.011)) continue;
      const desc = fold(tx.description);
      if ((number.length >= 4 && norm(tx.description).includes(number)) || vendorWords.some((w) => desc.includes(w))) return { doc, tx };
    }
  }
  return null;
}

export type PayStatus = { kind: "paid"; payment: Payment } | { kind: "overdue"; days: number } | { kind: "due"; days: number } | { kind: "none" };

export function payStatus(bill: Doc, docs: Doc[], today = todayIso()): PayStatus {
  if (!isBill(bill)) return { kind: "none" };
  const payment = findPayment(bill, docs);
  if (payment) return { kind: "paid", payment };
  const due = bill.invoice.dueDate.value;
  if (!due || bill.type === "receipt") return { kind: "none" };
  const days = daysBetween(today, due);
  return days < 0 ? { kind: "overdue", days: -days } : { kind: "due", days };
}

export type Overview = {
  bills: Doc[];
  statements: Doc[];
  attention: number;
  byCurrency: { currency: string; total: number; vat: number; count: number }[];
  vatByRate: { currency: string; rate: number | null; base: number; vat: number }[];
  byVendor: { vendor: string; currency: string; total: number; count: number }[];
};

export function overview(docs: Doc[], failing: (d: Doc) => boolean): Overview {
  const bills = docs.filter(isBill);
  const cur = (d: Doc) => d.invoice.currency.value ?? "—";
  const byCurrency = new Map<string, { currency: string; total: number; vat: number; count: number }>();
  const vat = new Map<string, { currency: string; rate: number | null; base: number; vat: number }>();
  const vendors = new Map<string, { vendor: string; currency: string; total: number; count: number }>();
  for (const d of bills) {
    const c = cur(d);
    const total = d.invoice.total.value ?? 0;
    const vatSum = d.invoice.vat.reduce((s, v) => s + v.amount, 0);
    const row = byCurrency.get(c) ?? { currency: c, total: 0, vat: 0, count: 0 };
    byCurrency.set(c, { ...row, total: cents(row.total + total), vat: cents(row.vat + vatSum), count: row.count + 1 });
    for (const v of d.invoice.vat) {
      const key = `${c}|${v.rate}`;
      const r = vat.get(key) ?? { currency: c, rate: v.rate, base: 0, vat: 0 };
      const base = v.base ?? (d.invoice.vat.length === 1 ? (d.invoice.subtotal.value ?? cents(total - v.amount)) : 0);
      vat.set(key, { ...r, base: cents(r.base + base), vat: cents(r.vat + v.amount) });
    }
    const name = d.invoice.vendor.value ?? d.name;
    const key = `${name}|${c}`;
    const vr = vendors.get(key) ?? { vendor: name, currency: c, total: 0, count: 0 };
    vendors.set(key, { ...vr, total: cents(vr.total + total), count: vr.count + 1 });
  }
  return {
    bills,
    statements: docs.filter((d) => d.type === "statement"),
    attention: docs.filter(failing).length,
    byCurrency: [...byCurrency.values()].sort((a, b) => b.count - a.count),
    vatByRate: [...vat.values()].sort((a, b) => a.currency.localeCompare(b.currency) || (a.rate ?? 0) - (b.rate ?? 0)),
    byVendor: [...vendors.values()].sort((a, b) => b.total - a.total),
  };
}
