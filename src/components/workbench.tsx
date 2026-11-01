"use client";

import { FileSpreadsheet, FileText, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataPanel } from "@/components/data-panel";
import { DocList } from "@/components/doc-list";
import { StatementPanel } from "@/components/statement-panel";
import { UnknownPanel } from "@/components/unknown-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/toast";
import { Viewer, type Scanning } from "@/components/viewer";
import { makeDoc, readLines, sampleDocs, type Doc, type Pending } from "@/lib/documents";
import { download, toCsv, toXlsx } from "@/lib/export";
import { wordsToLines } from "@/lib/layout";
import { rescanUrl, scanFile } from "@/lib/ocr-browser";
import { findDuplicates, payStatus } from "@/lib/insights";
import { clearAll, loadAll, remove, saveDoc } from "@/lib/store";
import { Overview } from "@/components/overview";
import type { DocType } from "@/lib/classify";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/cn";

/** lucide-react no longer ships brand icons, so the GitHub mark is drawn inline. */
const GithubMark = () => (
  <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export function Workbench() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>(sampleDocs);
  const [pending, setPending] = useState<Pending[]>([]);
  const [selectedId, setSelectedId] = useState("halcyon");
  const [focusLine, setFocusLine] = useState<number | null>(null);
  const [scanning, setScanning] = useState<Scanning | null>(null);
  const [mobileTab, setMobileTab] = useState<"document" | "data">("data");
  const [loaded, setLoaded] = useState(false);
  // Documents already in IndexedDB as they are now; anything else gets written.
  const saved = useRef(new WeakSet<Doc>());

  const doc = docs.find((d) => d.id === selectedId) ?? docs[0];
  const showOverview = selectedId === "overview";

  // Restore uploads and edits from this device.
  useEffect(() => {
    docs.forEach((d) => saved.current.add(d));
    loadAll().then((records) => {
      setDocs((current) => {
        const restored: Doc[] = [];
        let next = current;
        for (const r of records) {
          if (r.sample) next = next.map((d) => (d.id === r.id ? { ...d, type: r.type, invoice: r.invoice } : d));
          else if (r.doc && r.image) {
            const image = new Blob([r.image.data], { type: r.image.type });
            restored.push({ ...r.doc, type: r.type, invoice: r.invoice, image, imageUrl: URL.createObjectURL(image) });
          }
        }
        next = [...restored.sort((a, b) => b.addedAt - a.addedAt), ...next];
        next.forEach((d) => saved.current.add(d));
        return next;
      });
      setLoaded(true);
    });
    // Runs once: the initial sample docs are the baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    for (const d of docs) {
      if (saved.current.has(d)) continue;
      saved.current.add(d);
      void saveDoc(d);
    }
  }, [docs, loaded]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFocusLine(null);
  }, []);

  // ↑/↓ (or j/k) move through the list when no field has focus.
  const order = useMemo(() => ["overview", ...docs.map((d) => d.id)], [docs]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const step = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const i = order.indexOf(selectedId);
      select(order[Math.max(0, Math.min(order.length - 1, i + step))]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, selectedId, select]);

  const duplicates = useMemo(() => findDuplicates(docs), [docs]);

  const updateInvoice = useCallback((id: string, invoice: Invoice) => {
    setDocs((all) => all.map((d) => (d.id === id ? { ...d, invoice } : d)));
  }, []);

  const setType = useCallback((id: string, type: DocType) => {
    setDocs((all) => all.map((d) => (d.id === id ? { ...d, type } : d)));
  }, []);

  const removeDoc = useCallback(
    (id: string) => {
      setDocs((all) => {
        const gone = all.find((d) => d.id === id);
        if (gone && !gone.sample) URL.revokeObjectURL(gone.imageUrl);
        return all.filter((d) => d.id !== id);
      });
      void remove(id);
      if (selectedId === id) select("overview");
      toast("Document removed from this device");
    },
    [select, selectedId, toast],
  );

  const resetDemo = useCallback(async () => {
    await clearAll();
    const fresh = sampleDocs();
    saved.current = new WeakSet(fresh);
    setDocs(fresh);
    select("halcyon");
    toast("Demo reset: your uploads and edits were cleared");
  }, [select, toast]);

  const addFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        setPending((p) => [{ id, name: file.name, stage: "Starting", value: 0 }, ...p]);
        scanFile(file, (pr) => setPending((p) => p.map((x) => (x.id === id ? { ...x, ...pr } : x))))
          .then((scan) => {
            const added = makeDoc({
              id,
              name: file.name,
              kind: scan.source === "pdf-text" ? "PDF · text layer" : "Your document",
              sample: false,
              imageUrl: URL.createObjectURL(scan.image),
              image: scan.image,
              width: scan.width,
              height: scan.height,
              words: scan.words,
              source: scan.source,
              addedAt: Date.now(),
            });
            setDocs((all) => [added, ...all]);
            setPending((p) => p.filter((x) => x.id !== id));
            select(id);
            if (!added.lines.length) toast("No text found. Try a sharper photo or the original PDF.", "error");
            else if (added.type === "unknown") toast(`${file.name} doesn't look like an invoice, receipt or statement`, "error");
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : "Could not read this file";
            setPending((p) => p.map((x) => (x.id === id ? { ...x, error: message } : x)));
            toast(`${file.name}: ${message}`, "error");
          });
      }
    },
    [select, toast],
  );

  const rescan = useCallback(async () => {
    const target = doc;
    setScanning({ id: target.id, stage: "Starting", value: 0 });
    try {
      const words = await rescanUrl(target.imageUrl, (p) => setScanning({ id: target.id, ...p }));
      const read = readLines(wordsToLines(words));
      setDocs((all) => all.map((d) => (d.id === target.id ? { ...d, ...read } : d)));
      toast(`Read ${read.lines.length} lines in your browser`);
    } catch {
      toast("OCR could not start. Check your connection: the engine loads from a CDN the first time.", "error");
    } finally {
      setScanning(null);
    }
  }, [doc, toast]);

  const exportAll = useCallback(
    async (format: "xlsx" | "csv") => {
      const invoices = docs.filter((d) => d.type === "invoice" || d.type === "receipt").map((d) => ({ name: d.name, invoice: d.invoice }));
      const statements = docs.filter((d) => d.type === "statement").map((d) => ({ name: d.name, statement: d.statement }));
      if (format === "csv") download(new Blob([toCsv(invoices)], { type: "text/csv" }), "invoices.csv");
      else download(await toXlsx(invoices, statements), "tally-export.xlsx");
      toast(format === "csv" ? `Exported ${invoices.length} invoices` : `Exported ${invoices.length} invoices and ${statements.length} statements`);
    },
    [docs, toast],
  );

  const avgConfidence = useMemo(() => {
    const ls = doc.lines.filter((l) => l.confidence !== undefined);
    return ls.length ? Math.round(ls.reduce((s, l) => s + (l.confidence ?? 0), 0) / ls.length) : null;
  }, [doc]);

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-accent text-accent-fg" aria-hidden>
            <FileText className="size-3.5" />
          </span>
          <span className="text-[14px] font-semibold tracking-tight">Tally</span>
          <span className="hidden text-muted sm:inline">Invoice reader</span>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[12px] text-muted md:inline-flex">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          Runs in your browser · nothing is uploaded
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => exportAll("xlsx")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 font-medium hover:bg-surface-2">
            <FileSpreadsheet className="size-4 text-success" aria-hidden />
            <span className="hidden sm:inline">Export all</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button onClick={() => exportAll("csv")} className="hidden h-8 items-center rounded-md px-2.5 text-muted hover:bg-surface-2 hover:text-text sm:inline-flex">
            CSV
          </button>
          <ThemeToggle />
          <a href="https://github.com/ozenyunus35/invoice-extractor" target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="Source code on GitHub">
            <GithubMark />
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <DocList
          docs={docs}
          pending={pending}
          selectedId={showOverview ? "overview" : doc.id}
          onSelect={select}
          onFiles={addFiles}
          onRemove={removeDoc}
          onDismiss={(id) => setPending((p) => p.filter((x) => x.id !== id))}
        />

        {showOverview && <Overview docs={docs} onOpen={select} onExport={exportAll} onReset={resetDemo} />}

        <div className={cn("flex shrink-0 border-b border-border p-1 lg:hidden", showOverview && "hidden")} role="tablist" aria-label="View">
          {(["data", "document"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={mobileTab === t}
              onClick={() => setMobileTab(t)}
              className={cn("flex-1 rounded-md py-1.5 font-medium capitalize", mobileTab === t ? "bg-surface-2 text-text" : "text-muted")}
            >
              {t === "data" ? "Extracted data" : "Document"}
            </button>
          ))}
        </div>

        <main className={cn("min-h-0 min-w-0 flex-1", showOverview ? "hidden" : mobileTab === "document" ? "flex" : "hidden lg:flex")}>
          <Viewer key={doc.id} doc={doc} focusLine={focusLine} onHoverLine={setFocusLine} scanning={scanning?.id === doc.id ? scanning : null} onRescan={rescan} avgConfidence={avgConfidence} />
        </main>

        <aside className={cn("min-h-0 w-full shrink-0 border-border lg:w-[440px] lg:border-l xl:w-[480px]", showOverview ? "hidden" : mobileTab === "data" ? "flex" : "hidden lg:flex")}>
          {doc.type === "statement" ? (
            <StatementPanel key={doc.id} doc={doc} onType={(t) => setType(doc.id, t)} focusLine={focusLine} onFocusLine={setFocusLine} />
          ) : doc.type === "unknown" ? (
            <UnknownPanel key={doc.id} doc={doc} onType={(t) => setType(doc.id, t)} onFocusLine={setFocusLine} />
          ) : (
            <DataPanel
              key={doc.id}
              doc={doc}
              onChange={(inv) => updateInvoice(doc.id, inv)}
              onType={(t) => setType(doc.id, t)}
              duplicateOf={duplicates.get(doc.id) ?? null}
              pay={payStatus(doc, docs)}
              onOpen={select}
              focusLine={focusLine}
              onFocusLine={setFocusLine}
              onShowSource={(line) => {
                setFocusLine(line);
                setMobileTab("document");
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
