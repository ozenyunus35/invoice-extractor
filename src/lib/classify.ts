import { datesIn } from "./dates";
import { fold } from "./extract";
import { detectDecimal, numbersIn } from "./numbers";
import { reportScore } from "./report";
import type { OcrLine } from "./types";

export type DocType = "invoice" | "receipt" | "statement" | "report" | "unknown";

const STATEMENT_WORDS = /\b(statement|account transactions|transaction history|hesap hareketleri|hesap ozeti|ekstre|kontoauszug|umsatze|iban|balance|bakiye|saldo|opening balance|closing balance|devreden)\b/g;
const INVOICE_WORDS = /\b(invoice|tax invoice|fatura|e-arsiv|rechnung|bill to|billed to|due date|vade|zahlbar|subtotal|sub-total|ara toplam|zwischensumme|vat|kdv|mwst|sales tax|unit price|birim fiyat|einzelpreis|qty|quantity|miktar|menge|facture|factura|fattura|factuur|faktura|tva|iva|btw|total ttc|total ht|imponibile|base imponible|subtotaal|echeance|vencimiento|scadenza|vervaldatum|vencimento|termin platnosci|prix unitaire|precio unitario|prezzo unitario|prijs|preco unitario|cena netto|designation|descripcion|descrizione|omschrijving|descricao|ilosc|aantal|nabywca)\b/g;
const RECEIPT_WORDS = /\b(receipt|fis|kassenbon|beleg|cash|card|change|nakit|kredi karti|thank you|tesekkur|danke|table|masa|ticket|scontrino|kassabon|talao|paragon|carte bancaire|tarjeta|carta|pin|cartao|karta|merci|gracias|grazie|bedankt|obrigado|dziekujemy)\b/g;
const TOTAL_WORDS = /\b(total|toplam|summe|gesamt|amount due|balance due)\b/;

export type Classification = { type: DocType; scores: Record<Exclude<DocType, "unknown">, number>; reason: string };

/**
 * Decides what kind of document this is before any fields are read, so a bank
 * statement is never forced into invoice fields. Scores are keyword hits plus
 * structure: statements have many rows that start with a date and end with two
 * numbers; invoices have a totals line.
 */
export function classifyDocument(lines: OcrLine[]): Classification {
  const text = lines.map((l) => l.text).join("\n");
  const f = fold(text);
  const decimal = detectDecimal(text);
  const datedRows = lines.filter((l) => {
    const d = datesIn(l.text);
    return d.length > 0 && d[0].index <= 3 && numbersIn(l.text, decimal).length >= 2;
  }).length;

  const statement = (f.match(STATEMENT_WORDS)?.length ?? 0) + Math.min(datedRows, 12) * 1.5;
  const invoice = (f.match(INVOICE_WORDS)?.length ?? 0) * 1.5 + (TOTAL_WORDS.test(f) ? 2 : 0);
  const receipt = (f.match(RECEIPT_WORDS)?.length ?? 0) * 1.5 + (TOTAL_WORDS.test(f) ? 2 : 0) + (lines.length < 30 ? 1 : 0);
  // Financial statements: rows that name line items such as "Net sales" or "Toplam varlıklar".
  const report = reportScore(lines) * 2;
  const scores = { statement, invoice, receipt, report };

  if (datedRows >= 4 && statement > invoice) return { type: "statement", scores, reason: `${datedRows} dated rows with amounts` };
  if (report >= 8 && report > invoice) return { type: "report", scores, reason: `${report / 2} financial statement line items` };
  if (Math.max(invoice, receipt) < 3.5) {
    return { type: "unknown", scores, reason: lines.length < 3 ? "Almost no text was found" : "No invoice, receipt or statement structure was found" };
  }
  return receipt > invoice ? { type: "receipt", scores, reason: "Receipt wording and a total" } : { type: "invoice", scores, reason: "Invoice wording and a total" };
}
