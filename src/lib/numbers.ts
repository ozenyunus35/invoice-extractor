/** Which character separates decimals in a document: "1,234.56" uses ".", "1.234,56" uses ",". */
export type Decimal = "," | ".";

const DATE_LIKE = /\b\d{1,4}[./-]\d{1,2}[./-]\d{2,4}\b/g;
// "%20" and "20 %", but not "%8,246.29": OCR often reads a ₹ or ¥ sign as "%".
const PERCENT = /%\s?\d{1,2}(?:[.,]\d{1,3})?(?![\d.,])|\d{1,2}(?:[.,]\d{1,3})?\s?%/g;

/**
 * Guesses the decimal separator from how amounts are written across the whole
 * document. Dates are removed first so "01.10.2026" does not count as "1.10".
 */
export function detectDecimal(text: string): Decimal {
  const clean = text.replace(DATE_LIKE, " ");
  // Two decimals after the separator is the strongest sign; a group of three
  // after the other one ("20.000", "12,480") is thousands and counts half.
  const count = (re: RegExp) => clean.match(re)?.length ?? 0;
  const comma = count(/\d,\d{2}(?!\d)/g) + count(/\d\.\d{3}(?![\d,.])/g) * 0.5;
  const dot = count(/\d\.\d{2}(?!\d)/g) + count(/\d,\d{3}(?![\d,.])/g) * 0.5;
  return comma > dot ? "," : ".";
}

/** Parses one numeric token ("1.234,56", "1,234.56", "12", "-3.5") with the document's separator. */
export function parseNumber(token: string, decimal: Decimal): number | null {
  let t = token.replace(/[−–]/g, "-").replace(/['  ]/g, "");
  // A blurred photo reads "6.485,09" as "6.485.09": one separator throughout and two
  // digits at the end can only be thousands followed by cents.
  const same = t.match(/^(-?\d{1,3})([.,])(\d{3}(?:\2\d{3})*)\2(\d{2})$/);
  if (same) return Number(`${same[1]}${same[3].replace(/[.,]/g, "")}.${same[4]}`);
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

/**
 * Joins thousands written with spaces: "2 490,00", "12 345", "1 234 567,89".
 * Narrow and non-breaking spaces always group digits. A plain single space
 * only does on lines rebuilt from positions, where columns are two spaces apart,
 * or with `force` on totals lines, which hold a label and one amount.
 */
export function joinSpacedThousands(line: string, force = false): string {
  const spaced = force || / {2}/.test(line);
  const re = spaced ? /(?<![\d.,])(\d{1,3})((?:[ \u00a0\u202f]\d{3})+)(?![\d])/g : /(?<![\d.,])(\d{1,3})((?:[\u00a0\u202f]\d{3})+)(?![\d])/g;
  return line.replace(re, (_, head: string, groups: string) => head + groups.replace(/[ \u00a0\u202f]/g, ""));
}

/** Every number on a line, left to right, ignoring dates and percentages. */
export function numbersIn(line: string, decimal: Decimal): NumberToken[] {
  const clean = joinSpacedThousands(line)
    // A currency sign OCR could not read sticks to the amount as a letter: "T8,246.29", "Y969,480".
    .replace(/(^|\s)[A-Za-z%](?=\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?(?![\d.,]))/g, "$1")
    .replace(DATE_LIKE, " ")
    .replace(PERCENT, " ");
  const out: NumberToken[] = [];
  for (const m of clean.matchAll(/(?<![\w])[-−]?\d+(?:[.,' ]\d+)*(?![\w])/g)) {
    const value = parseNumber(m[0], decimal);
    if (value === null) continue;
    out.push({ value, money: new RegExp(`\\${decimal}\\d{2}$`).test(m[0]) });
  }
  return out;
}

/** Percentages on a line, e.g. "KDV %20" or "MwSt 19 %". */
export function percentsIn(line: string): number[] {
  const out: number[] = [];
  // A rate never has a thousands separator, so either mark is the decimal point: "5,5%" and "5.5%".
  for (const m of line.matchAll(/%\s?(\d{1,2}(?:[.,]\d{1,3})?)(?![\d.,])|(\d{1,2}(?:[.,]\d{1,3})?)\s?%/g)) {
    const v = Number((m[1] ?? m[2]).replace(",", "."));
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** Rounds to cents, avoiding binary float noise like 0.30000000000000004. */
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const near = (a: number, b: number, tolerance = 0.011) => Math.abs(a - b) <= tolerance;
