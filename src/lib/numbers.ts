/** Which character separates decimals in a document: "1,234.56" uses ".", "1.234,56" uses ",". */
export type Decimal = "," | ".";

const DATE_LIKE = /\b\d{1,4}[./-]\d{1,2}[./-]\d{2,4}\b/g;
const PERCENT = /%\s?\d{1,2}(?:[.,]\d{1,3})?|\d{1,2}(?:[.,]\d{1,3})?\s?%/g;

/**
 * Guesses the decimal separator from how amounts are written across the whole
 * document. Dates are removed first so "01.10.2026" does not count as "1.10".
 */
export function detectDecimal(text: string): Decimal {
  const clean = text.replace(DATE_LIKE, " ");
  const comma = clean.match(/\d,\d{2}(?!\d)/g)?.length ?? 0;
  const dot = clean.match(/\d\.\d{2}(?!\d)/g)?.length ?? 0;
  return comma > dot ? "," : ".";
}

/** Parses one numeric token ("1.234,56", "1,234.56", "12", "-3.5") with the document's separator. */
export function parseNumber(token: string, decimal: Decimal): number | null {
  let t = token.replace(/[−–]/g, "-").replace(/['  ]/g, "");
  t = decimal === "," ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type NumberToken = {
  value: number;
  /** Written with two decimals, so it reads as money rather than a count. */
  money: boolean;
};

/** Every number on a line, left to right, ignoring dates and percentages. */
export function numbersIn(line: string, decimal: Decimal): NumberToken[] {
  const clean = line.replace(DATE_LIKE, " ").replace(PERCENT, " ");
  const out: NumberToken[] = [];
  for (const m of clean.matchAll(/(?<![\w])[-−]?\d+(?:[.,' ]\d+)*(?![\w])/g)) {
    const value = parseNumber(m[0], decimal);
    if (value === null) continue;
    out.push({ value, money: new RegExp(`\\${decimal}\\d{2}$`).test(m[0]) });
  }
  return out;
}

/** Percentages on a line, e.g. "KDV %20" or "MwSt 19 %". */
export function percentsIn(line: string, decimal: Decimal): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(/%\s?(\d{1,2}(?:[.,]\d{1,3})?)(?!\d)|(\d{1,2}(?:[.,]\d{1,3})?)\s?%/g)) {
    const v = parseNumber(m[1] ?? m[2], decimal);
    if (v !== null) out.push(v);
  }
  return out;
}

/** Rounds to cents, avoiding binary float noise like 0.30000000000000004. */
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const near = (a: number, b: number, tolerance = 0.011) => Math.abs(a - b) <= tolerance;
