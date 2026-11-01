/** A rectangle in page pixels, as the OCR engine reports it. */
export type Box = { x0: number; y0: number; x1: number; y1: number };

/** One line of recognised text, in reading order. */
export type OcrLine = {
  text: string;
  bbox?: Box;
  page?: number;
  /** OCR confidence, 0–100. */
  confidence?: number;
};

export type OcrPage = { width: number; height: number };

export type OcrResult = {
  lines: OcrLine[];
  pages: OcrPage[];
  /** How the text was read: from the PDF's own text layer, or by OCR on an image. */
  source: "ocr" | "pdf-text";
};

/** An extracted value with the line it came from, so the UI can point at it. */
export type Field<T> = {
  value: T | null;
  /** Index into OcrResult.lines, or null when the value was derived. */
  line: number | null;
  /** 0–1: how sure the rules are, combined with the OCR confidence of that line. */
  confidence: number;
  derived?: boolean;
};

export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  vatRate: number | null;
  line: number;
};

export type VatLine = {
  rate: number | null;
  /** The rate was not readable and was worked out from the amounts. */
  rateDerived?: boolean;
  base: number | null;
  amount: number;
  line: number | null;
};

export type Invoice = {
  vendor: Field<string>;
  taxId: Field<string>;
  invoiceNumber: Field<string>;
  date: Field<string>;
  dueDate: Field<string>;
  currency: Field<string>;
  items: LineItem[];
  subtotal: Field<number>;
  vat: VatLine[];
  total: Field<number>;
  decimal: "," | ".";
};

export type CheckStatus = "pass" | "fail" | "skip";

export type Check = {
  id: "items-sum" | "subtotal-vat-total" | "vat-rate" | "line-math" | "required";
  status: CheckStatus;
  label: string;
  detail: string;
};
