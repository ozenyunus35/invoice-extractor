// OCRs the corpus page images and photos with the engine the app uses, caching
// the words in corpus/ocr/ so the evaluation runs in seconds.
// Usage: node scripts/corpus/ocr.mjs [--force]
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createWorker } from "tesseract.js";

const root = new URL("../../corpus/", import.meta.url).pathname;
const force = process.argv.includes("--force");
mkdirSync(`${root}ocr`, { recursive: true });

const jobs = [];
for (const [dir, ext] of [["png", ".png"], ["photo", ".jpg"]]) {
  for (const f of readdirSync(`${root}${dir}`).filter((f) => f.endsWith(ext))) {
    const out = `${root}ocr/${dir}-${f.replace(ext, ".json")}`;
    if (force || !existsSync(out)) jobs.push({ file: `${root}${dir}/${f}`, out });
  }
}

const worker = await createWorker("eng+deu+tur+fra+spa+ita+nld+por+pol");
let done = 0;
for (const job of jobs) {
  const { data } = await worker.recognize(job.file, {}, { blocks: true });
  // Same flattening as src/lib/layout.ts wordsFromBlocks.
  const words = [];
  let ln = 0;
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs)
      for (const l of p.lines) {
        for (const w of l.words) words.push({ text: w.text, bbox: w.bbox, confidence: Math.round(w.confidence), ln });
        ln++;
      }
  writeFileSync(job.out, JSON.stringify({ words }));
  if (++done % 10 === 0) console.log(`${done}/${jobs.length}`);
}
await worker.terminate();
console.log(`OCR done: ${jobs.length} files`);
