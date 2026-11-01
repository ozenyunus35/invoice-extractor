import { fold } from "./extract";
import { cents, detectDecimal, near, parseNumber, type Decimal, joinSpacedThousands } from "./numbers";
import type { Check, OcrLine } from "./types";

/*
 * Financial report reader: income statements, balance sheets, cash flow
 * statements, budget variance reports and ageing schedules, in English and
 * Turkish. Tables are rebuilt from text rows ("Label  1,234  (567)"), every
 * subtotal and identity is checked, and the key ratios are worked out.
 */

export type ReportTable = {
  title: string;
  kind: "income" | "balance" | "cashflow" | "budget" | "ageing" | "ratios" | "other";
  columns: string[];
  rows: { label: string; values: (number | null)[]; percent: boolean; line: number }[];
  /** Index of the header line, or of the first row when there is no header. */
  line: number;
};

export type Report = {
  company: string | null;
  unit: string | null;
  tables: ReportTable[];
  decimal: Decimal;
};

const YEAR = /^(19|20)\d{2}$/;
/** A number cell: 1.234,5 · (1,920) · -45 · %36,0 · 36.0% · +2.550 */
const NUM = /^[(]?[-−+]?%?\d[\d.,]*%?[)]?$/;

/** Set per report: true when no figure in its tables has decimals, so "27,900" and "17.100" are both thousands. */
let wholeFigures = false;

function cell(token: string, decimal: Decimal): { value: number; percent: boolean } | null {
  // "31.12.2026" in a header is a date, not 31,122,026.
  if (!NUM.test(token) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(token)) return null;
  const negative = token.startsWith("(") || /^[-−]/.test(token);
  const percent = token.includes("%");
  const bare = token.replace(/[()%+−-]/g, "");
  if (wholeFigures && /^\d{1,3}([.,]\d{3})+$/.test(bare)) return { value: (negative ? -1 : 1) * Number(bare.replace(/[.,]/g, "")), percent };
  const v = parseNumber(bare, decimal);
  return v === null ? null : { value: negative ? -v : v, percent };
}

/** Splits "Net sales 40,500 48,600" into the label and its numeric cells. */
function splitRow(text: string, decimal: Decimal) {
  const tokens = joinSpacedThousands(text).trim().split(/\s+/);
  // OCR specks at the end of a row ("17.100  ¢€", "6.000  |"): no digit, at most two characters.
  while (tokens.length > 1 && !/\d/.test(tokens[tokens.length - 1]) && (tokens[tokens.length - 1].length <= 2 || !/[\p{L}\d]/u.test(tokens[tokens.length - 1]))) tokens.pop();
  const values: { value: number; percent: boolean }[] = [];
  let cut = tokens.length;
  while (cut > 1) {
    const c = cell(tokens[cut - 1], decimal);
    if (!c) break;
    values.unshift(c);
    cut--;
  }
  // OCR specks around the label ("{ Total current liabilities", "Retained earnings 4 '").
  const words = tokens.slice(0, cut);
  const speck = (t: string) => !/[\p{L}\d]/u.test(t) || /^[\p{L}\d]$/u.test(t) || /^\d{1,2}$/.test(t);
  while (words.length > 1 && speck(words[0])) words.shift();
  while (words.length > 1 && speck(words[words.length - 1])) words.pop();
  // Inside the label, a token with no letter is a speck too ("Taxes payable =30").
  const label = words.filter((t, k) => k === 0 || /\p{L}/u.test(t) || /^[&/-]$/.test(t)).join(" ");
  // "Item 2025 2026" is a header: its only numbers are plain years.
  const yearsOnly = tokens.slice(cut).every((t) => YEAR.test(t));
  return { label, values, yearsOnly };
}

const isRow = (r: ReturnType<typeof splitRow>) => r.values.length > 0 && !r.yearsOnly && /\p{L}{2}|^[A-Z]\d+$/u.test(r.label) && r.label.length <= 70 && !/[.:]$/.test(r.label);

