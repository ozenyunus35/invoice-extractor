"use client";

import { AlertTriangle, CalendarClock, FileSpreadsheet, FileText, Landmark, Receipt, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import { docChecks, type Doc } from "@/lib/documents";
import { formatDate, formatMoney } from "@/lib/format";
import { overview, payStatus, type PayStatus } from "@/lib/insights";
import { statementTotals } from "@/lib/statement";
import { cn } from "@/lib/cn";

type Props = {
  docs: Doc[];
  onOpen: (id: string) => void;
  onExport: (format: "xlsx" | "csv") => void;
  onReset: () => void;
};

function PayBadge({ status, receipt }: { status: PayStatus; receipt: boolean }) {
  if (status.kind === "paid")
    return <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">Paid {formatDate(status.payment.tx.date)}</span>;
  if (status.kind === "overdue") return <span className="inline-flex rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Overdue {status.days}d</span>;
  if (status.kind === "due") return <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">Due in {status.days}d</span>;
  return <span className="text-[11px] text-faint">{receipt ? "Paid at till" : "No due date"}</span>;
}

const card = "rounded-lg border border-border bg-surface p-4 shadow-card";
const h2 = "text-[11px] font-medium tracking-wide text-faint uppercase";

export function Overview({ docs, onOpen, onExport, onReset }: Props) {
  const o = useMemo(() => overview(docs, (d) => docChecks(d).some((c) => c.status === "fail")), [docs]);
  const statuses = useMemo(() => new Map(o.bills.map((d) => [d.id, payStatus(d, docs)])), [o.bills, docs]);
  const overdue = o.bills.filter((d) => statuses.get(d.id)?.kind === "overdue");
  const paid = o.bills.filter((d) => statuses.get(d.id)?.kind === "paid");
  const maxVendor = Math.max(1, ...o.byVendor.map((v) => v.total));

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-bg" data-testid="overview">
      <div className="mx-auto max-w-6xl animate-enter p-4 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">Overview</h1>
            <p className="text-muted">Everything Tally has read, checked and matched across your documents.</p>
          </div>
          <div className="ml-auto flex gap-1.5">
            <button onClick={onReset} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-muted hover:bg-surface-2 hover:text-text">
              <RotateCcw className="size-4" aria-hidden />
              Reset demo
            </button>
            <button onClick={() => onExport("xlsx")} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 font-medium text-accent-fg hover:opacity-90">
              <FileSpreadsheet className="size-4" aria-hidden />
              Export workbook
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Invoices & receipts", value: o.bills.length, sub: `${o.statements.length} bank ${o.statements.length === 1 ? "statement" : "statements"}`, Icon: FileText, tone: "text-accent" },
            { label: "Matched to a payment", value: paid.length, sub: `of ${o.bills.filter((d) => d.type === "invoice").length} invoices`, Icon: Landmark, tone: "text-success" },
            { label: "Overdue", value: overdue.length, sub: overdue.length ? overdue.map((d) => formatMoney(d.invoice.total.value, d.invoice.currency.value)).join(" · ") : "Nothing overdue", Icon: CalendarClock, tone: overdue.length ? "text-danger" : "text-muted" },
            { label: "Need attention", value: o.attention, sub: o.attention ? "Checks failed" : "All checks pass", Icon: AlertTriangle, tone: o.attention ? "text-warning" : "text-muted" },
          ].map(({ label, value, sub, Icon, tone }) => (
            <div key={label} className={card}>
              <div className="flex items-center justify-between text-[12px] text-muted">
                {label}
                <Icon className={cn("size-4", tone)} aria-hidden />
              </div>
              <p className="mt-2 text-[24px] font-semibold tabular-nums">{value}</p>
              <p className="truncate text-[12px] text-muted">{sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-5">
          <section className={cn(card, "lg:col-span-3")} aria-labelledby="payables-h">
            <h2 id="payables-h" className={h2}>
              Invoices and receipts
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead className="text-[11px] text-faint">
                  <tr>
                    <th className="py-1.5 font-medium">Vendor</th>
                    <th className="py-1.5 font-medium">Number</th>
                    <th className="py-1.5 font-medium">Due</th>
                    <th className="py-1.5 font-medium">Status</th>
                    <th className="py-1.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {o.bills.map((d) => (
                    <tr key={d.id} className="cursor-pointer border-t border-border hover:bg-surface-2" onClick={() => onOpen(d.id)}>
                      <td className="max-w-[180px] truncate py-2 pr-2 font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {d.type === "receipt" ? <Receipt className="size-3.5 shrink-0 text-faint" aria-hidden /> : <FileText className="size-3.5 shrink-0 text-faint" aria-hidden />}
                          {d.invoice.vendor.value ?? d.name}
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate py-2 pr-2 font-mono text-[12px] text-muted">{d.invoice.invoiceNumber.value ?? "—"}</td>
                      <td className="py-2 pr-2 text-muted">{formatDate(d.invoice.dueDate.value)}</td>
                      <td className="py-2 pr-2">
                        <PayBadge status={statuses.get(d.id)!} receipt={d.type === "receipt"} />
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{formatMoney(d.invoice.total.value, d.invoice.currency.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={cn(card, "lg:col-span-2")} aria-labelledby="vendors-h">
            <h2 id="vendors-h" className={h2}>
              Spend by vendor
            </h2>
            <ul className="mt-3 space-y-2.5">
              {o.byVendor.map((v) => (
                <li key={`${v.vendor}|${v.currency}`}>
                  <div className="flex justify-between gap-2 text-[12px]">
                    <span className="truncate">{v.vendor}</span>
                    <span className="shrink-0 font-mono tabular-nums">{formatMoney(v.total, v.currency === "—" ? null : v.currency)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(v.total / maxVendor) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-faint">Bars compare amounts in their own currency; no exchange rates are applied.</p>
          </section>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <section className={card} aria-labelledby="vat-h">
            <h2 id="vat-h" className={h2}>
              VAT summary
            </h2>
            {o.vatByRate.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted">No VAT found yet.</p>
            ) : (
              <table className="mt-2 w-full text-left">
                <thead className="text-[11px] text-faint">
                  <tr>
                    <th className="py-1.5 font-medium">Currency</th>
                    <th className="py-1.5 font-medium">Rate</th>
                    <th className="py-1.5 text-right font-medium">Net</th>
                    <th className="py-1.5 text-right font-medium">VAT</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {o.vatByRate.map((v) => (
                    <tr key={`${v.currency}|${v.rate}`} className="border-t border-border">
                      <td className="py-1.5 font-sans">{v.currency}</td>
                      <td className="py-1.5">{v.rate !== null ? `${v.rate}%` : "—"}</td>
                      <td className="py-1.5 text-right">{formatMoney(v.base, v.currency === "—" ? null : v.currency)}</td>
                      <td className="py-1.5 text-right">{formatMoney(v.vat, v.currency === "—" ? null : v.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className={card} aria-labelledby="cash-h">
            <h2 id="cash-h" className={h2}>
              Bank statements
            </h2>
            {o.statements.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted">Add a bank statement to match payments and see cash flow.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {o.statements.map((d) => {
                  const t = statementTotals(d.statement);
                  const cur = d.statement.currency.value;
                  return (
                    <li key={d.id}>
                      <button onClick={() => onOpen(d.id)} className="w-full py-2 text-left hover:opacity-80">
                        <div className="flex justify-between gap-2">
                          <span className="truncate font-medium">{d.statement.bank.value ?? d.name}</span>
                          <span className="shrink-0 text-[12px] text-muted">
                            {formatDate(d.statement.periodStart.value)} – {formatDate(d.statement.periodEnd.value)}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-2 font-mono text-[12px] tabular-nums">
                          <span className="text-success">+{formatMoney(t.moneyIn, cur)}</span>
                          <span>{formatMoney(t.moneyOut, cur)}</span>
                          <span className="text-right">= {formatMoney(t.closing, cur)}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
