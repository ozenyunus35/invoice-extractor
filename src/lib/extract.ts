import { datesIn, isMonthFirst } from "./dates";
import { cents, detectDecimal, near, numbersIn, percentsIn, type Decimal, type NumberToken } from "./numbers";
import type { Field, Invoice, LineItem, OcrLine, VatLine } from "./types";

/*
 * Rule-based field extraction. Works on OCR lines in reading order and on
 * invoices in English, German and Turkish. Every value keeps the index of the
 * line it came from so the reviewer can see where it was read.
 */

const FOLD: Record<string, string> = { İ: "i", I: "i", ı: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g", ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c", ä: "a", Ä: "a" };

/** Lowercase ASCII-ish copy of a line with the same length, so match positions map back. */
export function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const mapped = FOLD[ch] ?? ch.toLowerCase();
    out += mapped.length === ch.length ? mapped : ch;
  }
  return out;
}

const TOTAL_STRONG = /\b(grand total|total due|amount due|balance due|total payable|genel toplam|odenecek tutar|vergiler dahil toplam|gesamtbetrag|rechnungsbetrag|endbetrag|zu zahlen)\b/;
const TOTAL_MID = /\b(total amount|invoice total|total incl|total \(incl|gesamtsumme|toplam tutar)\b/;
const TOTAL_WEAK = /\b(total|toplam|summe|gesamt)\b/;
const NOT_TOTAL = /(sub ?-?total|ara toplam|mal hizmet|total (vat|tax)|toplam kdv|kdv toplam|net(to)?\b|zwischensumme|mwst|items|qty|quantity|hours|before tax|excl)/;
const SUBTOTAL = /(sub ?-?total|net amount|net total|total net|total excl|total before tax|ara toplam|mal hizmet toplam|zwischensumme|nettobetrag|summe netto|netto)/;
const VAT = /\b(vat|kdv|mwst|ust|tax|umsatzsteuer|iva|btw|gst)\b/;
const NOT_VAT = /(vat (no|number|id|reg)|tax id|tax no|vergi (no|dairesi|numarasi|kimlik)|ust-?id|steuer-?nr|steuernummer|tax invoice)/;
const BILL_TO = /\b(bill(ed)? to|invoice to|customer|client|sold to|ship to|sayin|alici|musteri|rechnungsempfanger|kunde)\b/;
const TITLE = /\b(tax invoice|invoice|e-arsiv fatura|e-fatura|fatura|rechnung|receipt|fis|bill|statement)\b/g;
const COMPANY = /\b(inc|llc|ltd|limited|gmbh|ag|plc|bv|sas|sarl|co|corp|a\.s|sti|ltd\. sti|kg|ohg|ug)\b\.?/;
const HEADER_WORDS = /\b(description|item|items|qty|quantity|unit|price|amount|rate|hours|aciklama|urun|hizmet|miktar|birim|fiyat|tutar|beschreibung|artikel|leistung|menge|einzelpreis|preis|betrag|pos)\b/g;

const INVOICE_NO = /(invoice\s*(no|number|nr|#)|inv\s*(no|#)|fatura\s*(no|numarasi)|belge\s*no|rechnungs?-?\s*(nr|nummer|no)|receipt\s*(no|#)|fis\s*no|bill\s*no|order\s*(no|#))\.?/;
const TAX_ID = /(vat\s*(no|number|id|reg(istration)?(\s*no)?)|tax\s*(id|no)|\bein\b|\bvkn\b|vergi\s*(no|numarasi|kimlik\s*no)|ust-?id(-?nr)?|steuer-?nr|steuernummer)\.?/;
const DATE_LABEL = /(invoice date|date of issue|issue date|issued|fatura tarihi|duzenleme tarihi|tarih|rechnungsdatum|belegdatum|datum|date)/;
const DUE_LABEL = /(due date|payment due|due|vade|son odeme|fallig|zahlbar bis)/;

/** VAT and sales tax rates in common use, to recover a rate OCR could not read. */
const STANDARD_RATES = [1, 2.5, 3, 4, 5, 5.5, 6, 7, 8, 8.875, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27];

const conf = (line: OcrLine | undefined, rule: number) => cents(rule * ((line?.confidence ?? 100) / 100));
const empty = <T,>(): Field<T> => ({ value: null, line: null, confidence: 0 });

/** The amount a totals line refers to: its last money-looking number. */
function lineAmount(lines: OcrLine[], i: number, decimal: Decimal): { value: number; line: number } | null {
  const pick = (nums: NumberToken[]) => [...nums].reverse().find((n) => n.money) ?? nums.at(-1);
  const own = pick(numbersIn(lines[i].text, decimal));
  if (own) return { value: own.value, line: i };
  // The amount sometimes lands on its own line right below the label.
  const next = lines[i + 1];
  if (next && !/[a-z]{3}/i.test(next.text)) {
    const n = pick(numbersIn(next.text, decimal));
    if (n) return { value: n.value, line: i + 1 };
  }
  return null;
}

type Kind = "subtotal" | "total" | "vat" | null;

function classify(f: string): { kind: Kind; strength: number } {
  if (SUBTOTAL.test(f)) return { kind: "subtotal", strength: 1 };
  if (!NOT_TOTAL.test(f) || /\b(incl|inkl|dahil)\b/.test(f)) {
    if (TOTAL_STRONG.test(f)) return { kind: "total", strength: 3 };
    if (TOTAL_MID.test(f)) return { kind: "total", strength: 2 };
    if (TOTAL_WEAK.test(f)) return { kind: "total", strength: 1 };
  }
  if (VAT.test(f) && !NOT_VAT.test(f)) return { kind: "vat", strength: 1 };
  return { kind: null, strength: 0 };
}

const CURRENCIES: [string, RegExp][] = [
  ["USD", /\$\s?\d|\d\s?\$|\bUSD\b/g],
  ["EUR", /€|\bEUR\b/g],
  ["GBP", /£|\bGBP\b/g],
  ["TRY", /₺|\bTL\b|\bTRY\b/g],
];

/**
 * The currency printed on the total line wins; otherwise the most frequent
 * one. A "$" only counts next to a number, since OCR reads "Ş" as "$".
 */
function detectCurrency(text: string, decimal: Decimal, totalLine: string | null): Field<string> {
  const onTotal = totalLine ? CURRENCIES.find(([, re]) => new RegExp(re.source).test(totalLine)) : undefined;
  if (onTotal) return { value: onTotal[0], line: null, confidence: 0.95 };
  const counts = CURRENCIES.map(([code, re]) => [code, (text.match(re) ?? []).length] as const);
  const [code, n] = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (n > 0) return { value: code, line: null, confidence: n > 1 ? 0.9 : 0.8 };
  const f = fold(text);
  if (/\bkdv\b/.test(f)) return { value: "TRY", line: null, confidence: 0.6, derived: true };
  if (decimal === "," && /\b(mwst|rechnung|ust)\b/.test(f)) return { value: "EUR", line: null, confidence: 0.6, derived: true };
  return empty();
}

/** A token that belongs to the numeric tail of an item line. */
const isNumericToken = (t: string) => {
  const bare = t.replace(/^[€$£₺(]+|[€$£₺)]+$/g, "");
  return /^[-−]?\d[\d.,' ]*%?$/.test(bare) || /^%\d+([.,]\d+)?$/.test(bare) || /^(x|×|eur|usd|gbp|try|tl|pcs|adet|stk|st|h|hrs|hr|ea)$/i.test(bare);
};

function parseItem(text: string, decimal: Decimal, line: number): LineItem | "continuation" | null {
  const tokens = text.trim().split(/\s+/);
  let cut = tokens.length;
  while (cut > 0 && isNumericToken(tokens[cut - 1])) cut--;
  let description = tokens.slice(0, cut).join(" ");
  const tail = tokens.slice(cut).join(" ");
  if (!/[a-zà-ÿğışçöü]{2}/i.test(description)) return null;
  const nums = numbersIn(tail, decimal);
  if (nums.length === 0) return "continuation";

  // "2 x Flat white" or "Flat white x2"
  let leadQty: number | null = null;
  const lead = description.match(/^(\d+)\s*[x×]\s+(.*)$/i) ?? description.match(/^(.*?)\s+[x×]\s?(\d+)$/i);
  if (lead) {
    const [q, rest] = /^\d+$/.test(lead[1]) ? [+lead[1], lead[2]] : [+lead[2], lead[1]];
    leadQty = q;
    description = rest;
  }

  const v = nums.map((n) => n.value);
  let quantity = 1;
  let unitPrice = v.at(-1)!;
  const amount = v.at(-1)!;
  if (v.length >= 3) {
    let found = false;
    for (let k = v.length - 1; k >= 2 && !found; k--)
      for (let i = 0; i < k && !found; i++)
        for (let j = i + 1; j < k && !found; j++)
          if (near(v[i] * v[j], v[k], Math.max(0.011, v[k] * 0.002))) {
            [quantity, unitPrice] = [v[i], v[j]];
            found = true;
          }
    if (!found) [quantity, unitPrice] = [v[0], v.at(-2)!];
  } else if (v.length === 2) {
    const [a, b] = nums;
    if (!a.money && a.value > 0 && a.value < 10000) {
      quantity = a.value;
      unitPrice = cents(b.value / a.value);
    } else {
      unitPrice = a.value;
      const q = a.value ? Math.round(b.value / a.value) : 1;
      quantity = q > 0 && near(q * a.value, b.value) ? q : 1;
    }
  } else if (leadQty) {
    quantity = leadQty;
    unitPrice = cents(amount / leadQty);
  }
  if (leadQty && v.length >= 2) quantity = leadQty;

  const rates = percentsIn(tail, decimal);
  return { description: description.replace(/[\s:–-]+$/, ""), quantity, unitPrice, amount, vatRate: rates.at(-1) ?? null, line };
}

function findVendor(lines: OcrLine[], folded: string[], stop: number): Field<string> {
  const end = Math.min(stop, 8);
  let best: { text: string; line: number; score: number } | null = null;
  const heights = lines.slice(0, end).map((l) => (l.bbox ? l.bbox.y1 - l.bbox.y0 : 0));
  const tallest = Math.max(1, ...heights);
  for (let i = 0; i < end; i++) {
    const f = folded[i];
    if (BILL_TO.test(f)) break;
    const text = lines[i].text.replace(new RegExp(TITLE.source, "gi"), " ").replace(/\s+/g, " ").trim();
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    if (letters < 3 || letters < text.length * 0.5) continue;
    if (/@|www\.|https?:|\b(tel|phone|fax|iban)\b/i.test(text) || datesIn(text).length) continue;
    if (INVOICE_NO.test(f) || TAX_ID.test(f) || DATE_LABEL.test(f)) continue;
    const score = (COMPANY.test(fold(text)) ? 2 : 0) + heights[i] / tallest + (end - i) / end;
    if (!best || score > best.score) best = { text, line: i, score };
  }
  if (!best) return empty();
  return { value: best.text, line: best.line, confidence: conf(lines[best.line], best.score >= 2.5 ? 0.95 : 0.75) };
}

/** Value written after a label on the same line, e.g. "Invoice No: INV-0418". */
function afterLabel(lines: OcrLine[], folded: string[], label: RegExp, value: RegExp): Field<string> {
  for (let i = 0; i < lines.length; i++) {
    const m = folded[i].match(label);
    if (!m || m.index === undefined) continue;
    const own = lines[i].text.slice(m.index + m[0].length).match(value);
    const v = own ?? lines[i + 1]?.text.match(value);
    if (v) return { value: v[1].replace(/[\s-]+$/, ""), line: own ? i : i + 1, confidence: conf(lines[i], 0.95) };
  }
  return empty();
}

function labelledDate(lines: OcrLine[], folded: string[], label: RegExp, us: boolean, skip?: RegExp): Field<string> {
  for (let i = 0; i < lines.length; i++) {
    const f = folded[i];
    const m = f.match(label);
    if (!m || m.index === undefined) continue;
    if (skip && skip.test(f.slice(m.index, m.index + m[0].length + 4))) continue;
    const after = datesIn(lines[i].text, us).filter((d) => d.index >= m.index!);
    const d = after[0] ?? datesIn(lines[i + 1]?.text ?? "", us)[0];
    if (d) return { value: d.iso, line: after[0] ? i : i + 1, confidence: conf(lines[i], 0.95) };
  }
  return empty();
}

export function extractInvoice(lines: OcrLine[]): Invoice {
  const text = lines.map((l) => l.text).join("\n");
  const folded = lines.map((l) => fold(l.text));
  const decimal = detectDecimal(text);
  // Month-first dates (10/14/2026) are told apart by the dates themselves, or by dollars.
  const us = isMonthFirst(text, /\$\s?\d|\bUSD\b/.test(text));

  // Totals block: classify every line, keep the best candidate of each kind.
  const kinds = folded.map(classify);
  const headerIdx = folded.findIndex((f) => (f.match(HEADER_WORDS)?.length ?? 0) >= 2);
  const firstTotalsLine = kinds.findIndex((k, i) => i > headerIdx && k.kind !== null && numbersIn(lines[i].text, decimal).length > 0);

  let total: Field<number> = empty();
  let totalStrength = 0;
  let subtotal: Field<number> = empty();
  const vat: VatLine[] = [];
  kinds.forEach((k, i) => {
    if (!k.kind) return;
    const amt = lineAmount(lines, i, decimal);
    if (!amt) return;
    if (k.kind === "total" && k.strength >= totalStrength) {
      total = { value: amt.value, line: amt.line, confidence: conf(lines[i], 0.6 + k.strength * 0.12) };
      totalStrength = k.strength;
    } else if (k.kind === "subtotal" && subtotal.value === null) {
      subtotal = { value: amt.value, line: amt.line, confidence: conf(lines[i], 0.92) };
    } else if (k.kind === "vat") {
      const rate = percentsIn(lines[i].text, decimal).at(-1) ?? null;
      const nums = numbersIn(lines[i].text, decimal).filter((n) => n.value !== rate);
      let base: number | null = null;
      if (nums.length >= 2 && rate !== null) {
        const [a, b] = [nums.at(-2)!.value, nums.at(-1)!.value];
        if (near(a * rate / 100, b, 0.02)) base = a;
      }
      vat.push({ rate, base, amount: amt.value, line: amt.line });
    }
  });

  // Line items sit between the column header and the totals block.
  const totalsStart = firstTotalsLine === -1 ? lines.length : firstTotalsLine;
  const items: LineItem[] = [];
  const startIdx = headerIdx !== -1 && headerIdx < totalsStart ? headerIdx + 1 : Math.min(3, totalsStart);
  for (let i = startIdx; i < totalsStart; i++) {
    const f = folded[i];
    if (headerIdx === -1 && (BILL_TO.test(f) || INVOICE_NO.test(f) || DATE_LABEL.test(f) || TAX_ID.test(f))) continue;
    const item = parseItem(lines[i].text, decimal, i);
    if (item === "continuation") {
      const prev = items.at(-1);
      if (prev && headerIdx !== -1 && i - prev.line <= 2) prev.description += ` ${lines[i].text.trim()}`;
    } else if (item) items.push(item);
  }

  // Derive what the document implies but does not print.
  const vatSum = cents(vat.reduce((s, v) => s + v.amount, 0));
  if (subtotal.value === null && total.value !== null && vat.length)
    subtotal = { value: cents(total.value - vatSum), line: null, confidence: 0.7, derived: true };
  if (total.value === null && subtotal.value !== null)
    total = { value: cents(subtotal.value + vatSum), line: null, confidence: 0.7, derived: true };
  if (!vat.length && subtotal.value !== null && total.value !== null && total.value - subtotal.value > 0.009) {
    const amount = cents(total.value - subtotal.value);
    const rate = Math.round((amount / subtotal.value) * 1000) / 10;
    vat.push({ rate: Number.isInteger(rate) ? rate : null, base: subtotal.value, amount, line: null });
  }
  for (const v of vat) {
    if (v.base === null && vat.length === 1 && subtotal.value !== null && !subtotal.derived) v.base = subtotal.value;
    // OCR often reads "%20" as "420": recover a standard rate from the amounts instead.
    if (v.rate === null && v.base) {
      const rate = (v.amount / v.base) * 100;
      const standard = STANDARD_RATES.find((r) => near(r, rate, 0.05));
      if (standard !== undefined) Object.assign(v, { rate: standard, rateDerived: true });
    }
  }

  const dateField = labelledDate(lines, folded, DATE_LABEL, us, /due|vade|fallig/);
  const firstDate = lines.findIndex((l) => datesIn(l.text, us).length > 0);
  const date: Field<string> =
    dateField.value !== null
      ? dateField
      : firstDate === -1
        ? empty()
        : { value: datesIn(lines[firstDate].text, us)[0].iso, line: firstDate, confidence: conf(lines[firstDate], 0.65) };

  const currency = detectCurrency(text, decimal, total.line === null ? null : lines[total.line].text);

  return {
    vendor: findVendor(lines, folded, headerIdx === -1 ? totalsStart : headerIdx),
    taxId: afterLabel(lines, folded, TAX_ID, /^[\s:#.]*([A-Z]{0,2}\s?\d[\d\s-]{6,16}\d)/),
    invoiceNumber: afterLabel(lines, folded, INVOICE_NO, /^[\s:#.]*([A-Z0-9][A-Z0-9\-/.]*\d[A-Z0-9\-/.]*)/i),
    date,
    dueDate: labelledDate(lines, folded, DUE_LABEL, us),
    currency,
    items,
    subtotal,
    vat,
    total,
    decimal,
  };
}
