const formatters = new Map<string, Intl.NumberFormat>();

/** "$1,234.50", "€345.25", or "1,234.50" when the currency is unknown. */
export function formatMoney(value: number | null, currency: string | null): string {
  if (value === null) return "—";
  const key = currency ?? "";
  let f = formatters.get(key);
  if (!f) {
    f = currency
      ? new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 })
      : new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    formatters.set(key, f);
  }
  return f.format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
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
