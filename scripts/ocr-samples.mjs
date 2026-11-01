// Runs the same OCR engine the app uses (tesseract.js) on the sample images and
// stores the recognised words, so the demo opens with real results instantly.
// Usage: node scripts/ocr-samples.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createWorker } from "tesseract.js";

const SAMPLES = ["halcyon", "brauer", "kuzey", "ridgeline", "kettle", "northshore"];
const out = new URL("../src/data/ocr/", import.meta.url);
mkdirSync(out, { recursive: true });

const worker = await createWorker("eng+deu+tur");
for (const name of SAMPLES) {
  const file = new URL(`../public/samples/${name}.png`, import.meta.url).pathname;
  const { data } = await worker.recognize(file, {}, { blocks: true });
  // Same flattening as src/lib/layout.ts wordsFromBlocks: words with their OCR line number.
  const words = [];
  let ln = 0;
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs)
      for (const l of p.lines) {
        for (const w of l.words) words.push({ text: w.text, bbox: w.bbox, confidence: Math.round(w.confidence), ln });
        ln++;
      }
  writeFileSync(new URL(`${name}.json`, out), JSON.stringify({ words }) + "\n");
  console.log(`${name}: ${words.length} words, mean confidence ${Math.round(data.confidence)}`);
}
await worker.terminate();
