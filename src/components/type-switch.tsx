"use client";

import { Sparkles } from "lucide-react";
import type { DocType } from "@/lib/classify";
import { TYPE_LABEL, type Doc } from "@/lib/documents";
import { cn } from "@/lib/cn";

const OPTIONS: DocType[] = ["invoice", "receipt", "statement"];

/** Shows what the document was detected as and lets the reviewer read it as something else. */
export function TypeSwitch({ doc, onChange }: { doc: Doc; onChange: (t: DocType) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-border bg-surface-2 p-0.5" role="radiogroup" aria-label="Read this document as">
        {OPTIONS.map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={doc.type === t}
            onClick={() => onChange(t)}
            className={cn("rounded px-2 py-0.5 text-[12px] transition-colors", doc.type === t ? "bg-surface font-medium text-text shadow-card" : "text-muted hover:text-text")}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] text-faint" title={doc.detected.reason}>
        <Sparkles className="size-3" aria-hidden />
        Detected: {TYPE_LABEL[doc.detected.type].toLowerCase()}
      </span>
    </div>
  );
}