/** Column names from the header line: split at years ("31 December 2025 30 September 2026") or one word per column. */
function columnNames(header: string | null, n: number): string[] {
  const fallback = Array.from({ length: n }, (_, i) => `Column ${i + 1}`);
  if (!header) return fallback;
  const words = header.trim().split(/\s+/);
  const rest = words.slice(1);
  const years = rest.map((w, i) => (YEAR.test(w) ? i : -1)).filter((i) => i >= 0);
  if (years.length === n) {
    const startsWithYear = years[0] === 0;
    const bounds = startsWithYear ? years : years.map((y) => y + 1);
    return bounds.map((b, i) => (startsWithYear ? rest.slice(b, bounds[i + 1] ?? rest.length) : rest.slice(i === 0 ? 0 : bounds[i - 1], b)).join(" "));
  }
  if (rest.length === n) return rest;
  if (words.length === n) return words;
  return fallback;
}

const KIND_RULES: [ReportTable["kind"], RegExp][] = [
  ["cashflow", /(cash from operating|operating activities|faaliyetlerden saglanan|investing activities|yatirimlarda kullanilan|nakit akis|cashflow|kapitalflussrechnung|flux de tresorerie|flujos de efectivo|estado de flujos)/],
  ["balance", /(total assets|toplam varliklar|toplam kaynaklar|total liabilities and equity|balance sheet|bilanco|bilanzsumme|summe aktiva|\bbilanz\b|total actif|\bbilan\b|total activo|balance de situacion)/],
  ["ageing", /(ageing|yaslandirma|overdue|vadesi|gelmemis|gunu asan|days past|altersstruktur|uberfallig|echeancier|antiguedad)/],
  ["budget", /\b(budget|butce|plan|presupuesto)\b.*\b(actual|gerceklesen|ist|reel|real)\b/],
  ["income", /(net sales|net satislar|revenue|hasilat|gross profit|brut kar|umsatzerlose|gewinn- und verlustrechnung|chiffre d'affaires|compte de resultat|ventas netas|cuenta de perdidas)/],
];

/** Reads every table in the report. */
export function extractReport(lines: OcrLine[]): Report {
  const text = lines.map((l) => l.text).join("\n");
  const decimal = detectDecimal(text.replace(/\b(19|20)\d{2}\b/g, ""));
  // A phone photo's OCR: specks on lines of their own. Only then are rows with missed figures
  // and stray marks between rows expected; clean text (PDF, Word) keeps the strict reading.
  const noisy = lines.filter((l) => l.text.replace(/[^\p{L}\d]/gu, "").length <= 3).length >= 3;
  // A short line-item name with no figures ("Trade receivables"): part of the table around it.
  const itemOnly = (k: number) => {
    if (!noisy) return false;
    const t = lines[k]?.text.trim() ?? "";
    const r = splitRow(t, decimal);
    return !r.values.length && /^[\p{Lu}{|]/u.test(t) && !/\b(amounts?|thousands?|millions?|tutarlar|bin (TL|USD|EUR))\b/i.test(t) && /\p{L}{3}/u.test(r.label) && r.label.split(/\s+/).length <= 7 && !/\d/.test(r.label) && !/[.:;]$/.test(t);
  };
  const tables: ReportTable[] = [];
  wholeFigures = false;
  const figures = lines.flatMap((l) => {
    const r = splitRow(l.text, decimal);
    return isRow(r) ? l.text.trim().split(/\s+/).filter((t) => NUM.test(t) && /\d/.test(t)) : [];
  });
  // A blurred photo drops a digit now and then ("27.9" for "27,900"), so a stray one or two
  // short-decimal figures among many thousands don't overrule the rest.
  const decimals = figures.filter((t) => /[.,]\d{1,2}%?\)?$/.test(t)).length;
  const groups = figures.filter((t) => /^\(?[-−+]?\d{1,3}([.,]\d{3})+\)?$/.test(t)).length;
  wholeFigures = groups >= 4 && decimals <= (noisy ? Math.max(2, groups * 0.2) : 0);
  let i = 0;
  while (i < lines.length) {
    const first = splitRow(lines[i].text, decimal);
    if (!isRow(first)) {
      i++;
      continue;
    }
    // Collect consecutive rows; a run of at least two makes a table.
    const rows: ReportTable["rows"] = [];
    // Line items right above the first row whose figures were all missed (a pale column on a photo).
    let start = i;
    while (start - 1 >= 0 && i - start < 8 && (itemOnly(start - 1) || lines[start - 1].text.replace(/[^\p{L}\d]/gu, "").length <= 3)) start--;
    while (start < i && !itemOnly(start)) start++;
    for (let k = start; k < i; k++) if (itemOnly(k)) rows.push({ label: splitRow(lines[k].text, decimal).label, values: [], percent: false, line: k });
    let j = i;
    for (; j < lines.length; j++) {
      const r = splitRow(lines[j].text, decimal);
      if (!isRow(r)) {
        // A photo's OCR leaves specks between rows ("|", "7", ") "): step over up to two of
        // them when the table carries on right after.
        const speck = (k: number) => noisy && k < lines.length && (lines[k].text.replace(/[^\p{L}\d]/gu, "").length <= 3 || itemOnly(k));
        const next = [1, 2, 3, 4, 5, 6].find((d) => [...Array(d).keys()].every((e) => speck(j + e)) && j + d < lines.length && isRow(splitRow(lines[j + d].text, decimal)));
        if (next === undefined) break;
        // A line item whose figures the reader missed keeps its place in the table, empty.
        for (let e = 0; e < next; e++) if (itemOnly(j + e)) rows.push({ label: splitRow(lines[j + e].text, decimal).label, values: [], percent: false, line: j + e });
        j += next - 1;
        continue;
      }
      rows.push({ label: r.label, values: r.values.map((v) => v.value), percent: r.values.some((v) => v.percent), line: j });
    }
    if (rows.length >= 2) {
      // The table's width: the most figures that at least two rows have (a photo misses some cells,
      // so the commonest count can be short).
      const counts = rows.map((r) => r.values.length).filter((c) => c > 0);
      const n = Math.max(...counts.filter((c) => counts.filter((d) => d === c).length >= 2), counts.sort((a, b) => counts.filter((c) => c === b).length - counts.filter((c) => c === a).length)[0] ?? 0);
      // A row short of a figure (a faint or blank cell the reader missed) keeps the figures it
      // has in the last columns, where numbers sit, rather than being dropped.
      const kept = rows.filter((r) => r.values.length <= n).map((r) => (r.values.length === n ? r : { ...r, values: [...Array(n - r.values.length).fill(null), ...r.values] }));
      // The header sits right above the first row; wrapped headers take up to three short lines.
      const headerLine = (k: number) => k >= 0 && /\p{L}/u.test(lines[k].text) && lines[k].text.split(/\s+/).length <= 12 && !/[.,;]$/.test(lines[k].text.trim()) && !isRow(splitRow(lines[k].text, decimal));
      const head = rows[0]?.line ?? i; // figure-less rows above the first full one belong to the table
      let top = head;
      while (top - 1 >= 0 && head - top < 3 && headerLine(top - 1)) top--;
      const headerIdx = top < head ? head - 1 : -1;
      const header = headerIdx >= 0 ? lines[headerIdx].text : null;
      const headerBlock = lines.slice(top, head).map((l) => l.text).join(" ");
      // The title is the heading of the section ("DOCUMENT 03 / 06" + "Comparative balance sheet"),
      // or a short heading right above a second table in the same section.
      let title = "";
      for (let k = top - 1; k >= Math.max(0, top - 40) && !title; k--) {
        const t = lines[k].text.trim();
        if (/^(document|belge|section|bolum|bölüm|dokument|abschnitt|documento|seccion|sección)\s*\d+/i.test(t) && lines[k + 1]) title = lines[k + 1].text.trim();
      }
      // A short heading at the top of a wrapped header block names this table ("Margin comparison").
      const lead = lines[top]?.text.trim();
      if (top < head - 1 && lead && lead.split(/\s+/).length <= 4 && !/\d/.test(lead)) title = lead;
      const near = lines[top - 1]?.text.trim();
      if (top < head && top - 1 >= 0 && near && near.split(/\s+/).length <= 6 && !/\d/.test(near) && !/[.,:;]$/.test(near) && near !== title && tables.some((t) => t.title === title)) title = near;
      if (!title) title = lines.slice(Math.max(0, top - 8), top).reverse().map((l) => l.text.trim()).find((t) => t.split(/\s+/).length <= 6 && !/\d/.test(t) && !/[.,:;]$/.test(t)) ?? "";
      const blob = fold([title, headerBlock, ...kept.map((r) => r.label)].join(" "));
      const kind = kept.every((r) => r.percent) ? "ratios" : (KIND_RULES.find(([, re]) => re.test(blob))?.[0] ?? "other");
      const columns = columnNames(header, n);
      // A wrapped header can't be split into columns from text alone; at least name the total.
      if (columns[n - 1] === `Column ${n}` && /\b(total|toplam)\b/i.test(headerBlock)) columns[n - 1] = /toplam/i.test(headerBlock) ? "Toplam" : "Total";
      // On a noisy photo, stray digits can line up like a table ("DOCUMENT 03 / 06"): a real one
      // has at least two real figures.
      if (noisy) {
        // A lone digit among figures in the thousands is a speck read as a number.
        const big = kept.flatMap((r) => r.values).filter((v): v is number => v !== null && Math.abs(v) >= 100).length;
        if (big >= 3) for (const r of kept) r.values = r.values.map((v) => (v !== null && Math.abs(v) < 10 ? null : v));
        const words = title.split(/\s+/);
        while (words.length > 1 && (!/\p{L}{2}/u.test(words[words.length - 1]) || /^\p{Ll}{1,2}$/u.test(words[words.length - 1]))) words.pop();
        title = words.join(" ");
      }
      const real = kept.filter((r) => r.values.some((v) => v !== null && Math.abs(v) >= 100)).length >= 2;
      if (kept.length >= 2 && (!noisy || real)) tables.push({ title: title || "Table", kind, columns, rows: kept, line: headerIdx >= 0 ? headerIdx : head });
    }
    i = Math.max(j, i + 1);
  }

  const companyLine = lines.slice(0, 3).find((l) => /(^|\s)(AŞ|A\.Ş\.|Inc\.?|Ltd\.?|LLC|GmbH|PLC|Corp\.?|S\.A\.|SAS|B\.V\.|S\.p\.A\.)(?!\p{L})/iu.test(l.text));
  const company = companyLine ? companyLine.text.split(/\s*[|•]\s*/)[0].trim() : null;
  const unit = [/(TRY|USD|EUR|GBP) thousands/i, /bin (TL|USD|EUR)/i, /in thousands/i, /000 TL/i].map((re) => re.exec(text)?.[0]).find(Boolean) ?? null;
  return { company, unit, tables, decimal };
}

// ---------------------------------------------------------------------------
// Metrics: the same line items, whatever the language.

type MetricKey =
  | "revenue" | "cogs" | "grossProfit" | "opex" | "depreciation" | "operatingProfit" | "financeCosts" | "pbt" | "tax" | "netProfit"
  | "cash" | "receivables" | "inventories" | "currentAssets" | "ppe" | "totalAssets" | "payables" | "stDebt" | "currentLiabilities" | "ltDebt" | "totalLiabilities" | "equity" | "totalLE"
  | "cfo" | "cfi" | "cff" | "netChange" | "openingCash" | "closingCash";

const METRICS: [MetricKey, RegExp][] = [
  ["revenue", /^(net sales|revenue|sales revenue|net satislar|hasilat|umsatzerlose|umsatz|chiffre d'affaires|ventas netas|cifra de negocios|importe neto de la cifra de negocios)$/],
  ["cogs", /^(cost of sales|cost of goods sold|satislarin maliyeti|umsatzkosten|herstellungskosten|cout des ventes|coste de ventas|costo de ventas)$/],
  ["grossProfit", /^(gross profit|brut kar|bruttoergebnis|marge brute|margen bruto)$/],
  ["opex", /^(operating expenses|faaliyet giderleri|betriebliche aufwendungen|charges d'exploitation|gastos de explotacion)$/],
  ["depreciation", /^(depreciation( expense)?|amortisman( giderleri)?|abschreibungen|dotations aux amortissements|amortizacion)$/],
  ["operatingProfit", /^(operating profit|faaliyet kari|betriebsergebnis|resultat d'exploitation|resultado de explotacion)$/],
  ["financeCosts", /^((net )?finance costs|net finansman giderleri|finansman giderleri|finanzaufwand|zinsaufwand|charges financieres( nettes)?|gastos financieros( netos)?)$/],
  ["pbt", /^(profit before tax|vergi oncesi kar|ergebnis vor steuern|resultat avant impot|resultado antes de impuestos)$/],
  ["tax", /^(tax expense|income tax expense|vergi gideri|ertragsteuern|steuern vom einkommen und ertrag|impot sur les societes|impot sur le resultat|impuesto sobre beneficios)$/],
  ["netProfit", /^(net profit( for the period)?|profit for the period|donem net kari|net kar|jahresuberschuss|periodenergebnis|resultat net|resultado del ejercicio|resultado neto)$/],
  ["cash", /^(cash and cash equivalents|nakit ve nakit benzerleri|liquide mittel|tresorerie|efectivo y equivalentes)$/],
  ["receivables", /^(trade receivables|ticari alacaklar|forderungen aus lieferungen und leistungen|creances clients|deudores comerciales)$/],
  ["inventories", /^(inventories|stoklar|vorrate|stocks|existencias)$/],
  ["currentAssets", /^(total current assets|donen varliklar toplami|toplam donen varliklar|summe umlaufvermogen|total actif circulant|total activo corriente)$/],
  ["ppe", /^(property, plant and equipment(, net)?|maddi duran varliklar( net)?|sachanlagen|immobilisations corporelles|inmovilizado material)$/],
  ["totalAssets", /^(total assets|toplam varliklar|aktif toplami|summe aktiva|bilanzsumme|total actif|total activo)$/],
  ["payables", /^(trade payables|ticari borclar|verbindlichkeiten aus lieferungen und leistungen|dettes fournisseurs|acreedores comerciales)$/],
  ["stDebt", /^(short-term borrowings|kisa vadeli (finansal borclar|borclanmalar|krediler)|kurzfristige finanzverbindlichkeiten|emprunts a court terme|deudas a corto plazo)$/],
  ["currentLiabilities", /^(total current liabilities|kisa vadeli yukumlulukler toplami|toplam kisa vadeli yukumlulukler|summe kurzfristige verbindlichkeiten|total passif courant|total pasivo corriente)$/],
  ["ltDebt", /^(long-term borrowings|uzun vadeli (finansal borclar|borclanmalar|krediler)|langfristige finanzverbindlichkeiten|emprunts a long terme|deudas a largo plazo)$/],
  ["totalLiabilities", /^(total liabilities|yukumlulukler toplami|toplam yukumlulukler|summe verbindlichkeiten|total dettes|total pasivo)$/],
  ["equity", /^(total equity|ozkaynaklar toplami|toplam ozkaynaklar|summe eigenkapital|total capitaux propres|total patrimonio neto)$/],
  ["totalLE", /^(total liabilities and equity|toplam kaynaklar|pasif toplami|summe passiva|total passif|total patrimonio neto y pasivo)$/],
  ["cfo", /(net cash (from|generated from|used in) operating activities|faaliyetlerden saglanan net nakit|isletme faaliyetlerinden|cashflow aus (der )?laufenden geschaftstatigkeit|flux de tresorerie (lies a|provenant de) l'activite|flujos de efectivo de las actividades de explotacion)/],
  ["cfi", /(net cash (used in|from) investing activities|yatirimlarda kullanilan net nakit|yatirim faaliyetlerin|cashflow aus (der )?investitionstatigkeit|flux de tresorerie lies aux operations d'investissement|flujos de efectivo de las actividades de inversion)/],
  ["cff", /(net cash (from|used in) financing activities|finansmandan saglanan net nakit|finansman faaliyetlerin|cashflow aus (der )?finanzierungstatigkeit|flux de tresorerie lies aux operations de financement|flujos de efectivo de las actividades de financiacion)/],
  ["netChange", /^(net (increase|decrease|change) in cash|nakit ve nakit benzerlerindeki net (artis|azalis|degisim)|veranderung der liquiden mittel|variation de (la )?tresorerie|aumento neto de efectivo|variacion neta de efectivo)/],
  ["openingCash", /(at (the )?beginning of (the )?period|donem basi nakit|liquide mittel am anfang|tresorerie d'ouverture|efectivo al inicio)/],
  ["closingCash", /(at (the )?end of (the )?period|donem sonu nakit|liquide mittel am ende|tresorerie de cloture|efectivo al final)/],
];

const metricOf = (label: string): MetricKey | null => {
  const f = fold(label).replace(/\s+/g, " ").trim();
  return METRICS.find(([, re]) => re.test(f))?.[0] ?? null;
};

type Values = Partial<Record<MetricKey, (number | null)[]>>;

function metrics(t: ReportTable): Values {
  const out: Values = {};
  for (const r of t.rows) {
    const m = metricOf(r.label);
    if (m && !out[m]) out[m] = r.values;
  }
  return out;
}

const abs = (n: number | null | undefined) => (n == null ? null : Math.abs(n));
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** An "x = a ± b" identity, checked in every column where all parts are present. */
function identity(t: ReportTable, label: string, parts: { v?: (number | null)[]; sign: 1 | -1 }[], result: (number | null)[] | undefined, absolute = true): Check | null {
  // A budget report's variance column follows its own sign convention (higher expense = positive): skip it.
  const skip = t.kind === "budget" ? t.columns.findIndex((c) => /variance|fark|sapma/.test(fold(c))) : -1;
  if (!result || parts.some((p) => !p.v)) return null;
  const bad: string[] = [];
  let checked = 0;
  result.forEach((r, c) => {
    const vals = parts.map((p) => (absolute ? abs(p.v![c]) : p.v![c]));
    if (c === skip || r === null || vals.some((v) => v === null)) return;
    checked++;
    const expected = cents(vals.reduce((s, v, k) => s! + parts[k].sign * v!, 0)!);
    const got = absolute ? Math.abs(r) : r;
    if (!near(expected, got, Math.max(1, Math.abs(got) * 0.0005))) bad.push(`${t.columns[c]}: expected ${fmt(expected)}, printed ${fmt(got)}`);
  });
  if (!checked) return null;
  return { id: "line-math", status: bad.length ? "fail" : "pass", label: `${t.title}: ${label}`, detail: bad.length ? bad.join("; ") : `Holds in ${checked === 1 ? "the column" : `all ${checked} columns`}` };
}

const isSubtotal = (label: string) => {
  const f = fold(label);
  return /^(total|toplam|summe)\b|\btoplami$|^bilanzsumme$/.test(f) || /^net (cash|increase|decrease)|net nakit$|net (artis|azalis)$|^cashflow aus|^flux de tresorerie|^flujos de efectivo|^variation de (la )?tresorerie|^veranderung der liquiden|^aumento neto/.test(f);
};

/**
 * Generic subtotal check: a "Total …" row must equal the rows since the
 * previous total, or the previous total plus those rows, or the last two
 * totals together (Total liabilities and equity).
 */
function subtotals(t: ReportTable): Check | null {
  if (t.kind === "ratios" || t.kind === "budget" || t.kind === "ageing") return null;
  const bad: string[] = [];
  let ok = 0;
  const totals: (number | null)[][] = [];
  let since: ReportTable["rows"] = [];
  // A photo whose reader missed figures (rows with none at all): a sum over a missing cell can't
  // be checked either way, so those columns are skipped rather than failed.
  const gappy = t.rows.some((r) => r.values.every((v) => v === null));
  for (const r of t.rows) {
    if (!isSubtotal(r.label)) {
      since.push(r);
      continue;
    }
    const matches = r.values.map((v, c) => {
      if (v === null) return true;
      if (gappy && (since.some((x) => x.values[c] === null) || totals.some((x) => x[c] === null))) return null;
      const run = since.reduce((s, x) => s + (x.values[c] ?? 0), 0);
      const prev = totals.at(-1)?.[c] ?? null;
      const prev2 = totals.at(-2)?.[c] ?? null;
      const allTotals = totals.reduce((s2, x) => s2 + (x[c] ?? 0), 0);
      const candidates = [run, prev !== null ? prev + run : null, prev !== null && prev2 !== null && since.length === 0 ? prev + prev2 : null, totals.length >= 2 && since.length === 0 ? allTotals : null];
      return candidates.some((x) => x !== null && near(cents(x), v, Math.max(1, Math.abs(v) * 0.0005)));
    });
    if ((since.length || totals.length >= 2) && matches.some((m) => m !== null)) {
      if (matches.every((m) => m !== false)) ok++;
      else bad.push(`"${r.label}" does not equal the lines above it`);
    }
    totals.push(r.values);
    since = [];
  }
  if (!ok && !bad.length) return null;
  return { id: "items-sum", status: bad.length ? "fail" : "pass", label: `${t.title}: subtotals`, detail: bad.length ? bad.join("; ") : `${ok} subtotal${ok === 1 ? "" : "s"} add up` };
}

/** Budget reports: variance = actual − budget on every line. */
function variance(t: ReportTable): Check | null {
  const cols = t.columns.map((c) => fold(c));
  const b = cols.findIndex((c) => /budget|butce/.test(c));
  const a = cols.findIndex((c) => /actual|gerceklesen/.test(c));
  const v = cols.findIndex((c) => /variance|fark|sapma/.test(c));
  if (b < 0 || a < 0 || v < 0) return null;
  const bad = t.rows.filter((r) => r.values[b] !== null && r.values[a] !== null && r.values[v] !== null && !near(r.values[a]! - r.values[b]!, r.values[v]!, 1));
  return { id: "line-math", status: bad.length ? "fail" : "pass", label: `${t.title}: variance = actual − budget`, detail: bad.length ? bad.map((r) => r.label).join(", ") : `All ${t.rows.length} lines` };
}

/** Ageing schedules: each customer's total is the sum of its buckets, and the total row is the sum of the customers. */
function ageing(t: ReportTable): Check | null {
  const n = t.columns.length;
  if (n < 3) return null;
  const totalRow = t.rows.find((r) => /^(total|toplam)$/.test(fold(r.label)));
  const body = t.rows.filter((r) => r !== totalRow);
  const rowBad = body.filter((r) => !near(r.values.slice(0, -1).reduce((s: number, v) => s + (v ?? 0), 0), r.values[n - 1] ?? 0, 1));
  const colBad = totalRow ? totalRow.values.filter((v, c) => v !== null && !near(body.reduce((s, r) => s + (r.values[c] ?? 0), 0), v, 1)).length : 0;
  return {
    id: "items-sum",
    status: rowBad.length || colBad ? "fail" : "pass",
    label: `${t.title}: rows and columns add up`,
    detail: rowBad.length || colBad ? `${rowBad.map((r) => r.label).join(", ")}${colBad ? " · total row" : ""} off` : `${body.length} rows and the total row`,
  };
}

export type Ratio = { label: string; values: { column: string; value: number }[]; unit: "%" | "x" | "money" };

export type ReportAnalysis = {
  checks: Check[];
  ratios: Ratio[];
  /** Latest-period headline figures. */
  headline: { label: string; value: number; previous: number | null }[];
};

const last = (v?: (number | null)[]) => (v && v.length ? v[v.length - 1] : null);
const prevOf = (v?: (number | null)[]) => (v && v.length > 1 ? v[v.length - 2] : null);

export function analyseReport(r: Report): ReportAnalysis {
  const checks: Check[] = [];
  const byKind = (k: ReportTable["kind"]) => r.tables.filter((t) => t.kind === k);
  const income = byKind("income")[0];
  const balance = byKind("balance")[0];
  const cash = byKind("cashflow")[0];

  for (const t of r.tables) {
    const m = metrics(t);
    const add = (c: Check | null) => c && checks.push(c);
    if (t.kind === "income" || t.kind === "budget") {
      add(identity(t, "gross profit = sales − cost of sales", [{ v: m.revenue, sign: 1 }, { v: m.cogs, sign: -1 }], m.grossProfit));
      add(identity(t, "operating profit = gross profit − expenses − depreciation", [{ v: m.grossProfit, sign: 1 }, { v: m.opex, sign: -1 }, { v: m.depreciation, sign: -1 }], m.operatingProfit));
      add(identity(t, "profit before tax = operating profit − finance costs", [{ v: m.operatingProfit, sign: 1 }, { v: m.financeCosts, sign: -1 }], m.pbt));
      add(identity(t, "net profit = profit before tax − tax", [{ v: m.pbt, sign: 1 }, { v: m.tax, sign: -1 }], m.netProfit));
    }
    if (t.kind === "balance") add(identity(t, "assets = liabilities + equity", [{ v: m.totalLiabilities, sign: 1 }, { v: m.equity, sign: 1 }], m.totalAssets));
    if (t.kind === "cashflow") {
      add(identity(t, "operating + investing + financing = net change", [{ v: m.cfo, sign: 1 }, { v: m.cfi, sign: 1 }, { v: m.cff, sign: 1 }], m.netChange, false));
      add(identity(t, "opening cash + net change = closing cash", [{ v: m.openingCash, sign: 1 }, { v: m.netChange, sign: 1 }], m.closingCash, false));
    }
    if (t.kind === "budget") add(variance(t));
    if (t.kind === "ageing") add(ageing(t));
    add(subtotals(t));
  }

  // Across documents: the same figure must agree wherever it appears.
  const mi = income ? metrics(income) : {};
  const mb = balance ? metrics(balance) : {};
  const mc = cash ? metrics(cash) : {};
  const cross: [string, number | null, number | null][] = [
    ["Closing cash: cash flow statement = balance sheet", last(mc.closingCash), last(mb.cash)],
    ["Opening cash: cash flow statement = balance sheet", last(mc.openingCash), prevOf(mb.cash)],
    ["Net profit: income statement = cash flow statement", last(mi.netProfit), last(mc.netProfit)],
  ];
  const ageingTotal = byKind("ageing")[0]?.rows.find((x) => /^(total|toplam)$/.test(fold(x.label)));
  if (ageingTotal) cross.push(["Receivables: ageing schedule = balance sheet", last(ageingTotal.values), last(mb.receivables)]);
  for (const [label, a, b] of cross) {
    if (a === null || b === null) continue;
    checks.push({ id: "subtotal-vat-total", status: near(a, b, 1) ? "pass" : "fail", label, detail: near(a, b, 1) ? `${fmt(a)} in both` : `${fmt(a)} vs ${fmt(b)}` });
  }

  // Ratios, per column of the statements they come from.
  const ratios: Ratio[] = [];
  const ratio = (label: string, unit: Ratio["unit"], t: ReportTable | undefined, f: (c: number) => number | null) => {
    if (!t) return;
    const values = t.columns.map((column, c) => ({ column, value: f(c) })).filter((x): x is { column: string; value: number } => x.value !== null && Number.isFinite(x.value));
    if (values.length) ratios.push({ label, unit, values: values.map((v) => ({ ...v, value: Math.round(v.value * 10) / 10 })) });
  };
  const at = (v: (number | null)[] | undefined, c: number) => (v ? abs(v[c]) : null);
  const pct = (a: number | null, b: number | null) => (a !== null && b ? (a / b) * 100 : null);
  ratio("Gross margin", "%", income, (c) => pct(at(mi.grossProfit, c), at(mi.revenue, c)));
  ratio("Operating margin", "%", income, (c) => pct(at(mi.operatingProfit, c), at(mi.revenue, c)));
  ratio("Net margin", "%", income, (c) => pct(at(mi.netProfit, c), at(mi.revenue, c)));
  ratio("Effective tax rate", "%", income, (c) => pct(at(mi.tax, c), at(mi.pbt, c)));
  ratio("Current ratio", "x", balance, (c) => (at(mb.currentAssets, c) !== null && at(mb.currentLiabilities, c) ? at(mb.currentAssets, c)! / at(mb.currentLiabilities, c)! : null));
  ratio("Quick ratio", "x", balance, (c) =>
    at(mb.currentAssets, c) !== null && at(mb.inventories, c) !== null && at(mb.currentLiabilities, c) ? (at(mb.currentAssets, c)! - at(mb.inventories, c)!) / at(mb.currentLiabilities, c)! : null,
  );
  ratio("Debt to equity", "x", balance, (c) => {
    const debt = (at(mb.stDebt, c) ?? 0) + (at(mb.ltDebt, c) ?? 0);
    return debt && at(mb.equity, c) ? debt / at(mb.equity, c)! : null;
  });
  ratio("Net debt", "money", balance, (c) => {
    const debt = (at(mb.stDebt, c) ?? 0) + (at(mb.ltDebt, c) ?? 0);
    return debt && at(mb.cash, c) !== null ? debt - at(mb.cash, c)! : null;
  });
  ratio("Equity ratio", "%", balance, (c) => pct(at(mb.equity, c), at(mb.totalAssets, c)));
  const overdue = byKind("ageing")[0];
  if (overdue && ageingTotal && overdue.columns.length >= 3) {
    const v = ageingTotal.values;
    const total = v[v.length - 1];
    const notDue = v[0];
    if (total && notDue !== null) ratios.push({ label: "Overdue receivables", unit: "%", values: [{ column: overdue.columns.at(-1) ?? "Total", value: Math.round(((total - notDue) / total) * 1000) / 10 }] });
  }

  const headline: ReportAnalysis["headline"] = [];
  const head = (label: string, v?: (number | null)[]) => {
    const value = last(v);
    if (value !== null) headline.push({ label, value, previous: prevOf(v) });
  };
  head("Revenue", mi.revenue);
  head("Net profit", mi.netProfit);
  head("Total assets", mb.totalAssets);
  head("Cash", mb.cash ?? mc.closingCash);
  head("Operating cash flow", mc.cfo);

  return { checks, ratios, headline };
}

/** How report-like a document is: rows that name statement line items. */
export function reportScore(lines: OcrLine[]): number {
  const decimal = detectDecimal(lines.map((l) => l.text).join("\n"));
  return lines.filter((l) => {
    const r = splitRow(l.text, decimal);
    return r.values.length > 0 && metricOf(r.label) !== null;
  }).length;
}
