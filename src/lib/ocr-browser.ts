"use client";

import { estimateSkew, wordsFromBlocks, type OcrWord } from "./layout";
import { extractContent, isEncryptedOffice, sniff, zipEntries, type Extracted, type Sniffed } from "./office";
import { crop, flatten, looksLikePhoto, paperBox, sharpen, type Pixels } from "./preprocess";

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

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

/** Workers stay alive between files, one per language set, so the second upload starts at once. */
const workers = new Map<string, Promise<TesseractWorker>>();
let report: (p: Progress) => void = () => {};

function workerFor(langs: string): Promise<TesseractWorker> {
  let w = workers.get(langs);
  if (!w) {
    w = import("tesseract.js").then(({ createWorker }) =>
      createWorker(langs, undefined, {
        logger: (m) => {
          if (m.status === "recognizing text") report({ stage: "Reading text", value: m.progress });
          else if (/load|initializ/.test(m.status)) report({ stage: "Loading OCR engine", value: m.progress });
        },
      }),
    );
    workers.set(langs, w);
  }
  return w;
}

/** Runs tesseract.js in a Web Worker. The engine and language data load from a CDN on first use. */
async function recognize(image: HTMLCanvasElement | Blob, langs = "eng"): Promise<OcrWord[]> {
  const worker = await workerFor(langs);
  const { data } = await worker.recognize(image, {}, { blocks: true });
  return wordsFromBlocks(data.blocks ?? []);
}

/** Language markers in folded OCR text; the model for the document's language reads its accents and labels. */
const LANGUAGE_HINTS: [string, RegExp][] = [
  ["tur", /\b(fatura|tutar|toplam|kdv|tarih|adet|fis|odeme|tesekkur)\b|[şğı]/],
  ["deu", /\b(rechnung|betrag|mwst|summe|gesamt|datum|menge|kassenbon|danke)\b|[äöüß]/],
  ["fra", /\b(facture|montant|tva|ttc|date|merci|quantite|designation)\b|[éèàç]/],
  ["spa", /\b(factura|importe|iva|fecha|gracias|cantidad|descripcion)\b|ñ/],
  ["ita", /\b(fattura|importo|totale|scontrino|grazie|quantita|descrizione)\b/],
  ["por", /\b(fatura|valor|obrigado|quantidade|descricao|talao)\b|[ãõ]/],
  ["nld", /\b(factuur|bedrag|btw|totaal|bedankt|aantal|omschrijving)\b/],
  ["pol", /\b(faktura|wartosc|razem|zaplaty|paragon|ilosc|dziekujemy)\b|[łżźąęśń]/],
];

function guessLanguage(words: OcrWord[]): string | null {
  const text = words.map((w) => w.text.toLowerCase()).join(" ");
  const plain = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  let best: [string, number] | null = null;
  for (const [code, re] of LANGUAGE_HINTS) {
    const hits = (text.match(new RegExp(re.source, "g"))?.length ?? 0) + (plain.match(new RegExp(re.source, "g"))?.length ?? 0);
    if (hits >= 2 && (!best || hits > best[1])) best = [code, hits];
  }
  return best?.[0] ?? null;
}

const toCanvas = (p: Pixels) => {
  const c = document.createElement("canvas");
  c.width = p.width;
  c.height = p.height;
  c.getContext("2d")!.putImageData(new ImageData(p.data as Uint8ClampedArray<ArrayBuffer>, p.width, p.height), 0, 0);
  return c;
};

