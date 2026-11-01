"use client";

import { AlertTriangle, Camera, CheckCircle2, FileQuestion, LayoutDashboard, Loader2, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { docChecks, type Doc, type Pending } from "@/lib/documents";
import { statementTotals } from "@/lib/statement";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

const ACCEPT = "application/pdf,image/*,.heic,.heif,.docx,.xlsx,.odt,.ods,.csv,.tsv,.txt,.md,.html,.htm,.eml";

function Status({ doc }: { doc: Doc }) {
  if (doc.type === "unknown")
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted">
        <FileQuestion className="size-3.5" aria-hidden />
        Unknown
      </span>
    );
  const failed = docChecks(doc).filter((c) => c.status === "fail").length;
  return failed ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-warning">
      <AlertTriangle className="size-3.5" aria-hidden />
      {failed} {failed === 1 ? "issue" : "issues"}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-success" title="All checks pass">
      <CheckCircle2 className="size-3.5" aria-hidden />
      OK
    </span>
  );
}

type Props = {
  docs: Doc[];
  pending: Pending[];
  selectedId: string;
  onSelect: (id: string) => void;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onDismiss: (id: string) => void;
};

export function DocList({ docs, pending, selectedId, onSelect, onFiles, onRemove, onDismiss }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const pick = (list: FileList | null) => {
    if (list?.length) onFiles([...list]);
    if (input.current) input.current.value = "";
  };

  return (
    <nav aria-label="Documents" className="flex shrink-0 flex-col border-b border-border lg:w-[264px] lg:border-r lg:border-b-0">
      <input ref={input} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => pick(e.target.files)} data-testid="file-input" />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files)} data-testid="camera-input" />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        className="p-3"
      >
        <button
          onClick={() => input.current?.click()}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition-colors lg:flex-col lg:items-center lg:py-5 lg:text-center",
            over ? "border-accent bg-accent-soft" : "border-border-strong hover:border-accent hover:bg-surface-2",
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-accent">
            <Upload className="size-4" aria-hidden />
          </span>
          <span>
            <span className="block font-medium">Add documents</span>
            <span className="block text-[12px] text-muted">Photo, PDF, Word, Excel, CSV or e-mail · read on this device</span>
          </span>
        </button>
        {/* On a phone, the camera is the quickest way in: lay the receipt flat and shoot from above. */}
        <button
          onClick={() => camera.current?.click()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 font-medium text-accent-fg hover:opacity-90 lg:hidden"
        >
          <Camera className="size-4" aria-hidden />
          Take a photo
        </button>
      </div>

      <div className="px-3 pb-2 max-lg:hidden">
        <button
          onClick={() => onSelect("overview")}
          aria-current={selectedId === "overview" ? "true" : undefined}
          className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition-colors", selectedId === "overview" ? "bg-surface shadow-card ring-1 ring-border-strong" : "text-muted hover:bg-surface-2 hover:text-text")}
        >
          <LayoutDashboard className="size-4" aria-hidden />
          Overview
        </button>
      </div>
      <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase max-lg:hidden">
        Documents · {docs.length}
      </div>

      <ul className="flex gap-2 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:overflow-y-auto lg:pb-3">
        <li className="shrink-0 lg:hidden">
          <button
            onClick={() => onSelect("overview")}
            aria-current={selectedId === "overview" ? "true" : undefined}
            className={cn("flex h-full items-center gap-2 rounded-lg border p-2 font-medium", selectedId === "overview" ? "border-border-strong bg-surface shadow-card" : "border-border bg-surface")}
          >
            <LayoutDashboard className="size-4" aria-hidden />
            Overview
          </button>
        </li>
        {pending.map((p) => (
          <li key={p.id} className="shrink-0 rounded-lg border border-border bg-surface p-2.5 max-lg:w-56 lg:border-transparent lg:bg-transparent" aria-live="polite">
            <div className="flex items-center gap-2">
              {p.error ? <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden /> : <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />}
              <span className="truncate font-medium">{p.name}</span>
              {p.error && (
                <button onClick={() => onDismiss(p.id)} className="ml-auto text-muted hover:text-text" aria-label={`Dismiss ${p.name}`}>
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            {p.error ? (
              <p className="mt-1 text-[12px] text-danger">{p.error}</p>
            ) : (
              <>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(p.value * 100)}%` }} />
                </div>
                <p className="mt-1 text-[12px] text-muted">
                  {p.stage} · {Math.round(p.value * 100)}%
                </p>
              </>
            )}
          </li>
        ))}
        {docs.map((d) => {
          const active = d.id === selectedId;
          return (
            <li key={d.id} className="group relative shrink-0 max-lg:w-56">
              {!d.sample && (
                <button
                  onClick={() => onRemove(d.id)}
                  className="absolute top-1.5 right-1.5 z-10 rounded p-1 text-faint opacity-0 group-hover:opacity-100 hover:bg-surface-2 hover:text-danger focus:opacity-100 max-lg:opacity-100"
                  aria-label={`Remove ${d.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
              <button
                onClick={() => onSelect(d.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                  active ? "border-border-strong bg-surface shadow-card" : "border-border bg-surface hover:bg-surface-2 lg:border-transparent lg:bg-transparent",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of local documents */}
                <img src={d.imageUrl} alt="" className="h-12 w-9 shrink-0 rounded-sm border border-border bg-white object-cover object-top" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{(d.type === "statement" ? d.statement.bank.value : d.type === "report" ? d.report.company : d.type === "unknown" ? null : d.invoice.vendor.value) ?? d.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {d.type === "statement" ? `Statement · ${d.statement.transactions.length} transactions` : d.type === "report" ? `Financial report · ${d.report.tables.length} tables` : d.kind}
                  </span>
                  {d.note && <span className="block truncate text-[11px] text-warning">{d.note}</span>}
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] tabular-nums">
                      {d.type === "statement"
                        ? formatMoney(statementTotals(d.statement).closing, d.statement.currency.value)
                        : d.type === "unknown" || d.type === "report"
                          ? "—"
                          : formatMoney(d.invoice.total.value, d.invoice.currency.value)}
                    </span>
                    <Status doc={d} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
