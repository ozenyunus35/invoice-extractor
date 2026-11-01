import brauer from "@/data/ocr/brauer.json";
import halcyon from "@/data/ocr/halcyon.json";
import kettle from "@/data/ocr/kettle.json";
import kuzey from "@/data/ocr/kuzey.json";
import northshore from "@/data/ocr/northshore.json";
import ridgeline from "@/data/ocr/ridgeline.json";
import { classifyDocument, type Classification, type DocType } from "./classify";
import { extractInvoice } from "./extract";
import { analyseReport, extractReport, type Report } from "./report";
import { extractStatement, validateStatement, type Statement } from "./statement";
import { validateInvoice } from "./validate";
import { wordsToLines, type OcrWord } from "./layout";
import type { Check, Invoice, OcrLine } from "./types";

export type Doc = {
  id: string;
  name: string;
  kind: string;
  sample: boolean;
  imageUrl: string;
  width: number;
  height: number;
  lines: OcrLine[];
  /** What the rules read, before any edits. */
  extracted: Invoice;
  /** The reviewer's version; starts as a copy of `extracted`. */
  invoice: Invoice;
  statement: Statement;
  report: Report;
  /** What the document was detected as, and what it is being read as (the reviewer can switch). */
  detected: Classification;
  type: DocType;
  source: "ocr" | "pdf-text";
  addedAt: number;
  /** Uploaded documents keep their image so they can be saved on this device. */
  image?: Blob;
  /** How the file was read, when the reviewer should know (only part of a long PDF, say). */
  note?: string;
};

export type Pending = { id: string; name: string; stage: string; value: number; error?: string };

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Everything that is read from the text: run again after a re-scan. */
export function readLines(lines: OcrLine[]) {
  const extracted = extractInvoice(lines);
  const detected = classifyDocument(lines);
  return { lines, extracted, invoice: structuredClone(extracted), statement: extractStatement(lines), report: extractReport(lines), detected, type: detected.type };
}

export function makeDoc(input: Omit<Doc, "lines" | "extracted" | "invoice" | "statement" | "report" | "detected" | "type"> & { words: OcrWord[] }): Doc {
  const { words, ...rest } = input;
  return { ...rest, ...readLines(wordsToLines(words)) };
}

const SAMPLE_META = [
  { id: "halcyon", kind: "SaaS invoice · US", words: halcyon.words, width: 1240, height: 1754 },
  { id: "brauer", kind: "Supplier invoice · DE", words: brauer.words, width: 1240, height: 1754 },
  { id: "kuzey", kind: "e-Arşiv fatura · TR", words: kuzey.words, width: 1240, height: 1754 },
  { id: "ridgeline", kind: "Freelance invoice · US", words: ridgeline.words, width: 1240, height: 1754 },
  { id: "kettle", kind: "Café receipt · UK", words: kettle.words, width: 640, height: 1100 },
  { id: "northshore", kind: "Bank statement · US", words: northshore.words, width: 1240, height: 1754 },
];

/** Synthetic sample documents, already read by the same OCR engine (scripts/ocr-samples.mjs). */
export function sampleDocs(): Doc[] {
  return SAMPLE_META.map((s, i) =>
    makeDoc({
      id: s.id,
      name: `${s.id}.png`,
      kind: s.kind,
      sample: true,
      imageUrl: `${base}/samples/${s.id}.png`,
      width: s.width,
      height: s.height,
      words: s.words as OcrWord[],
      source: "ocr",
      addedAt: i,
    }),
  );
}

/** The checks that apply to what the document is being read as. */
export function docChecks(doc: Doc): Check[] {
  if (doc.type === "statement") return validateStatement(doc.statement);
  if (doc.type === "report") return analyseReport(doc.report).checks;
  if (doc.type === "unknown") return [];
  return validateInvoice(doc.invoice);
}

export const TYPE_LABEL: Record<DocType, string> = { invoice: "Invoice", receipt: "Receipt", statement: "Bank statement", report: "Financial report", unknown: "Not recognised" };