/** Straightens by `radians` on a canvas grown to fit, so no corner of the page is cut off. */
function rotate(canvas: HTMLCanvasElement, radians: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  c.width = Math.ceil(canvas.width * cos + canvas.height * sin);
  c.height = Math.ceil(canvas.width * sin + canvas.height * cos);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

/** A quarter turn (1), half turn (2) or three quarters (3) clockwise. */
function turn(canvas: HTMLCanvasElement, quarters: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const side = quarters % 2 === 1;
  c.width = side ? canvas.height : canvas.width;
  c.height = side ? canvas.width : canvas.height;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((quarters * Math.PI) / 2);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

/** Up to twice the size, smoothly, until the longer side reaches `side`. */
function enlarge(canvas: HTMLCanvasElement, side: number): HTMLCanvasElement {
  const k = Math.min(2, Math.max(1, side / Math.max(canvas.width, canvas.height)));
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * k);
  c.height = Math.round(canvas.height * k);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

function shrink(canvas: HTMLCanvasElement, side: number): HTMLCanvasElement {
  const k = Math.min(1, side / Math.max(canvas.width, canvas.height));
  const c = document.createElement("canvas");
  c.width = Math.round(canvas.width * k);
  c.height = Math.round(canvas.height * k);
  c.getContext("2d")!.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

/** How much of a reading is real text: confident words of three or more letters or digits. */
const legible = (words: OcrWord[]) => words.filter((w) => w.confidence >= 70 && /[\p{L}\d]{3,}/u.test(w.text)).length;

/**
 * A phone held the wrong way round: when the first reading is mostly noise,
 * read a small copy turned a quarter, a half and three quarters, and keep
 * the way up that reads best.
 */
async function uprightTurn(page: HTMLCanvasElement, first: OcrWord[]): Promise<number> {
  const score = legible(first);
  if (score >= Math.max(10, first.length * 0.45)) return 0;
  const small = shrink(page, 1400);
  let best = { quarters: 0, score };
  for (const quarters of [2, 1, 3]) {
    const s = legible(await recognize(turn(small, quarters), "eng"));
    if (s > best.score * 1.5 && s >= 8) best = { quarters, score: s };
  }
  return best.quarters;
}

/**
 * Reads a page image the way a scanner app would: crop to the paper, even out
 * the light, read once to learn the language and the tilt, then straighten
 * the page and read it again with that language's model. Returns the cleaned
 * page, which is also what the viewer shows, so the boxes line up.
 */
async function ocrPage(source: HTMLCanvasElement, onProgress: (p: Progress) => void): Promise<{ words: OcrWord[]; page: HTMLCanvasElement; cleaned: boolean }> {
  const ctx = source.getContext("2d", { willReadFrequently: true })!;
  let px: Pixels = { width: source.width, height: source.height, data: ctx.getImageData(0, 0, source.width, source.height).data };
  const box = paperBox(px);
  const photo = box !== null || looksLikePhoto(px);
  if (box) px = crop(px, box);
  if (photo) px = flatten(px);
  let page = photo ? toCanvas(px) : source;

  report = (p) => onProgress({ stage: p.stage === "Reading text" ? "Reading text (1 of 2)" : p.stage, value: 0.05 + p.value * 0.45 });
  let first = await recognize(page, "eng");
  const quarters = await uprightTurn(page, first);
  if (quarters) {
    page = turn(page, quarters);
    first = await recognize(page, "eng");
  }
  // A blurred, shaken or small photo: read a copy enlarged and sharpened as well,
  // and keep whichever reads more real words. Sharp photos skip this.
  let enhanced = false;
  if (legible(first) < Math.max(25, first.length * 0.6)) {
    const big = enlarge(page, 2600);
    const c = big.getContext("2d", { willReadFrequently: true })!;
    const sharp = toCanvas(sharpen({ width: big.width, height: big.height, data: c.getImageData(0, 0, big.width, big.height).data }, Math.max(2, Math.round(big.width / 600)), 1.6));
    const second = await recognize(sharp, "eng");
    if (legible(second) > legible(first) * 1.15) {
      page = sharp;
      first = second;
      enhanced = true;
    }
  }
  const lang = guessLanguage(first);
  const angle = Math.atan(estimateSkew(first));
  const tilted = Math.abs(angle) > (0.6 * Math.PI) / 180;
  if (!lang && !tilted) {
    onProgress({ stage: "Done", value: 1 });
    return { words: first, page, cleaned: photo || quarters > 0 || enhanced };
  }
  if (tilted) page = rotate(page, -angle);
  report = (p) => onProgress({ stage: p.stage === "Reading text" ? "Reading text (2 of 2)" : p.stage, value: 0.5 + p.value * 0.5 });
  const words = await recognize(page, lang ? `eng+${lang}` : "eng");
  return { words, page, cleaned: photo || tilted || quarters > 0 || enhanced };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render the page"))), "image/png"));
}

async function scanImage(file: Blob, onProgress: (p: Progress) => void, kind: Sniffed): Promise<Scan> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new FileProblem(kind === "heic" ? "This browser can't open HEIC or TIFF images. Export the photo as JPG or PNG, or open Tally in Safari, and try again." : "This image could not be opened. It may be damaged or in a format browsers don't support.");
  }
  const { width, height } = bitmap;
  if (width < 200 || height < 200) {
    bitmap.close();
    throw new FileProblem("This image is too small to read. Use a photo or scan at least 1000 pixels wide.");
  }
  // Large phone photos are read at up to 3200 px: just as legible, far quicker.
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const { words, page, cleaned } = await ocrPage(canvas, onProgress);
  const image = cleaned || scale < 1 ? await canvasToBlob(page) : file;
  return { words, image, width: page.width, height: page.height, source: "ocr", note: cleaned ? "Photo straightened and cleaned up" : undefined };
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
  const { words: ocrWords, page, cleaned } = await ocrPage(target, onProgress);
  // A cleaned-up scan (cropped, straightened) is what the boxes refer to, so show that.
  if (cleaned) return { words: ocrWords, image: await canvasToBlob(page), width: page.width, height: page.height, source: "ocr", note: ocrNote ?? "Scan straightened and cleaned up" };
  return { words: ocrWords, image, width, height, source: "ocr", note: ocrNote };
}

/**
 * A text document drawn as a page: each row on its own line, table cells a
 * wide gap apart, so the viewer can show it and the readers see the same
 * rows they get from a PDF.
 */
async function drawRows(rows: string[], kind: string): Promise<Scan> {
  while (rows.length && !rows[0].trim()) rows.shift();
  const kept = rows.slice(0, 400);
  const width = 1240;
  const lineH = 34;
  const font = '20px "Helvetica Neue", Arial, sans-serif';
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const space = ctx.measureText(" ").width;
  // Lay the rows out first: a paragraph longer than the page wraps onto the
  // next lines (each its own OCR line), as Word would show it, instead of
  // being cut at the right edge.
  const placed: { text: string; x: number; y: number; w: number; ln: number }[] = [];
  let line = 0;
  for (const row of kept) {
    let x = 60;
    for (const cellText of row.split(/ {2,}|\t/)) {
      for (const word of cellText.split(/ +/).filter(Boolean)) {
        const w = ctx.measureText(word).width;
        if (x + w > width - 40 && x > 60) {
          line++;
          x = 60;
        }
        placed.push({ text: word, x, y: 70 + line * lineH, w, ln: line });
        x += w + space;
      }
      x += 36;
    }
    line++;
  }
  canvas.width = width;
  canvas.height = Math.min(30_000, 120 + line * lineH);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1d1f23";
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  const words: OcrWord[] = [];
  for (const p of placed) {
    if (p.y > canvas.height - 30) break;
    ctx.fillText(p.text, p.x, p.y);
    words.push({ text: p.text, bbox: { x0: p.x, y0: p.y - 18, x1: p.x + p.w, y1: p.y + 5 }, confidence: 100, ln: p.ln });
  }
  return { words, image: await canvasToBlob(canvas), width: canvas.width, height: canvas.height, source: "pdf-text", note: rows.length > 400 ? `${kind}: first 400 rows read` : kind };
}

/** The best document to read among several: an e-invoice, then a PDF, an Office file, a web page, a photo. */
async function pickDocument(files: File[]): Promise<File | undefined> {
  const ranked = await Promise.all(
    files.map(async (a) => {
      const k = await sniff(a);
      const head = k === "text" ? await a.slice(0, 600).text() : "";
      const rank =
        /<(\w+:)?(Invoice|CreditNote|CrossIndustryInvoice)\b/.test(head) ? 6 : k === "pdf" ? 5 : k === "zip" ? 4 : k === "text" && /\.(html?|csv|xml)$/i.test(a.name) ? 3 : k === "rtf" ? 3 : k === "image" && a.size > 40_000 ? 2 : 0;
      return { a, rank };
    }),
  );
  return ranked.filter((r) => r.rank > 0).sort((x, y) => y.rank - x.rank || y.a.size - x.a.size)[0]?.a;
}

async function scanArchive(file: File, onProgress: (p: Progress) => void, depth: number): Promise<Scan> {
  let entries: File[];
  try {
    entries = await zipEntries(file);
  } catch (err) {
    if ((err as Error).message === "encrypted zip") throw new FileProblem("This ZIP archive is password-protected. Unzip it and add the documents inside.");
    throw new FileProblem("This ZIP archive could not be opened. It may be damaged or only partly downloaded.");
  }
  const best = depth < 2 ? await pickDocument(entries) : undefined;
  if (!best) throw new FileProblem("This ZIP archive has no document Tally can read. Unzip it and add the documents inside.");
  const scan = await scanFile(best, onProgress, depth + 1);
  const docs = entries.filter((e) => /\.(pdf|xml|html?|docx|xlsx|jpe?g|png)$/i.test(e.name)).length;
  return { ...scan, note: `${best.name} from the ZIP archive${docs > 1 ? ` (${docs} files inside)` : ""}` };
}

const hasText = (rows: string[]) => rows.some((r) => /\p{L}{2,}/u.test(r));

async function scanText(file: File, kind: Sniffed, onProgress: (p: Progress) => void, depth: number): Promise<Scan> {
  let content: Extracted;
  try {
    content = await extractContent(file, kind);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "encrypted zip") throw new FileProblem("This file is password-protected. Save a copy without the password and try again.");
    if (msg === "zip archive") return scanArchive(file, onProgress, depth);
    if (msg === "xml") throw new FileProblem("This XML file is not an e-invoice Tally knows (UBL, e-Fatura, XRechnung, Factur-X/ZUGFeRD).");
    throw new FileProblem("This file could not be opened. It may be damaged or only partly downloaded: open it, save it again (or as PDF) and try again.");
  }
  // An e-mail that carries the invoice as an attachment: read the attachment.
  if (content.attachments.length && depth < 2) {
    const best = await pickDocument(content.attachments);
    // A picture only wins when the message itself is not the invoice.
    const bodyIsInvoice = content.rows.filter((r) => /\d[\d.,]*\d/.test(r)).length >= 6;
    if (best && (!best.type.startsWith("image/") || !bodyIsInvoice)) {
      try {
        const scan = await scanFile(best, onProgress, depth + 1);
        return { ...scan, note: `${scan.note ? `${scan.note} · ` : ""}attached to the e-mail (${best.name})` };
      } catch {
        // A broken attachment: fall back to the message text.
      }
    }
  }
  if (!hasText(content.rows)) {
    // A photo of the invoice pasted into Word or Excel: read the picture.
    if (content.images.length) {
      const scan = await scanImage(new File([content.images[0]], "picture", { type: content.images[0].type }), onProgress, "image");
      return { ...scan, note: `Picture inside the ${content.kind}, read with OCR` };
    }
    throw new FileProblem("This file has no text to read.");
  }
  return drawRows(content.rows, content.kind);
}

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
const TEXT_EXT = /^(|txt|md|csv|tsv|html?|eml|xml|log|prn|text|mht|mhtml)$/;
const OFFICE_EXT = /^(docx|xlsx|pptx|odt|ods|odp|docm|xlsm)$/;
const OLD_EXT = /^(doc|xls|ppt|msg|pages|numbers|key|wps|xlsb)$/;
const IMAGE_EXT = /^(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/;

/**
 * Reads any file: what it is comes from its first bytes, so a PDF saved as
 * ".docx", a photo without an extension or an Excel "export" that is really
 * a web page still open. The name only decides the advice when it can't be read.
 */
export async function scanFile(file: File, onProgress: (p: Progress) => void, depth = 0): Promise<Scan> {
  if (file.size === 0) throw new FileProblem("This file is empty.");
  if (file.size > MAX_BYTES) throw new FileProblem("Files up to 50 MB are supported.");
  const kind = await sniff(file);
  const e = ext(file.name);
  if (kind === "pdf") return scanPdf(file, onProgress);
  if (kind === "image" || kind === "heic") return scanImage(file, onProgress, kind);
  if (kind === "zip" || kind === "rtf") return scanText(file, kind, onProgress, depth);
  if (kind === "ole") {
    if (await isEncryptedOffice(file)) throw new FileProblem("This Office file is password-protected. Save a copy without the password and try again.");
    throw new FileProblem(
      e === "msg"
        ? "Outlook .msg files can't be read in the browser. Save the e-mail as .eml, or save its attachment, and try again."
        : "This is an older Office file (.doc, .xls, .ppt), which can't be read in the browser. Save it as PDF (or .docx / .xlsx) and try again.",
    );
  }
  if (kind === "text") {
    const head = await file.slice(0, 1024).text();
    const markup = /^\s*(<|\{\\rtf)/.test(head);
    // Old ERP "Excel exports" are web pages named .xls; Word can save a web page as .doc.
    if (TEXT_EXT.test(e) || ((OLD_EXT.test(e) || OFFICE_EXT.test(e)) && markup)) return scanText(file, kind, onProgress, depth);
    if (OLD_EXT.test(e)) throw new FileProblem("This format can't be read in the browser. Save it as PDF (or .docx / .xlsx) and try again.");
    if (OFFICE_EXT.test(e)) throw new FileProblem("This file could not be opened. It may be damaged or only partly downloaded: open it, save it again (or as PDF) and try again.");
  }
  if (e === "pdf") throw new FileProblem("This file is not a valid PDF, or it is damaged.");
  if (IMAGE_EXT.test(e)) return scanImage(file, onProgress, /^(heic|heif|tiff?)$/.test(e) ? "heic" : "image");
  if (OFFICE_EXT.test(e)) throw new FileProblem("This file could not be opened. It may be damaged or only partly downloaded: open it, save it again (or as PDF) and try again.");
  if (OLD_EXT.test(e)) throw new FileProblem("This format can't be read in the browser. Save it as PDF (or .docx / .xlsx) and try again.");
  throw new FileProblem("This file type isn't supported. Use a PDF, a photo or scan, a Word, Excel or PowerPoint file, CSV, text, a saved e-mail or an e-invoice XML.");
}

/** Re-runs OCR on an image already on the page, e.g. a sample. */
export async function rescanUrl(url: string, onProgress: (p: Progress) => void): Promise<OcrWord[]> {
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return (await ocrPage(canvas, onProgress)).words;
}

// Test hook: the corpus evaluation reads its images through exactly this pipeline (scripts/corpus/ocr-browser.mjs).
if (typeof window !== "undefined") (window as unknown as { __tallyScan?: unknown }).__tallyScan = (file: File) => scanFile(file, () => {});
