/** Month names in English, German and Turkish, lowercase, first three or more letters. */
const MONTHS: [RegExp, number][] = [
  [/^(jan|ocak|jän)/, 1],
  [/^(feb|şub|sub)/, 2],
  [/^(mar|mär|mart)/, 3],
  [/^(apr|nis)/, 4],
  [/^(may|mai|mayıs)/, 5],
  [/^(jun|haz)/, 6],
  [/^(jul|tem)/, 7],
  [/^(aug|ağu|agu)/, 8],
  [/^(sep|eyl)/, 9],
  [/^(oct|okt|eki)/, 10],
  [/^(nov|kas)/, 11],
  [/^(dec|dez|ara)/, 12],
];

const monthFromName = (name: string) => MONTHS.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? null;

const iso = (y: number, m: number, d: number) => {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export type DateMatch = { iso: string; index: number };

/**
 * Finds dates on a line as ISO strings. Numeric dates are read day first
 * (31.10.2026, 31/10/2026) unless the document is in US format, where
 * 10/31/2026 is month first. A first part above 12 always wins.
 */
export function datesIn(line: string, usFormat = false): DateMatch[] {
  const out: DateMatch[] = [];
  for (const m of line.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    const v = iso(+m[1], +m[2], +m[3]);
    if (v) out.push({ iso: v, index: m.index });
  }
  for (const m of line.matchAll(/\b(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})\b/g)) {
    let [a, b] = [+m[1], +m[3]];
    const monthFirst = a <= 12 && (b > 12 || (usFormat && m[2] === "/"));
    if (monthFirst) [a, b] = [b, a];
    const v = iso(+m[4], b, a);
    if (v) out.push({ iso: v, index: m.index });
  }
  // "31 Oct 2026", "31. Oktober 2026", "31 Ekim 2026"
  for (const m of line.matchAll(/\b(\d{1,2})\.?\s+([A-Za-zÄÖÜäöüŞşĞğİıÇç]{3,})\.?,?\s+(\d{4})\b/g)) {
    const month = monthFromName(m[2]);
    const v = month && iso(+m[3], month, +m[1]);
    if (v) out.push({ iso: v, index: m.index });
  }
  // "Oct 31, 2026", "October 31 2026"
  for (const m of line.matchAll(/\b([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s*(\d{4})\b/g)) {
    const month = monthFromName(m[1]);
    const v = month && iso(+m[3], month, +m[2]);
    if (v) out.push({ iso: v, index: m.index });
  }
  return out.sort((x, y) => x.index - y.index);
}

/**
 * Whether numeric dates in this document are written month first (10/14/2026).
 * Any date whose second part is above 12 settles it; so does a first part
 * above 12 the other way. Without evidence, a dollar document is month first.
 */
export function isMonthFirst(text: string, dollarHint = false): boolean {
  let monthFirst = 0;
  let dayFirst = 0;
  for (const m of text.matchAll(/\b(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})\b/g)) {
    if (+m[3] > 12 && +m[1] <= 12) monthFirst++;
    if (+m[1] > 12 && +m[3] <= 12) dayFirst++;
  }
  if (monthFirst !== dayFirst) return monthFirst > dayFirst;
  return dollarHint;
}
