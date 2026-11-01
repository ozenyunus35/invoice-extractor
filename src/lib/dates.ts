/**
 * Month names in nine languages, as the start of the folded word (no accents).
 * Prefixes are long enough not to collide: "mar" (March) vs "maj" (Polish May).
 */
const MONTHS: [RegExp, number][] = [
  [/^(jan|ocak|janv|ene|genn|stycz|jän)/, 1],
  [/^(feb|sub|fev|febr|lut)/, 2],
  [/^(mar|maart|marz|marc)/, 3],
  [/^(apr|nis|avr|abr|kwie)/, 4],
  [/^(may|mai|mei|mag|maj)/, 5],
  [/^(jun|haz|juin|giu|czerw)/, 6],
  [/^(jul|tem|juil|lug|lip)/, 7],
  [/^(aug|agu|aou|ago|sierp)/, 8],
  [/^(sep|eyl|set|wrze)/, 9],
  [/^(oct|okt|eki|ott|out|pazdz)/, 10],
  [/^(nov|kas|listop)/, 11],
  [/^(dec|dez|ara|dic|grud)/, 12],
];

const foldName = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/ı/g, "i");

const monthFromName = (name: string) => MONTHS.find(([re]) => re.test(foldName(name)))?.[1] ?? null;

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
  for (const m of line.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
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
  // "31 Oct 2026", "31. Oktober 2026", "31 Ekim 2026", "5 de octubre de 2026", "5 października 2026"
  // A phone photo can lose the spaces: "14 Mart2026", "27 de maio de2026".
  for (const m of line.matchAll(/(?<![\p{L}\d])(\d{1,2})\.?\s*(?:de\s+)?(\p{L}{3,})\.?,?\s*(?:de\s*)?(\d{4})\b/gu)) {
    const month = monthFromName(m[2]);
    const v = month && iso(+m[3], month, +m[1]);
    if (v) out.push({ iso: v, index: m.index });
  }
  // "Oct 31, 2026", "October 31 2026"
  for (const m of line.matchAll(/(?<!\p{L})(\p{L}{3,})\.?\s*(\d{1,2}),?\s*(\d{4})\b/gu)) {
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
