// Reads the corpus page images and photos through the app itself, in Chromium,
// so the evaluation measures exactly what a visitor gets: the same clean-up,
// language detection, straightening and OCR (window.__tallyScan).
// Needs the static build served: npm run build && npm run serve.
// Usage: node scripts/corpus/ocr-browser.mjs [--force] [--only=name,name]
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const root = new URL("../../corpus/", import.meta.url).pathname;
const base = process.env.BASE_URL ?? "http://localhost:4173/invoice-extractor/";
const force = process.argv.includes("--force");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
mkdirSync(`${root}ocr`, { recursive: true });

const jobs = [];
for (const [dir, ext, type] of [["png", ".png", "image/png"], ["photo", ".jpg", "image/jpeg"], ["office", "", ""]]) {
  if (!existsSync(`${root}${dir}`)) continue;
  for (const f of readdirSync(`${root}${dir}`).filter((f) => f.endsWith(ext))) {
    if (only && !only.some((o) => f.startsWith(o))) continue;
    // Office files keep their extension in the cache name: office-inv-de-multi-vat.docx.json
    const out = `${root}ocr/${dir}-${ext ? f.replace(ext, ".json") : `${f}.json`}`;
    if (force || only || !existsSync(out)) jobs.push({ file: `${root}${dir}/${f}`, name: f, type, out });
  }
}

// Photos under named conditions (dark, blur, upside down…): corpus/conditions/<condition>/<name>.jpg
if (existsSync(`${root}conditions`)) {
  for (const cond of readdirSync(`${root}conditions`)) {
    for (const f of readdirSync(`${root}conditions/${cond}`).filter((f) => f.endsWith(".jpg"))) {
      const out = `${root}ocr/cond-${cond}-${f.replace(".jpg", ".json")}`;
      if (only && !only.some((o) => `cond-${cond}-${f}`.startsWith(o))) continue;
      if (force || only || !existsSync(out)) jobs.push({ file: `${root}conditions/${cond}/${f}`, name: f, type: "image/jpeg", out });
    }
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base);
await page.waitForFunction(() => "__tallyScan" in window);
let done = 0;
for (const job of jobs) {
  const b64 = readFileSync(job.file).toString("base64");
  const scan = await page.evaluate(async ({ b64, name, type }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    try {
      const s = await window.__tallyScan(new File([bytes], name, { type }));
      return { words: s.words, width: s.width, height: s.height, note: s.note ?? null };
    } catch (err) {
      return { words: [], error: String(err?.message ?? err) };
    }
  }, { b64, name: job.name, type: job.type });
  if (scan.error) console.log(`${job.name}: ${scan.error}`);
  writeFileSync(job.out, JSON.stringify(scan));
  if (++done % 10 === 0) console.log(`${done}/${jobs.length}`);
}
await browser.close();
console.log(`browser OCR done: ${jobs.length} files`);
