// Evaluation over the generated corpus (corpus/truth.json): every document is
// read three ways (text PDF, page image through OCR, phone photo through OCR)
// and every field is compared with the ground truth. Writes corpus/REPORT.md.
// Run: npm run eval
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { classifyDocument } from "@/lib/classify";
import { extractInvoice } from "@/lib/extract";
import { wordsToLines, type OcrWord } from "@/lib/layout";
import { cents, near } from "@/lib/numbers";
import { chronological, extractStatement, validateStatement } from "@/lib/statement";
import { analyseReport, extractReport } from "@/lib/report";
import { validateInvoice } from "@/lib/validate";

type Truth = Record<string, unknown> & { kind: string; lang?: string; locale?: string; layout: string };
type Entry = { name: string; width: number; height: number; truth: Truth };

const ROOT = "corpus/";
const manifest = JSON.parse(readFileSync(`${ROOT}truth.json`, "utf8")) as Entry[];

async function pdfWords(path: string): Promise<OcrWord[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 }).promise;
  const words: OcrWord[] = [];
  let offset = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const content = await page.getTextContent();
    for (const item of content.items as { str: string; transform: number[]; width: number }[]) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [a, b, , , e, f] = pdfjs.Util.transform(viewport.transform, item.transform);
      const size = Math.hypot(a, b);
      words.push({ text: item.str.trim(), bbox: { x0: e, y0: offset + f - size, x1: e + item.width * 2, y1: offset + f + size * 0.2 }, confidence: 100 });
    }
    offset += viewport.height;
  }
  return words;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]/gu, "");

type Score = Record<string, boolean>;

/** Similarity of two names, 0–1 (Levenshtein): OCR may misread one letter of "Kuzeyrüzgarı". */
function similar(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
}

function scoreInvoice(t: Truth, lines: ReturnType<typeof wordsToLines>): { score: Score; got: Record<string, unknown> } {
  const type = classifyDocument(lines).type;
  const inv = extractInvoice(lines);
  const failed = validateInvoice(inv).filter((c) => c.status === "fail");
  const vatGot = inv.vat.map((v) => v.amount).sort((a, b) => a - b);
  const vatWant = (t.vat as { amount: number }[]).map((v) => v.amount).sort((a, b) => a - b);
  const itemsGot = inv.items.map((i) => i.amount).sort((a, b) => a - b);
  const itemsWant = (t.items as { amount: number }[]).map((i) => i.amount).sort((a, b) => a - b);
  const score: Score = {
    type: type === "invoice" || type === "receipt",
    // OCR can misread a letter or two in a name; the reviewer fixes that in a second, so 85% similar counts.
    vendor: !!inv.vendor.value && (norm(inv.vendor.value).includes(norm(t.vendor)) || norm(t.vendor).includes(norm(inv.vendor.value)) || similar(inv.vendor.value, String(t.vendor)) >= 0.85),
    date: inv.date.value === t.date,
    currency: inv.currency.value === t.currency,
    total: inv.total.value !== null && near(inv.total.value, t.total as number, 0.011),
    vat: vatGot.length === vatWant.length && vatGot.every((v, k) => near(v, vatWant[k], 0.011)),
    items: itemsGot.length === itemsWant.length && itemsGot.every((v, k) => near(v, itemsWant[k], 0.011)),
    "no false alarm": failed.length === 0,
  };
  if (t.kind === "invoice") {
    score.number = norm(inv.invoiceNumber.value) === norm(t.number);
    score.due = inv.dueDate.value === t.due;
    score.subtotal = inv.subtotal.value !== null && near(inv.subtotal.value, t.subtotal as number, 0.011);
  }
  return {
    score,
    got: { type, vendor: inv.vendor.value, number: inv.invoiceNumber.value, date: inv.date.value, due: inv.dueDate.value, currency: inv.currency.value, subtotal: inv.subtotal.value, total: inv.total.value, vat: vatGot, items: itemsGot, failed: failed.map((c) => c.label) },
  };
}

function scoreStatement(t: Truth, lines: ReturnType<typeof wordsToLines>) {
  const type = classifyDocument(lines).type;
  const s = extractStatement(lines);
  const tx = chronological(s);
  const want = t.transactions as { date: string; amount: number }[];
  const score: Score = {
    type: type === "statement",
    "transaction count": tx.length === want.length,
    amounts: tx.length === want.length && tx.every((x, k) => near(x.amount, want[k].amount, 0.011)),
    dates: tx.length === want.length && tx.every((x, k) => x.date === want[k].date),
    "no false alarm": validateStatement(s).every((c) => c.status !== "fail"),
  };
  return { score, got: { type, n: tx.length, amounts: tx.map((x) => cents(x.amount)), dates: tx.map((x) => x.date), checks: validateStatement(s).filter((c) => c.status === "fail").map((c) => c.detail) } };
}

