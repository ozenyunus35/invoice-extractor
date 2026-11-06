"use client";

import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, FileSpreadsheet, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { CheckRow } from "@/components/data-panel";
import { useToast } from "@/components/toast";
import { TypeSwitch } from "@/components/type-switch";
import type { DocType } from "@/lib/classify";
import type { Doc } from "@/lib/documents";
import { download, statementCsv, statementXlsx } from "@/lib/export";
import { formatDate, formatMoney } from "@/lib/format";
import { chronological, statementTotals, validateStatement } from "@/lib/statement";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";

type Props = {
  doc: Doc;
  onType: (t: DocType) => void;
  focusLine: number | null;
  onFocusLine: (line: number | null) => void;
};

/** Balance over the period as a small area chart, drawn from the running balances; hover shows each day. */
function BalanceChart({ points, currency }: { points: { date: string; balance: number }[]; currency: string | null }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const w = 400;
  const h = 72;
  const values = points.map((p) => p.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 6 - ((p.balance - min) / span) * (h - 14)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const at = hover === null ? null : { x: xy[hover][0] / w, y: xy[hover][1] / h, p: points[hover] };
  return (
    <figure className="mt-3">
      <div
        className="relative"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (points.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[72px] w-full" preserveAspectRatio="none" role="img" aria-label={t("Balance from {from} to {to}", { from: formatMoney(values[0], currency), to: formatMoney(values.at(-1)!, currency) })}>
          <path d={`${line} L${w},${h} L0,${h} Z`} fill="var(--accent-soft)" />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {at && <line x1={at.x * w} x2={at.x * w} y1={0} y2={h} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />}
        </svg>
        {at && (
          <>
            <span className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent" style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }} />
            <span
              className="pointer-events-none absolute -top-8 z-10 rounded-md border border-border bg-surface px-2 py-1 text-[11px] whitespace-nowrap shadow-pop"
              style={{ left: `${at.x * 100}%`, transform: `translateX(${at.x > 0.75 ? "-100%" : at.x < 0.25 ? "0" : "-50%"})` }}
              data-testid="balance-tip"
            >
              <span className="text-muted">{formatDate(at.p.date)}</span> <span className="font-mono font-medium tabular-nums">{formatMoney(at.p.balance, currency)}</span>
            </span>
          </>
        )}
      </div>
      <figcaption className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{formatDate(points[0].date)}</span>
        <span>{t("Low {low} · High {high}", { low: formatMoney(min, currency), high: formatMoney(max, currency) })}</span>
        <span>{formatDate(points.at(-1)!.date)}</span>
      </figcaption>
    </figure>
  );
}

export function StatementPanel({ doc, onType, focusLine, onFocusLine }: Props) {
  const { toast } = useToast();
  const t = useT();
  const s = doc.statement;
  const cur = s.currency.value;
  const checks = validateStatement(s);
  const failed = checks.filter((c) => c.status === "fail").length;
  const totals = statementTotals(s);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chronological(s).filter(
      (x) => (filter === "all" || (filter === "in" ? x.amount > 0 : x.amount < 0)) && (!q || x.description.toLowerCase().includes(q) || (x.reference ?? "").toLowerCase().includes(q)),
    );
  }, [s, query, filter]);

  const points = useMemo(() => chronological(s).filter((x) => x.balance !== null).map((x) => ({ date: x.date, balance: x.balance! })), [s]);

  const exportStatement = async (format: "xlsx" | "csv") => {
    const base = doc.name.replace(/\.[^.]+$/, "");
    if (format === "csv") download(new Blob([statementCsv([{ name: doc.name, statement: s }])], { type: "text/csv" }), `${base}-transactions.csv`);
    else download(await statementXlsx([{ name: doc.name, statement: s }]), `${base}-transactions.xlsx`);
    toast(t("Downloaded {file}", { file: `${base}-transactions.${format}` }));
  };

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="animate-enter border-b border-border p-4">
          <TypeSwitch doc={doc} onChange={onType} />
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[17px] font-semibold tracking-tight">{s.bank.value ?? t("Bank statement")}</h1>
              <p className="truncate text-[12px] text-muted">
                {[s.holder.value, s.iban.value].filter(Boolean).join(" · ") || t("Account details not found")}
              </p>
            </div>
            <p className="shrink-0 text-right text-[12px] text-muted">
              {formatDate(s.periodStart.value)} – {formatDate(s.periodEnd.value)}
            </p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2">
            {[
              ["Opening", totals.opening, "text-text"],
              ["Money in", totals.moneyIn, "text-success"],
              ["Money out", totals.moneyOut, "text-danger"],
              ["Closing", totals.closing, "text-text"],
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-md border border-border bg-surface px-2.5 py-2">
                <dt className="text-[11px] text-muted">{t(label as string)}</dt>
                <dd className={cn("mt-0.5 truncate font-mono text-[13px] font-medium tabular-nums", tone as string)}>{formatMoney(value as number | null, cur)}</dd>
              </div>
            ))}
          </dl>
          <BalanceChart points={points} currency={cur} />

          <div className={cn("mt-3 flex items-center gap-2 rounded-md px-2.5 py-2 text-[12px]", failed ? "bg-warning-soft text-warning" : "bg-success-soft text-success")} data-testid="summary">
            {failed ? <AlertTriangle className="size-4 shrink-0" aria-hidden /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden />}
            {failed ? t(failed === 1 ? "{n} check needs attention" : "{n} checks need attention", { n: failed }) : t("{n} transactions reconcile", { n: s.transactions.length })}
          </div>
        </section>

        <section className="border-b border-border p-3" aria-labelledby="tx-h">
          <div className="flex flex-wrap items-center gap-2 px-1.5 pb-2">
            <h2 id="tx-h" className="text-[11px] font-medium tracking-wide text-faint uppercase">
              {t("Transactions · {n}", { n: rows.length })}
              {rows.length !== s.transactions.length && ` ${t("of {n}", { n: s.transactions.length })}`}
            </h2>
            <div className="ml-auto inline-flex rounded-md border border-border p-0.5 text-[12px]">
              {(["all", "in", "out"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn("rounded px-1.5", filter === f ? "bg-surface-2 text-text" : "text-muted")}>
                  {f === "all" ? t("All") : f === "in" ? t("In") : t("Out")}
                </button>
              ))}
            </div>
          </div>
          <label className="relative mx-1.5 mb-2 block">
            <Search className="pointer-events-none absolute top-2 left-2 size-4 text-faint" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search description or reference")} aria-label={t("Search transactions")} className="h-8 w-[calc(100%-0px)] rounded-md border border-border bg-surface pr-2 pl-8 focus:border-accent focus:outline-none" />
          </label>
          {s.transactions.length === 0 ? (
            <p className="px-1.5 py-3 text-[12px] text-muted">{t("No transactions were found. If this is not a statement, read it as an invoice or receipt above.")}</p>
          ) : (
            <ul className="divide-y divide-border" data-testid="transactions">
              {rows.map((x) => (
                <li
                  key={x.line}
                  className={cn("flex items-start gap-2.5 rounded-md px-1.5 py-2 transition-colors", focusLine === x.line && "bg-accent-soft")}
                  onMouseEnter={() => onFocusLine(x.line)}
                >
                  <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full", x.amount > 0 ? "bg-success-soft text-success" : "bg-surface-2 text-muted")} aria-hidden>
                    {x.amount > 0 ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words">{x.description}</p>
                    <p className="text-[11px] text-faint">
                      {formatDate(x.date)}
                      {x.reference && ` · ${x.reference}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-mono tabular-nums", x.amount > 0 ? "text-success" : "text-text")}>
                      {x.amount > 0 ? "+" : ""}
                      {formatMoney(x.amount, cur)}
                    </p>
                    {x.balance !== null && <p className="font-mono text-[11px] text-faint tabular-nums">{formatMoney(x.balance, cur)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="p-3" aria-labelledby="schecks-h">
          <h2 id="schecks-h" className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
            {t("Checks")}
          </h2>
          <ul className="divide-y divide-border px-1.5" data-testid="checks">
            {checks.map((c) => (
              <CheckRow key={c.label} check={c} />
            ))}
          </ul>
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-surface p-3">
        <span className="mr-auto text-[12px] text-muted">{t("Transactions")}</span>
        <button onClick={() => exportStatement("xlsx")} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 font-medium text-accent-fg hover:opacity-90">
          <FileSpreadsheet className="size-4" aria-hidden />
          Excel
        </button>
        <button onClick={() => exportStatement("csv")} className="inline-flex h-8 items-center rounded-md border border-border px-2.5 hover:bg-surface-2">
          CSV
        </button>
      </div>
    </div>
  );
}
