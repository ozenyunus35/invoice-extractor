"use client";

import { Sparkles } from "lucide-react";
import type { DocType } from "@/lib/classify";
import { TYPE_LABEL, type Doc } from "@/lib/documents";
import { cn } from "@/lib/cn";
import { useLang } from "@/lib/i18n";

const OPTIONS: DocType[] = ["invoice", "receipt", "statement", "report"];

/** Shows what the document was detected as and lets the reviewer read it as something else. */
export function TypeSwitch({ doc, onChange }: { doc: Doc; onChange: (t: DocType) => void }) {
  const { t, lang } = useLang();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-md border border-border bg-surface-2 p-0.5" role="radiogroup" aria-label={t("Read this document as")}>
        {OPTIONS.map((o) => (
          <button
            key={o}
            role="radio"
            aria-checked={doc.type === o}
            onClick={() => onChange(o)}
            className={cn("rounded px-2 py-0.5 text-[12px] transition-colors", doc.type === o ? "bg-surface font-medium text-text shadow-card" : "text-muted hover:text-text")}
          >
            {t(TYPE_LABEL[o])}
          </button>
        ))}
      </div>
      <span className="inline-flex items-center gap-1 text-[11px] text-faint" title={t(doc.detected.reason)}>
        <Sparkles className="size-3" aria-hidden />
        {t("Detected: {type}", { type: t(TYPE_LABEL[doc.detected.type]).toLocaleLowerCase(lang) })}
      </span>
    </div>
  );
}
