// Renders corpus/html/*.html to text PDFs, page images, and for every third
// document a degraded "phone photo" (tilt, blur, shadow, JPEG). Uses Playwright's Chromium.
// Usage: node scripts/corpus/render.mjs
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const root = new URL("../../corpus/", import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(`${root}truth.json`, "utf8"));
for (const d of ["pdf", "png"]) mkdirSync(`${root}${d}`, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
for (const doc of manifest) {
  await page.setViewportSize({ width: doc.width, height: doc.height });
  await page.goto(`file://${root}html/${doc.name}.html`);
  await page.pdf({ path: `${root}pdf/${doc.name}.pdf`, width: `${doc.width}px`, height: `${doc.height}px`, printBackground: true });
  await page.screenshot({ path: `${root}png/${doc.name}.png` });
}
await browser.close();
execFileSync("python3", [new URL("./photos.py", import.meta.url).pathname, root], { stdio: "inherit" });
console.log(`rendered ${manifest.length} documents`);
