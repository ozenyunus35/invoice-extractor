const formatters = new Map<string, Intl.NumberFormat>();
let locale = "en-US";
let lang: "en" | "tr" = "en";

/** The interface language, for code outside React such as the Excel export. */
export const uiLang = () => lang;

/** Follows the interface language: 1,234.50 in English, 1.234,50 in Turkish. */
export function setFormatLocale(next: "en" | "tr") {
  lang = next;
  locale = next === "tr" ? "tr-TR" : "en-US";
}

/** "$1,234.50", "€345.25", or "1,234.50" when the currency is unknown. */
export function formatMoney(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  const key = `${locale}|${currency ?? ""}`;
  let f = formatters.get(key);
  if (!f) {
    f = currency
      ? new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 })
      : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatters.set(key, f);
  }
  return f.format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Reads a number the way the reviewer typed it, accepting "1.234,56" as well as "1,234.56". */
export function parseTyped(input: string): number | null {
  const t = input.replace(/[^\d.,-]/g, "");
  if (!t) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  const normal = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** A plain number in the interface language's style. */
export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString(locale, { maximumFractionDigits });
}
