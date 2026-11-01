"use client";

import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { CheckRow } from "@/components/data-panel";
import { useToast } from "@/components/toast";
import { TypeSwitch } from "@/components/type-switch";
import type { DocType } from "@/lib/classify";
import type { Doc } from "@/lib/documents";
import { download, reportXlsx } from "@/lib/export";
import { analyseReport, type ReportTable } from "@/lib/report";
import { cn } from "@/lib/cn";

type Props = {
  doc: Doc;
  onType: (t: DocType) => void;
  focusLine: number | null;
  onFocusLine: (line: number | null) => void;
};

const KIND_LABEL: Record<ReportTable["kind"], string> = {
  income: "Income statement",
  balance: "Balance sheet",
  cashflow: "Cash flow",
  budget: "Budget vs actual",
  ageing: "Ageing",
  ratios: "Ratios",
  other: "Table",
};

const num = (v: number | null, percent = false) =>
  v === null ? "—" : percent ? `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%` : v < 0 ? `(${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })})` : v.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function ReportPanel({ doc, onType, focusLine, onFocusLine }: Props) {
  const { toast } = useToast();
  const r = doc.report;
  const a = useMemo(() => analyseReport(r), [r]);
  const failed = a.checks.filter((c) => c.status === "fail").length;
  const [open, setOpen] = useState(0);

  const exportReport = async () => {
    const base = doc.name.replace(/\.[^.]+$/, "");
    download(await reportXlsx(r, a), `${base}-tables.xlsx`);
    toast(`Downloaded ${base}-tables.xlsx`);
  };

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="animate-enter border-b border-border p-4">
          <TypeSwitch doc={doc} onChange={onType} />
          <h1 className="mt-3 truncate text-[17px] font-semibold tracking-tight">{r.company ?? "Financial report"}</h1>
          <p className="text-[12px] text-muted">
            {r.tables.length} {r.tables.length === 1 ? "table" : "tables"} found{r.unit ? ` · amounts ${/bin/i.test(r.unit) ? `in ${r.unit}` : r.unit.replace(/^in /i, "in ")}` : ""}
          </p>

          {a.headline.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {a.headline.slice(0, 4).map((h) => {
                const change = h.previous ? ((h.value - h.previous) / Math.abs(h.previous)) * 100 : null;
                return (
                  <div key={h.label} className="rounded-md border border-border bg-surface px-2.5 py-2">
                    <dt className="text-[11px] text-muted">{h.label}</dt>
                    <dd className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className="truncate font-mono text-[13px] font-medium tabular-nums">{num(h.value)}</span>
                      {change !== null && (
                        <span className={cn("inline-flex items-center text-[11px] tabular-nums", change >= 0 ? "text-success" : "text-danger")}>
                          {change >= 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
                          {Math.abs(change).toFixed(1)}%
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}

          <div className={cn("mt-3 flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px]", failed ? "bg-warning-soft text-warning" : "bg-success-soft text-success")} data-testid="summary">
            {failed ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
            {a.checks.length === 0
              ? "No checkable statements found"
              : failed
                ? `${failed} of ${a.checks.length} checks need attention`
                : `All ${a.checks.length} checks pass: the statements add up and agree with each other`}
          </div>
        </section>

        {a.ratios.length > 0 && (
          <section className="border-b border-border p-3" aria-labelledby="ratios-h">
            <h2 id="ratios-h" className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
              Key ratios
            </h2>
            <table className="w-full text-left" data-testid="ratios">
              <tbody>
                {a.ratios.map((x) => (
                  <tr key={x.label} className="border-t border-border first:border-t-0">
                    <th scope="row" className="px-1.5 py-1.5 font-normal text-muted">
                      {x.label}
                    </th>
                    {x.values.map((v) => (
                      <td key={v.column} className="px-1.5 py-1.5 text-right font-mono tabular-nums" title={v.column}>
                        {x.unit === "%" ? `${v.value}%` : x.unit === "x" ? `${v.value.toFixed(2)}×` : num(v.value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 px-1.5 text-[11px] text-faint">Columns follow the statement they come from, oldest first.</p>
          </section>
        )}

        <section className="border-b border-border p-3" aria-labelledby="tables-h">
          <h2 id="tables-h" className="px-1.5 pb-2 text-[11px] font-medium tracking-wide text-faint uppercase">
            Tables · {r.tables.length}
          </h2>
          {r.tables.length === 0 ? (
            <p className="px-1.5 text-[12px] text-muted">No tables with numbers were found.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 px-1.5" role="tablist" aria-label="Tables">
                {r.tables.map((t, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={open === i}
                    onClick={() => {
                      setOpen(i);
                      onFocusLine(t.line);
                    }}
                    className={cn("rounded-md border px-2 py-1 text-[12px]", open === i ? "border-border-strong bg-surface font-medium" : "border-border text-muted hover:text-text")}
                  >
                    {KIND_LABEL[t.kind]}
                  </button>
                ))}
              </div>
              {r.tables[open] && (
                <div className="mt-2 overflow-x-auto" data-testid="report-table">
                  <p className="px-1.5 pb-1 font-medium">{r.tables[open].title}</p>
                  <table className="w-full min-w-[360px] text-left">
                    <thead className="text-[11px] text-faint">
                      <tr>
                        <th className="px-1.5 py-1 font-medium" />
                        {r.tables[open].columns.map((c, i) => (
                          <th key={i} className="px-1.5 py-1 text-right font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.tables[open].rows.map((row) => (
                        <tr
                          key={row.line}
                          className={cn("border-t border-border", focusLine === row.line && "bg-accent-soft", /^(total|toplam)|toplam[ıi]$|^net (cash|increase)/i.test(row.label) && "font-medium")}
                          onMouseEnter={() => onFocusLine(row.line)}
                        >
                          <td className="px-1.5 py-1">{row.label}</td>
                          {row.values.map((v, i) => (
                            <td key={i} className="px-1.5 py-1 text-right font-mono tabular-nums">
                              {num(v, row.percent)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>

        <section className="p-3" aria-labelledby="rchecks-h">
          <h2 id="rchecks-h" className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
            Checks · {a.checks.length}
          </h2>
          <ul className="divide-y divide-border px-1.5" data-testid="checks">
            {a.checks.map((c) => (
              <CheckRow key={c.label} check={c} />
            ))}
          </ul>
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-surface p-3">
        <span className="mr-auto text-[12px] text-muted">Tables, ratios and checks</span>
        <button onClick={exportReport} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 font-medium text-accent-fg hover:opacity-90">
          <FileSpreadsheet className="size-4" aria-hidden />
          Excel
        </button>
      </div>
    </div>
  );
}
