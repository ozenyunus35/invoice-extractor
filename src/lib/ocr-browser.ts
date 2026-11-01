"use client";

import { wordsFromBlocks, type OcrWord } from "./layout";

export type Progress = { stage: string; value: number };

export type Scan = {
  words: OcrWord[];
  /** The document as one image (PDF pages stacked), for the viewer and for saving. */
  image: Blob;
  width: number;
  height: number;
  source: "ocr" | "pdf-text";
  /** Something the reviewer should know about how the file was read. */
  note?: string;
};

/** A problem with the file itself, worded for the person who uploaded it. */
export class FileProblem extends Error {}

const MAX_BYTES = 50 * 1024 ** 2;
/** Longest side an image is OCR'd at: larger photos are scaled down, which reads just as well and much faster. */
const MAX_IMAGE_SIDE = 3200;

/** Text PDFs are read in full up to this many pages; scans are OCR'd up to OCR_PAGES. */
const MAX_PAGES = 20;
const OCR_PAGES = 6;
/** The stacked page image stays under ~16 million pixels, which every browser can draw. */
const MAX_PIXELS = 16_000_000;

/** Runs tesseract.js in a Web Worker. The engine and language data load from a CDN on first use. */
async function recognize(image: HTMLCanvasElement | Blob, onProgress: (p: Progress) => void): Promise<OcrWord[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng+deu+tur", undefined, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress({ stage: "Reading text", value: 0.3 + m.progress * 0.7 });
      else if (/load|initializ/.test(m.status)) onProgress({ stage: "Loading OCR engine", value: Math.min(0.3, m.progress * 0.3) });
    },
  });
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    return wordsFromBlocks(data.blocks ?? []);
  } finally {
    await worker.terminate();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render the page"))), "image/png"));
}

async function scanImage(file: File, onProgress: (p: Progress) => void): Promise<Scan> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new FileProblem(/\.(heic|heif|tiff?)$/i.test(file.name) ? "Browsers can't open HEIC or TIFF images. Export the photo as JPG or PNG and try again." : "This image could not be opened. It may be damaged or in a format browsers don't support.");
  }
  const { width, height } = bitmap;
  if (width < 200 || height < 200) {
    bitmap.close();
    throw new FileProblem("This image is too small to read. Use a photo or scan at least 1000 pixels wide.");
  }
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  if (scale === 1) {
    bitmap.close();
    return { words: await recognize(file, onProgress), image: file, width, height, source: "ocr" };
  }
  // A 48-megapixel phone photo: read a scaled copy, which is just as legible and far quicker.
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const image = await canvasToBlob(canvas);
  return { words: await recognize(canvas, onProgress), image, width: canvas.width, height: canvas.height, source: "ocr" };
}

/**
 * Renders up to four PDF pages into one tall canvas. When the PDF has a text
 * layer, its words are used directly (exact and instant); scanned PDFs go
 * through OCR like an image.
 */
async function scanPdf(file: File, onProgress: (p: Progress) => void): Promise<Scan> {
  onProgress({ stage: "Opening PDF", value: 0.05 });
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "PasswordException") throw new FileProblem("This PDF is password-protected. Save a copy without the password and try again.");
    throw new FileProblem("This file is not a valid PDF, or it is damaged.");
  }
  const note = pdf.numPages > MAX_PAGES ? `Read the first ${MAX_PAGES} of ${pdf.numPages} pages` : undefined;
  const pages = await Promise.all(Array.from({ length: Math.min(pdf.numPages, MAX_PAGES) }, (_, i) => pdf.getPage(i + 1)));
  // Sharp at 2× for a few pages; long reports scale down so the stacked image stays drawable.
  const area = pages.reduce((sum, p) => {
    const v = p.getViewport({ scale: 1 });
    return sum + v.width * v.height;
  }, 0);
  const scale = Math.max(0.8, Math.min(2, Math.sqrt(MAX_PIXELS / area)));
  const viewports = pages.map((p) => p.getViewport({ scale }));
  const width = Math.ceil(Math.max(...viewports.map((v) => v.width)));
  const height = Math.ceil(viewports.reduce((s, v) => s + v.height, 0));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  const words: OcrWord[] = [];
  let offset = 0;
  for (const [i, page] of pages.entries()) {
    const viewport = viewports[i];
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);
    await page.render({ canvas: pageCanvas, canvasContext: pageCanvas.getContext("2d")!, viewport }).promise;
    ctx.drawImage(pageCanvas, 0, offset);

    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const [a, b, , , e, f] = pdfjs.Util.transform(viewport.transform, item.transform);
      const size = Math.hypot(a, b);
      // A text run can hold several words; keep it as one, the row builder joins runs anyway.
      words.push({ text: item.str.trim(), bbox: { x0: e, y0: offset + f - size, x1: e + item.width * scale, y1: offset + f + size * 0.2 }, confidence: 100 });
    }
    offset += viewport.height;
    onProgress({ stage: "Rendering pages", value: 0.05 + ((i + 1) / pages.length) * 0.2 });
  }

  const image = await canvasToBlob(canvas);
  if (words.length >= 10) return { words, image, width, height, source: "pdf-text", note };
  // A scan: OCR the first pages (each takes a few seconds in the browser).
  let target: HTMLCanvasElement = canvas;
  if (pages.length > OCR_PAGES) {
    const cut = Math.ceil(viewports.slice(0, OCR_PAGES).reduce((sum, v) => sum + v.height, 0));
    target = document.createElement("canvas");
    target.width = width;
    target.height = cut;
    target.getContext("2d")!.drawImage(canvas, 0, 0);
  }
  const ocrNote = pages.length > OCR_PAGES ? `Scanned PDF: read the first ${OCR_PAGES} of ${pdf.numPages} pages` : note;
  return { words: await recognize(target, onProgress), image, width, height, source: "ocr", note: ocrNote };
}

export function scanFile(file: File, onProgress: (p: Progress) => void): Promise<Scan> {
  if (file.size === 0) return Promise.reject(new FileProblem("This file is empty."));
  if (file.size > MAX_BYTES) return Promise.reject(new FileProblem("Files up to 50 MB are supported."));
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return scanPdf(file, onProgress);
  if (file.type.startsWith("image/")) return scanImage(file, onProgress);
  return Promise.reject(new FileProblem("Use a PDF or an image (PNG, JPG, WebP). Word, Excel and other files aren't read."));
}

/** Re-runs OCR on an image already on the page, e.g. a sample. */
export async function rescanUrl(url: string, onProgress: (p: Progress) => void): Promise<OcrWord[]> {
  const blob = await (await fetch(url)).blob();
  return recognize(blob, onProgress);
}
