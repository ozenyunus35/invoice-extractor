import { cents } from "./numbers";
import { chronological, type Statement } from "./statement";
import type { Invoice } from "./types";
import { validateInvoice } from "./validate";

export type Exportable = { name: string; invoice: Invoice };
export type ExportableStatement = { name: string; statement: Statement };

const HEADER = ["File", "Vendor", "Tax ID", "Invoice no", "Date", "Due date", "Currency", "Subtotal", "VAT", "Total", "Checks"];

/** One row per document, in the order a ledger import expects. */
export function summaryRows(docs: Exportable[]): (string | number | null)[][] {
  return docs.map(({ name, invoice: inv }) => {
    const failed = validateInvoice(inv).filter((c) => c.status === "fail");
    return [
      name,
      inv.vendor.value,
      inv.taxId.value,
      inv.invoiceNumber.value,
      inv.date.value,
      inv.dueDate.value,
      inv.currency.value,
      inv.subtotal.value,
      cents(inv.vat.reduce((s, v) => s + v.amount, 0)),
      inv.total.value,
      failed.length ? failed.map((c) => c.label).join("; ") : "OK",
    ];
  });
}

const ITEM_HEADER = ["File", "Invoice no", "Description", "Quantity", "Unit price", "Amount", "VAT %"];

export function itemRows(docs: Exportable[]): (string | number | null)[][] {
  return docs.flatMap(({ name, invoice: inv }) =>
    inv.items.map((i) => [name, inv.invoiceNumber.value, i.description, i.quantity, i.unitPrice, i.amount, i.vatRate]),
  );
}

const csvCell = (v: string | number | null) => {
  if (v === null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(docs: Exportable[]): string {
  return [HEADER, ...summaryRows(docs)].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

type Sheet = { name: string; header: string[]; rows: (string | number | null)[][]; money: number[] };

const TX_HEADER = ["File", "Date", "Reference", "Description", "Amount", "Balance"];

export function transactionRows(docs: ExportableStatement[]): (string | number | null)[][] {
  return docs.flatMap(({ name, statement }) => chronological(statement).map((t) => [name, t.date, t.reference, t.description, t.amount, t.balance]));
}

export function statementCsv(docs: ExportableStatement[]): string {
  return [TX_HEADER, ...transactionRows(docs)].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Builds an .xlsx with frozen headers, filters and money formats. ExcelJS loads only when needed. */
async function workbook(sheets: Sheet[]): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tally";
  for (const { name, header, rows, money } of sheets) {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(header).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col, i) => {
      col.width = Math.min(48, Math.max(header[i].length + 2, ...rows.map((r) => String(r[i] ?? "").length + 2)));
      if (money.includes(i)) col.numFmt = "#,##0.00";
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Invoices and their line items, plus a Transactions sheet when statements are included. */
export function toXlsx(docs: Exportable[], statements: ExportableStatement[] = []): Promise<Blob> {
  const sheets: Sheet[] = [];
  if (docs.length) {
    sheets.push({ name: "Invoices", header: HEADER, rows: summaryRows(docs), money: [7, 8, 9] });
    sheets.push({ name: "Line items", header: ITEM_HEADER, rows: itemRows(docs), money: [4, 5] });
  }
  if (statements.length) sheets.push({ name: "Transactions", header: TX_HEADER, rows: transactionRows(statements), money: [4, 5] });
  return workbook(sheets);
}

export const statementXlsx = (statements: ExportableStatement[]) => toXlsx([], statements);

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
