import type { Box, OcrLine } from "./types";

export type OcrWord = {
  text: string;
  bbox: Box;
  confidence: number;
  /** Index of the OCR engine's own text line, used to measure how tilted the page is. */
  ln?: number;
};

type EngineBlock = { paragraphs: { lines: { words: { text: string; bbox: Box; confidence: number }[] }[] }[] };

/** Flattens the OCR engine's blocks into words, numbering its lines as it goes. */
export function wordsFromBlocks(blocks: EngineBlock[]): OcrWord[] {
  const out: OcrWord[] = [];
  let ln = 0;
  for (const b of blocks)
    for (const p of b.paragraphs)
      for (const l of p.lines) {
        for (const w of l.words) out.push({ text: w.text, bbox: w.bbox, confidence: Math.round(w.confidence), ln });
        ln++;
      }
  return out;
}

/**
 * Page tilt as a slope (dy per dx), from the OCR engine's own lines: the median
 * slope between the first and last word of every line with three or more words.
 * A phone photo taken at a slight angle is typically 0.02–0.08.
 */
export function estimateSkew(words: OcrWord[]): number {
  const byLine = new Map<number, OcrWord[]>();
  for (const w of words) if (w.ln !== undefined) byLine.set(w.ln, [...(byLine.get(w.ln) ?? []), w]);
  const slopes: number[] = [];
  for (const ws of byLine.values()) {
    if (ws.length < 3) continue;
    const sorted = [...ws].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const [a, b] = [sorted[0].bbox, sorted.at(-1)!.bbox];
    const dx = (b.x0 + b.x1) / 2 - (a.x0 + a.x1) / 2;
    if (dx > 50) slopes.push(((b.y0 + b.y1) / 2 - (a.y0 + a.y1) / 2) / dx);
  }
  if (!slopes.length) return 0;
  slopes.sort((x, y) => x - y);
  return slopes[Math.floor(slopes.length / 2)];
}

/** Letter-spaced headings come out of PDFs as "R E C H N U N G"; put the word back together. */
export const collapseSpacedCaps = (text: string) =>
  text.replace(/(?<!\p{L})(?:\p{Lu} ){2,}\p{Lu}(?!\p{L})/gu, (m) => m.replace(/ /g, ""));

const center = (b: Box) => (b.y0 + b.y1) / 2;
const height = (b: Box) => b.y1 - b.y0;

/**
 * Rebuilds visual rows from OCR words. Tesseract reads a two-column invoice as
 * separate blocks, so "Subtotal" and its amount can end up far apart; grouping
 * words by their vertical position puts every label next to its value again.
 */
export function wordsToLines(words: OcrWord[], page = 0): OcrLine[] {
  const clean = words.filter((w) => w.text.trim() && height(w.bbox) > 0);
  // Straighten a tilted photo before grouping: compare heights as if the page were level.
  const skew = estimateSkew(clean);
  const mid = (b: Box) => center(b) - ((b.x0 + b.x1) / 2) * skew;
  // The OCR engine sometimes gives a word in a photo a box two or three lines
  // tall; grouped by its middle it would pull the line below into this one
  // ("18 luglio 2026" + "17 agosto 2026"). Such words join the row that holds
  // the rest of their own OCR line instead.
  const heights = clean.map((w) => height(w.bbox)).sort((a, b) => a - b);
  const typical = heights[Math.floor(heights.length / 2)] ?? 0;
  const tall = (w: OcrWord) => w.ln !== undefined && height(w.bbox) > typical * 1.8;
  const sorted = [...clean].sort((a, b) => mid(a.bbox) - mid(b.bbox));
  const rows: { words: OcrWord[]; mid: number; h: number }[] = [];
  const add = (w: OcrWord) => {
    const h = height(w.bbox);
    const row = rows.find((r) => Math.abs(r.mid - mid(w.bbox)) < Math.min(r.h, h) * 0.5);
    if (row) {
      row.words.push(w);
      row.mid = (row.mid * (row.words.length - 1) + mid(w.bbox)) / row.words.length;
      row.h = Math.max(row.h, h);
    } else rows.push({ words: [w], mid: mid(w.bbox), h });
  };
  for (const w of sorted) if (!tall(w)) add(w);
  const xMid = (b: Box) => (b.x0 + b.x1) / 2;
  for (const w of sorted) {
    if (!tall(w)) continue;
    const top = w.bbox.y0 - ((w.bbox.x0 + w.bbox.x1) / 2) * skew;
    const bottom = top + height(w.bbox);
    let best: { row: (typeof rows)[number]; dist: number } | null = null;
    for (const row of rows) {
      if (row.mid < top || row.mid > bottom) continue;
      const kin = row.words.filter((o) => o.ln === w.ln && !tall(o));
      if (!kin.length) continue;
      const dist = Math.min(...kin.map((o) => Math.abs(xMid(o.bbox) - xMid(w.bbox))));
      if (!best || dist < best.dist) best = { row, dist };
    }
    if (best) best.row.words.push(w);
    else add(w);
  }
  return rows
    .sort((a, b) => a.mid - b.mid)
    .map((r) => {
      const ws = r.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      // PDF text runs can split a word ("Ka" + "ff" + "ee"): only a visible gap means a space.
      // A wide gap between columns becomes two spaces, so "10  249,00  2 490,00" keeps the
      // quantity, the price and a space-grouped amount apart.
      const text = ws.reduce((acc, w, i) => {
        if (i === 0) return w.text;
        const gap = w.bbox.x0 - ws[i - 1].bbox.x1;
        return acc + (gap > r.h * 1.1 ? "  " : gap > r.h * 0.12 ? " " : "") + w.text;
      }, "");
      return {
        text: collapseSpacedCaps(text),
        bbox: {
          x0: Math.min(...ws.map((w) => w.bbox.x0)),
          y0: Math.min(...ws.map((w) => w.bbox.y0)),
          x1: Math.max(...ws.map((w) => w.bbox.x1)),
          y1: Math.max(...ws.map((w) => w.bbox.y1)),
        },
        page,
        confidence: Math.round(ws.reduce((s, w) => s + w.confidence, 0) / ws.length),
      };
    });
}
