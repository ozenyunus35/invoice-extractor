import { cents } from "./numbers";
import type { Report, ReportAnalysis } from "./report";
import { chronological, type Statement } from "./statement";
import type { Invoice } from "./types";
import { validateInvoice } from "./validate";
import { uiLang } from "./format";
import { translateKnown } from "./i18n";

/** Headers, sheet names and check text follow the interface language; document data stays as read. */
const tx = (s: string) => translateKnown(uiLang(), s);
const txAll = (xs: string[]) => xs.map(tx);

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
      failed.length ? failed.map((c) => tx(c.label)).join("; ") : tx("OK"),
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
  return [txAll(HEADER), ...summaryRows(docs)].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

type Sheet = { name: string; header: string[]; rows: (string | number | null)[][]; money: number[] };

const TX_HEADER = ["File", "Date", "Reference", "Description", "Amount", "Balance"];

export function transactionRows(docs: ExportableStatement[]): (string | number | null)[][] {
  return docs.flatMap(({ name, statement }) => chronological(statement).map((t) => [name, t.date, t.reference, t.description, t.amount, t.balance]));
}

export function statementCsv(docs: ExportableStatement[]): string {
  return [txAll(TX_HEADER), ...transactionRows(docs)].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/** Builds an .xlsx with frozen headers, filters and money formats. ExcelJS loads only when needed. */
async function workbook(sheets: Sheet[]): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Tally";
  for (const sheet of sheets) {
    const { rows, money } = sheet;
    const name = tx(sheet.name);
    const header = txAll(sheet.header);
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

/** One sheet per table found in a financial report, plus the ratios and the checks. */
export function reportXlsx(r: Report, a: ReportAnalysis): Promise<Blob> {
  const used = new Set<string>();
  const sheetName = (title: string) => {
    let name = title.replace(/[\\/?*[\]:]/g, " ").slice(0, 28).trim() || "Table";
    for (let k = 2; used.has(name); k++) name = `${name.slice(0, 25)} ${k}`;
    used.add(name);
    return name;
  };
  const sheets: Sheet[] = r.tables.map((t) => ({
    name: sheetName(t.title),
    header: ["Line item", ...t.columns],
    rows: t.rows.map((row) => [row.label, ...row.values]),
    money: t.columns.map((_, i) => i + 1),
  }));
  if (a.ratios.length) {
    const columns = [...new Set(a.ratios.flatMap((x) => x.values.map((v) => v.column)))];
    sheets.push({ name: "Ratios", header: ["Ratio", ...columns], rows: a.ratios.map((x) => [tx(x.label), ...columns.map((c) => x.values.find((v) => v.column === c)?.value ?? null)]), money: [] });
  }
  sheets.push({ name: "Checks", header: ["Check", "Result", "Detail"], rows: a.checks.map((c) => [tx(c.label), tx(c.status), tx(c.detail)]), money: [] });
  return workbook(sheets);
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