function scoreReport(t: Truth, lines: ReturnType<typeof wordsToLines>) {
  const type = classifyDocument(lines).type;
  const r = extractReport(lines);
  const a = analyseReport(r);
  const failed = a.checks.filter((c) => c.status === "fail").map((c) => c.label);
  const kinds: string[] = r.tables.map((x) => x.kind);
  const score: Score = {
    type: type === "report",
    tables: (t.kinds as string[]).every((k) => kinds.includes(k)),
    "net profit": a.headline.find((h) => h.label === "Net profit")?.value === t.net_profit,
    checks: t.broken ? failed.some((l) => /assets = liabilities \+ equity|subtotals/.test(l)) : failed.length === 0,
  };
  return { score, got: { type, kinds, netProfit: a.headline.find((h) => h.label === "Net profit")?.value ?? null, failed } };
}

describe("corpus", () => {
  it("scores every document", async () => {
    const rows: { name: string; source: string; kind: string; lang: string; score: Score; got: Record<string, unknown>; truth: Truth }[] = [];
    for (const e of manifest) {
      const sources: [string, () => Promise<OcrWord[]> | OcrWord[] | null][] = [
        ["pdf", () => pdfWords(`${ROOT}pdf/${e.name}.pdf`)],
        ["image", () => (existsSync(`${ROOT}ocr/png-${e.name}.json`) ? JSON.parse(readFileSync(`${ROOT}ocr/png-${e.name}.json`, "utf8")).words : null)],
        ["photo", () => (existsSync(`${ROOT}ocr/photo-${e.name}.json`) ? JSON.parse(readFileSync(`${ROOT}ocr/photo-${e.name}.json`, "utf8")).words : null)],
      ];
      for (const [source, load] of sources) {
        // Multi-page documents are only read from the PDF; the page images show page 1.
        if (e.truth.pdf_only && source !== "pdf") continue;
        const words = await load();
        if (!words) continue;
        const lines = wordsToLines(words);
        const t = e.truth;
        const result =
          t.kind === "report"
            ? scoreReport(t, lines)
            : t.kind === "statement"
            ? scoreStatement(t, lines)
            : t.kind === "reject"
              ? { score: { type: classifyDocument(lines).type === "unknown" }, got: { type: classifyDocument(lines).type } }
              : scoreInvoice(t, lines);
        rows.push({ name: e.name, source, kind: t.kind, lang: t.locale ?? t.lang ?? "-", ...result, truth: t });
      }
    }

    // Accuracy per kind, source and field.
    const out: string[] = ["# Corpus evaluation", "", `Documents: ${manifest.length} · readings: ${rows.length}`, ""];
    const fieldTable = (kind: string) => {
      const sel = rows.filter((r) => r.kind === kind);
      if (!sel.length) return;
      const fields = [...new Set(sel.flatMap((r) => Object.keys(r.score)))];
      out.push(`## ${kind}`, "", `| source | n | ${fields.join(" | ")} | all fields |`, `| --- | --- | ${fields.map(() => "---").join(" | ")} | --- |`);
      for (const source of ["pdf", "image", "photo"]) {
        const s = sel.filter((r) => r.source === source);
        if (!s.length) continue;
        const pct = (f: string) => {
          const has = s.filter((r) => f in r.score);
          return has.length ? `${Math.round((has.filter((r) => r.score[f]).length / has.length) * 100)}%` : "–";
        };
        const all = Math.round((s.filter((r) => Object.values(r.score).every(Boolean)).length / s.length) * 100);
        out.push(`| ${source} | ${s.length} | ${fields.map(pct).join(" | ")} | ${all}% |`);
      }
      out.push("");
    };
    ["invoice", "receipt", "statement", "report", "reject"].forEach(fieldTable);

    out.push("## Failures", "");
    for (const r of rows.filter((r) => !Object.values(r.score).every(Boolean))) {
      const bad = Object.entries(r.score).filter(([, ok]) => !ok).map(([f]) => f);
      out.push(`- **${r.name}** (${r.source}): ${bad.join(", ")}`);
      const t = r.truth;
      const want =
        r.kind === "report"
          ? { type: "report", kinds: t.kinds, netProfit: t.net_profit, failed: t.broken ? ["(a balance check)"] : [] }
          : r.kind === "statement"
          ? { n: (t.transactions as unknown[]).length, amounts: (t.transactions as { amount: number }[]).map((x) => x.amount), dates: (t.transactions as { date: string }[]).map((x) => x.date) }
          : r.kind === "reject"
            ? { type: "unknown" }
            : { vendor: t.vendor, number: t.number, date: t.date, due: t.due, currency: t.currency, subtotal: t.subtotal, total: t.total, vat: (t.vat as { amount: number }[]).map((v) => v.amount).sort((a, b) => a - b), items: (t.items as { amount: number }[]).map((i) => i.amount).sort((a, b) => a - b) };
      for (const f of Object.keys(want)) {
        const g = (r.got as Record<string, unknown>)[f];
        const w = (want as Record<string, unknown>)[f];
        if (JSON.stringify(g) !== JSON.stringify(w)) out.push(`  - ${f}: got \`${JSON.stringify(g)}\`, want \`${JSON.stringify(w)}\``);
      }
      if ((r.got as { failed?: string[] }).failed?.length) out.push(`  - failed checks: ${(r.got as { failed: string[] }).failed.join("; ")}`);
    }
    writeFileSync(`${ROOT}REPORT.md`, out.join("\n") + "\n");
    console.log(out.slice(0, out.indexOf("## Failures")).join("\n"));
    expect(rows.length).toBeGreaterThan(0);
  }, 600_000);
});
