"use client";

import { Eye, EyeOff, Maximize2, Minimize2, RefreshCw, ScanText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Doc } from "@/lib/documents";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/cn";

export type Scanning = { id: string; stage: string; value: number };

/** Line indexes that some extracted value came from. */
function usedLines(inv: Invoice): Set<number> {
  const fields = [inv.vendor, inv.taxId, inv.invoiceNumber, inv.date, inv.dueDate, inv.subtotal, inv.total];
  return new Set(
    [...fields.map((f) => f.line), ...inv.items.map((i) => i.line), ...inv.vat.map((v) => v.line)].filter((l): l is number => l !== null),
  );
}

type Props = {
  doc: Doc;
  focusLine: number | null;
  onHoverLine: (line: number | null) => void;
  scanning: Scanning | null;
  onRescan: () => void;
  avgConfidence: number | null;
};

export function Viewer({ doc, focusLine, onHoverLine, scanning, onRescan, avgConfidence }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [actual, setActual] = useState(false);
  const used = useMemo(
    () => (doc.type === "statement" ? new Set(doc.statement.transactions.map((t) => t.line)) : doc.type === "unknown" ? new Set<number>() : usedLines(doc.invoice)),
    [doc.type, doc.statement, doc.invoice],
  );
  const boxes = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (focusLine === null) return;
    boxes.current.get(focusLine)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusLine]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="truncate font-medium">{doc.name}</span>
        <span className="hidden items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[12px] text-muted sm:inline-flex">
          <ScanText className="size-3.5" aria-hidden />
          {doc.source === "pdf-text" ? "PDF text layer" : `OCR${avgConfidence !== null ? ` · ${avgConfidence}% confidence` : ""}`}
          {` · ${doc.lines.length} lines`}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {doc.sample && (
            <button onClick={onRescan} disabled={!!scanning} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-muted hover:bg-surface-2 hover:text-text disabled:opacity-50" title="Run OCR on this image again, in your browser">
              <RefreshCw className={cn("size-4", scanning && "animate-spin")} aria-hidden />
              <span className="hidden xl:inline">Run OCR live</span>
            </button>
          )}
          <button onClick={() => setShowAll((v) => !v)} aria-pressed={showAll} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text" title={showAll ? "Hide detected lines" : "Show every detected line"}>
            {showAll ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button onClick={() => setActual((v) => !v)} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text max-sm:hidden" title={actual ? "Fit to width" : "Actual size"}>
            {actual ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-surface-2 p-3 sm:p-6">
        <div className="relative mx-auto animate-rise rounded-sm bg-white shadow-pop" style={actual ? { width: doc.width } : { maxWidth: Math.min(860, doc.width) }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the document itself, at its own size */}
          <img src={doc.imageUrl} alt={`Scan of ${doc.name}`} width={doc.width} height={doc.height} className="block h-auto w-full select-none" draggable={false} />
          <div className="absolute inset-0" onMouseLeave={() => onHoverLine(null)}>
            {doc.lines.map((l, i) => {
              if (!l.bbox) return null;
              const isUsed = used.has(i);
              const focused = focusLine === i;
              const pad = 4;
              return (
                <div
                  key={`${i}-${focused}`}
                  ref={(el) => {
                    if (el) boxes.current.set(i, el);
                    else boxes.current.delete(i);
                  }}
                  data-line={i}
                  onMouseEnter={() => onHoverLine(i)}
                  title={`${l.text}${l.confidence !== undefined ? ` (${l.confidence}%)` : ""}`}
                  className={cn(
                    "absolute rounded-[3px] transition-colors duration-150",
                    focused
                      ? "locate z-10 bg-[rgb(91_91_214/0.16)] ring-2 ring-[#5b5bd6]"
                      : isUsed
                        ? "bg-[rgb(91_91_214/0.07)] ring-1 ring-[rgb(91_91_214/0.35)] hover:bg-[rgb(91_91_214/0.14)]"
                        : showAll
                          ? "ring-1 ring-[rgb(120_120_130/0.45)] hover:bg-black/5"
                          : "hover:bg-black/5",
                  )}
                  style={{
                    left: `${((l.bbox.x0 - pad) / doc.width) * 100}%`,
                    top: `${((l.bbox.y0 - pad) / doc.height) * 100}%`,
                    width: `${((l.bbox.x1 - l.bbox.x0 + pad * 2) / doc.width) * 100}%`,
                    height: `${((l.bbox.y1 - l.bbox.y0 + pad * 2) / doc.height) * 100}%`,
                  }}
                />
              );
            })}
          </div>
          {scanning && (
            <div className="absolute inset-0 overflow-hidden rounded-sm bg-[rgb(12_13_15/0.35)]" role="status">
              <div className="scan-line absolute inset-x-0 h-0.5 bg-[#7c82ee] shadow-[0_0_12px_2px_rgb(124_130_238/0.6)]" />
              <div className="absolute inset-x-0 top-6 mx-auto w-fit rounded-full bg-surface px-3 py-1.5 text-[12px] font-medium shadow-pop">
                {scanning.stage} · {Math.round(scanning.value * 100)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
