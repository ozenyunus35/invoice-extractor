"use client";

import { FileQuestion } from "lucide-react";
import { TypeSwitch } from "@/components/type-switch";
import type { DocType } from "@/lib/classify";
import type { Doc } from "@/lib/documents";

/** Shown when the text does not look like an invoice, receipt or statement: say so instead of guessing. */
export function UnknownPanel({ doc, onType, onFocusLine }: { doc: Doc; onType: (t: DocType) => void; onFocusLine: (l: number | null) => void }) {
  return (
    <div className="flex min-h-0 w-full flex-col overflow-y-auto">
      <section className="animate-enter border-b border-border p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
            <FileQuestion className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-[15px] font-semibold" data-testid="summary">
              This doesn&apos;t look like an invoice, receipt or bank statement
            </h1>
            <p className="mt-1 text-muted">{doc.detected.reason}. Nothing was filled in, so no wrong numbers end up in your books. If it is one of these, pick the type and Tally will read it that way.</p>
          </div>
        </div>
        <div className="mt-4">
          <TypeSwitch doc={doc} onChange={onType} />
        </div>
      </section>
      <section className="p-3">
        <h2 className="px-1.5 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">Text found · {doc.lines.length} lines</h2>
        {doc.lines.length === 0 ? (
          <p className="px-1.5 text-[12px] text-muted">No text could be read. A sharper, well-lit photo or the original PDF works best.</p>
        ) : (
          <ol className="font-mono text-[12px]">
            {doc.lines.map((l, i) => (
              <li key={i} className="flex gap-3 rounded px-1.5 py-0.5 hover:bg-surface-2" onMouseEnter={() => onFocusLine(i)}>
                <span className="w-6 shrink-0 text-right text-faint">{i + 1}</span>
                <span className="min-w-0 break-words">{l.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
