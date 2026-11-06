"use client";

import { AlertTriangle, Braces, CalendarClock, CheckCircle2, CircleDashed, Copy, Crosshair, Eye, FileSpreadsheet, Landmark, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/toast";
import { TypeSwitch } from "@/components/type-switch";
import type { DocType } from "@/lib/classify";
import type { Doc } from "@/lib/documents";
import { download, toCsv, toXlsx } from "@/lib/export";
import { formatDate, formatMoney, parseTyped } from "@/lib/format";
import type { PayStatus } from "@/lib/insights";
import { cents } from "@/lib/numbers";
import type { Check, Field, Invoice, LineItem } from "@/lib/types";
import { validateInvoice } from "@/lib/validate";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

type Props = {
  doc: Doc;
  onChange: (inv: Invoice) => void;
  onType: (t: DocType) => void;
  duplicateOf: Doc | null;
  pay: PayStatus;
  onOpen: (id: string) => void;
  focusLine: number | null;
  onFocusLine: (line: number | null) => void;
  onShowSource: (line: number) => void;
};

const CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

function ConfidenceDot({ field }: { field: Field<unknown> }) {
  const t = useT();
  const c = field.value === null ? 0 : field.confidence;
  const [tone, label] = c >= 0.85 ? ["bg-success", "High confidence"] : c >= 0.6 ? ["bg-warning", "Check this value"] : ["bg-danger", field.value === null ? "Not found" : "Low confidence"];
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", tone)} title={`${t(label)}${field.value !== null ? ` · ${Math.round(c * 100)}%` : ""}${field.derived ? ` · ${t("worked out from other values")}` : ""}`} aria-label={t(label)} />;
}

/** A text box that keeps what the reviewer is typing and commits a parsed number on blur. */
function NumberInput({ value, onCommit, label, className, count }: { value: number | null; onCommit: (v: number | null) => void; label: string; className?: string; count?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const decimals = String(value).split(".")[1]?.length ?? 0;
  const shown = draft ?? (value === null ? "" : count && Number.isInteger(value) ? String(value) : value.toFixed(Math.min(3, Math.max(2, decimals))));
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null) onCommit(parseTyped(draft));
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 text-right font-mono tabular-nums hover:border-border focus:border-accent focus:bg-surface focus:outline-none", className)}
    />
  );
}

const inputClass = "h-8 w-full min-w-0 rounded-md border border-border bg-surface px-2 hover:border-border-strong focus:border-accent focus:outline-none";

function FieldRow({
  label,
  field,
  original,
  focused,
  onFocusLine,
  onShowSource,
  onReset,
  children,
  wide,
}: {
  label: string;
  field: Field<unknown>;
  original: Field<unknown>;
  focused: boolean;
  onFocusLine: (l: number | null) => void;
  onShowSource: (l: number) => void;
  onReset: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const edited = field.value !== original.value;
  const t = useT();
  return (
    <div
      className={cn("rounded-md p-1.5 transition-colors", wide && "col-span-2", focused && "bg-accent-soft ring-1 ring-accent/40")}
      onMouseEnter={() => onFocusLine(field.line)}
      onFocusCapture={() => onFocusLine(field.line)}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted">
        <ConfidenceDot field={field} />
        {label}
        {edited && (
          <button onClick={onReset} className="ml-auto inline-flex items-center gap-1 text-[11px] text-accent hover:underline" title={t("Read as: {value}", { value: original.value === null ? t("nothing") : String(original.value) })}>
            <RotateCcw className="size-3" aria-hidden />
            {t("Edited")}
          </button>
        )}
        {!edited && field.line !== null && (
          <button onClick={() => onShowSource(field.line!)} className="ml-auto text-faint hover:text-accent" aria-label={t("Show where {field} was read", { field: label })} title={t("Show on document")}>
            <Crosshair className="size-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function CheckRow({ check }: { check: Check }) {
  const t = useT();
  const Icon = check.status === "pass" ? CheckCircle2 : check.status === "fail" ? AlertTriangle : CircleDashed;
  return (
    <li className="flex gap-2.5 py-2" data-status={check.status}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", check.status === "pass" ? "text-success" : check.status === "fail" ? "text-warning" : "text-faint")} aria-hidden />
      <div className="min-w-0">
        <p className="font-medium">{t(check.label)}</p>
        <p className="text-[12px] break-words text-muted">{t(check.detail)}</p>
      </div>
    </li>
  );
}

export function DataPanel({ doc, onChange, onType, duplicateOf, pay, onOpen, focusLine, onFocusLine, onShowSource }: Props) {
  const { toast } = useToast();
  const t = useT();
  const inv = doc.invoice;
  const orig = doc.extracted;
  const checks = validateInvoice(inv);
  const failed = checks.filter((c) => c.status === "fail").length;
  const passed = checks.filter((c) => c.status === "pass").length;
  const cur = inv.currency.value;
  // Fields read with low confidence (blurry scan, repaired currency sign, worked out from other values).
  const lowConfidence = (
    [
      ["vendor", "vendor"],
      ["invoiceNumber", "invoice number"],
      ["date", "issue date"],
      ["currency", "currency"],
      ["subtotal", "subtotal"],
      ["total", "total"],
    ] as const
  )
    .filter(([k]) => (inv[k].value === null && k !== "invoiceNumber" ? doc.type === "invoice" || k === "total" : inv[k].value !== null && inv[k].confidence < 0.7))
    .map(([, label]) => t(label));

  const setField = <K extends "vendor" | "taxId" | "invoiceNumber" | "date" | "dueDate" | "currency" | "subtotal" | "total">(key: K, value: Invoice[K]["value"]) =>
    onChange({ ...inv, [key]: { ...inv[key], value, confidence: 1, derived: false } });
  const resetField = (key: "vendor" | "taxId" | "invoiceNumber" | "date" | "dueDate" | "currency" | "subtotal" | "total") => onChange({ ...inv, [key]: orig[key] });
  const setItem = (i: number, patch: Partial<LineItem>) => {
    const items = inv.items.map((it, j) => {
      if (j !== i) return it;
      const next = { ...it, ...patch };
      // Changing quantity or price recalculates the amount, like a spreadsheet would.
      if (("quantity" in patch || "unitPrice" in patch) && !("amount" in patch)) next.amount = cents(next.quantity * next.unitPrice);
      return next;
    });
    onChange({ ...inv, items });
  };

  const row = (key: Parameters<typeof resetField>[0], label: string, input: React.ReactNode, wide = false) => (
    <FieldRow
      key={key}
      label={label}
      field={inv[key]}
      original={orig[key]}
      focused={focusLine !== null && inv[key].line === focusLine}
      onFocusLine={onFocusLine}
      onShowSource={onShowSource}
      onReset={() => resetField(key)}
      wide={wide}
    >
      {input}
    </FieldRow>
  );

  const exportOne = async (format: "xlsx" | "csv" | "json") => {
    const base = doc.name.replace(/\.[^.]+$/, "");
    const rows = [{ name: doc.name, invoice: inv }];
    if (format === "json") download(new Blob([JSON.stringify(inv, null, 2)], { type: "application/json" }), `${base}.json`);
    else if (format === "csv") download(new Blob([toCsv(rows)], { type: "text/csv" }), `${base}.csv`);
    else download(await toXlsx(rows), `${base}.xlsx`);
    toast(t("Downloaded {file}", { file: `${base}.${format}` }));
  };

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="animate-enter border-b border-border p-4">
          <TypeSwitch doc={doc} onChange={onType} />
          <div className="mt-3 flex items-end justify-between gap-3">
            <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-tight">{inv.vendor.value ?? t("Unknown vendor")}</h1>
            <p className="shrink-0 font-mono text-[20px] font-semibold tabular-nums" data-testid="total">
              {formatMoney(inv.total.value, cur)}
            </p>
          </div>
          <div
            className={cn("mt-3 flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px]", failed ? "bg-warning-soft text-warning" : "bg-success-soft text-success")}
            data-testid="summary"
          >
            {failed ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
            {failed ? t(failed === 1 ? "{n} check needs attention before posting" : "{n} checks need attention before posting", { n: failed }) : t("{n} checks pass · ready to post", { n: passed })}
          </div>
          {lowConfidence.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-warning/30 px-2.5 py-2 text-[12px] text-warning" data-testid="review">
              <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {t("Worth a quick look: {fields}.", { fields: lowConfidence.join(", ") })} {doc.source === "ocr" ? t("These were hard to read in the scan.") : t("These were worked out rather than printed.")}
              </span>
            </div>
          )}
          {pay.kind !== "none" && (
            <div
              data-testid="pay-status"
              className={cn(
                "mt-2 flex items-center gap-2 rounded-md border px-2.5 py-2 text-[12px]",
                pay.kind === "paid" ? "border-border text-muted" : pay.kind === "overdue" ? "border-danger/30 bg-danger-soft text-danger" : "border-border text-muted",
              )}
            >
              {pay.kind === "paid" ? <Landmark className="size-4 shrink-0 text-success" aria-hidden /> : <CalendarClock className="size-4 shrink-0" aria-hidden />}
              {pay.kind === "paid" ? (
                <span>
                  {t("Paid on {date}, matched to", { date: formatDate(pay.payment.tx.date) })}{" "}
                  <button onClick={() => onOpen(pay.payment.doc.id)} className="font-medium text-text underline-offset-2 hover:underline">
                    {pay.payment.doc.statement.bank.value ?? t("a bank statement")}
                  </button>
                </span>
              ) : pay.kind === "overdue" ? (
                <span>
                  {t(pay.days === 1 ? "Overdue by {n} day · no matching payment on your statements" : "Overdue by {n} days · no matching payment on your statements", { n: pay.days })}
                </span>
              ) : (
                <span>{pay.days === 0 ? t("Due today") : t(pay.days === 1 ? "Due in {n} day" : "Due in {n} days", { n: pay.days })}</span>
              )}
            </div>
          )}
          {duplicateOf && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-[12px] text-warning" data-testid="duplicate">
              <Copy className="size-4 shrink-0" aria-hidden />
              <span>
                {t("Possible duplicate of")}{" "}
                <button onClick={() => onOpen(duplicateOf.id)} className="font-medium underline-offset-2 hover:underline">
                  {duplicateOf.name}
                </button>{" "}
                · {doc.invoice.invoiceNumber.value ? t("same vendor and invoice number") : t("same vendor, amount and date")}
              </span>
            </div>
          )}
        </section>

        <section className="border-b border-border p-3" aria-labelledby="details-h">
          <h2 id="details-h" className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
            {t("Details")}
          </h2>
          <div className="grid grid-cols-2 gap-x-1">
            {row("vendor", t("Vendor"), <input aria-label={t("Vendor")} className={inputClass} value={inv.vendor.value ?? ""} onChange={(e) => setField("vendor", e.target.value || null)} />, true)}
            {row("invoiceNumber", t("Invoice no"), <input aria-label={t("Invoice number")} className={cn(inputClass, "font-mono")} value={inv.invoiceNumber.value ?? ""} onChange={(e) => setField("invoiceNumber", e.target.value || null)} />)}
            {row("taxId", t("Tax ID"), <input aria-label={t("Tax ID")} className={cn(inputClass, "font-mono")} value={inv.taxId.value ?? ""} onChange={(e) => setField("taxId", e.target.value || null)} />)}
            {row("date", t("Issue date"), <input aria-label={t("Issue date")} type="date" className={inputClass} value={inv.date.value ?? ""} onChange={(e) => setField("date", e.target.value || null)} />)}
            {row("dueDate", t("Due date"), <input aria-label={t("Due date")} type="date" className={inputClass} value={inv.dueDate.value ?? ""} onChange={(e) => setField("dueDate", e.target.value || null)} />)}
            {row(
              "currency",
              t("Currency"),
              <select aria-label={t("Currency")} className={inputClass} value={cur ?? ""} onChange={(e) => setField("currency", e.target.value || null)}>
                <option value="">{t("Unknown")}</option>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>,
            )}
          </div>
        </section>

        <section className="border-b border-border p-3" aria-labelledby="items-h">
          <div className="flex items-center px-1.5 pb-1">
            <h2 id="items-h" className="text-[11px] font-medium tracking-wide text-faint uppercase">
              {t("Line items · {n}", { n: inv.items.length })}
            </h2>
            <button
              onClick={() => onChange({ ...inv, items: [...inv.items, { description: "", quantity: 1, unitPrice: 0, amount: 0, vatRate: null, line: -1 }] })}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] text-muted hover:bg-surface-2 hover:text-text"
            >
              <Plus className="size-3.5" aria-hidden />
              {t("Add line")}
            </button>
          </div>
          {inv.items.length === 0 ? (
            <p className="px-1.5 py-3 text-[12px] text-muted">{t("No line items were found on this document.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] text-left">
                <thead className="text-[11px] text-faint">
                  <tr>
                    <th className="px-1.5 py-1 font-medium">{t("Description")}</th>
                    <th className="w-12 px-1.5 py-1 text-right font-medium">{t("Qty")}</th>
                    <th className="w-20 px-1.5 py-1 text-right font-medium">{t("Price")}</th>
                    <th className="w-24 px-1.5 py-1 text-right font-medium">{t("Amount")}</th>
                    <th className="w-7" />
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it, i) => (
                    <tr
                      key={i}
                      className={cn("group border-t border-border transition-colors", focusLine === it.line && "bg-accent-soft")}
                      onMouseEnter={() => onFocusLine(it.line >= 0 ? it.line : null)}
                      onFocusCapture={() => onFocusLine(it.line >= 0 ? it.line : null)}
                    >
                      <td className="py-0.5 pr-1">
                        <input
                          aria-label={t("Line {n} description", { n: i + 1 })}
                          value={it.description}
                          onChange={(e) => setItem(i, { description: e.target.value })}
                          className="h-7 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 hover:border-border focus:border-accent focus:bg-surface focus:outline-none"
                        />
                      </td>
                      <td>
                        <NumberInput count label={t("Line {n} quantity", { n: i + 1 })} value={it.quantity} onCommit={(v) => setItem(i, { quantity: v ?? 0 })} />
                      </td>
                      <td>
                        <NumberInput label={t("Line {n} unit price", { n: i + 1 })} value={it.unitPrice} onCommit={(v) => setItem(i, { unitPrice: v ?? 0 })} />
                      </td>
                      <td>
                        <NumberInput label={t("Line {n} amount", { n: i + 1 })} value={it.amount} onCommit={(v) => setItem(i, { amount: v ?? 0 })} className="font-medium" />
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => onChange({ ...inv, items: inv.items.filter((_, j) => j !== i) })}
                          className="rounded p-1 text-faint opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100 max-lg:opacity-100"
                          aria-label={t("Remove line {n}", { n: i + 1 })}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="border-b border-border p-3" aria-labelledby="totals-h">
          <h2 id="totals-h" className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
            {t("Totals")} {cur && <span className="normal-case">· {cur}</span>}
          </h2>
          <dl className="ml-auto max-w-xs">
            <div className={cn("flex items-center justify-between gap-3 rounded-md px-1.5", focusLine !== null && inv.subtotal.line === focusLine && "bg-accent-soft")} onMouseEnter={() => onFocusLine(inv.subtotal.line)}>
              <dt className="flex items-center gap-1.5 text-muted">
                <ConfidenceDot field={inv.subtotal} />
                {t("Subtotal")}{inv.subtotal.derived && <span className="text-[11px] text-faint"> {t("(worked out)")}</span>}
              </dt>
              <dd className="w-32">
                <NumberInput label={t("Subtotal")} value={inv.subtotal.value} onCommit={(v) => setField("subtotal", v)} />
              </dd>
            </div>
            {inv.vat.map((v, i) => (
              <div key={i} className={cn("flex items-center justify-between gap-3 rounded-md px-1.5", focusLine !== null && v.line === focusLine && "bg-accent-soft")} onMouseEnter={() => onFocusLine(v.line)}>
                <dt className="text-muted">
                  {t("VAT")} {v.rate !== null ? `${v.rate}%` : ""}
                  {v.rateDerived && <span className="text-[11px] text-faint"> {t("(rate worked out)")}</span>}
                  {v.line === null && <span className="text-[11px] text-faint"> {t("(worked out)")}</span>}
                </dt>
                <dd className="w-32">
                  <NumberInput label={t("VAT {rate}% amount", { rate: v.rate ?? "" })} value={v.amount} onCommit={(n) => onChange({ ...inv, vat: inv.vat.map((x, j) => (j === i ? { ...x, amount: n ?? 0 } : x)) })} />
                </dd>
              </div>
            ))}
            <div className={cn("mt-1 flex items-center justify-between gap-3 rounded-md border-t border-border px-1.5 pt-1", focusLine !== null && inv.total.line === focusLine && "bg-accent-soft")} onMouseEnter={() => onFocusLine(inv.total.line)}>
              <dt className="flex items-center gap-1.5 font-medium">
                <ConfidenceDot field={inv.total} />
                {t("Total")}
              </dt>
              <dd className="w-32">
                <NumberInput label={t("Total")} value={inv.total.value} onCommit={(v) => setField("total", v)} className="font-semibold" />
              </dd>
            </div>
          </dl>
        </section>

        <section className="p-3" aria-labelledby="checks-h">
          <h2 id="checks-h" className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
            {t("Checks")}
          </h2>
          <ul className="divide-y divide-border px-1.5" data-testid="checks">
            {checks.map((c) => (
              <CheckRow key={c.id} check={c} />
            ))}
          </ul>
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-surface p-3">
        <span className="mr-auto text-[12px] text-muted">{t("This document")}</span>
        <button onClick={() => exportOne("xlsx")} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 font-medium text-accent-fg hover:opacity-90">
          <FileSpreadsheet className="size-4" aria-hidden />
          Excel
        </button>
        <button onClick={() => exportOne("csv")} className="inline-flex h-8 items-center rounded-md border border-border px-2.5 hover:bg-surface-2">
          CSV
        </button>
        <button onClick={() => exportOne("json")} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 hover:bg-surface-2" aria-label={t("Download JSON")}>
          <Braces className="size-3.5" aria-hidden />
          JSON
        </button>
      </div>
    </div>
  );
}
