"use client";

import { Code2, FilePlus2, FileSpreadsheet, FileText, Landmark, Languages, LayoutDashboard, Link2, Moon, Receipt, RefreshCw, RotateCcw, Search, ShieldCheck, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataPanel } from "@/components/data-panel";
import { DocList } from "@/components/doc-list";
import { ReportPanel } from "@/components/report-panel";
import { StatementPanel } from "@/components/statement-panel";
import { UnknownPanel } from "@/components/unknown-panel";
import { ThemeToggle, toggleTheme } from "@/components/theme-toggle";
import { Palette, usePaletteShortcut, type Command } from "@/components/palette";
import { useToast } from "@/components/toast";
import { Viewer, type Scanning } from "@/components/viewer";
import { makeDoc, readLines, sampleDocs, TYPE_LABEL, type Doc, type Pending } from "@/lib/documents";
import { LangToggle, useLang } from "@/lib/i18n";

import { download, toCsv, toXlsx } from "@/lib/export";
import { wordsToLines } from "@/lib/layout";
import { FileProblem, rescanUrl, scanFile, type Scan } from "@/lib/ocr-browser";
import { findDuplicates, payStatus } from "@/lib/insights";
import { clearAll, loadAll, remove, saveDoc } from "@/lib/store";
import { Overview } from "@/components/overview";
import type { DocType } from "@/lib/classify";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/cn";

const capitalize = (s: string, lang: string) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1);

/** lucide-react no longer ships brand icons, so the GitHub mark is drawn inline. */
const GithubMark = () => (
  <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

const DOC_TYPES: DocType[] = ["invoice", "receipt", "statement", "report"];
const docTitle = (d: Doc) => (d.type === "statement" ? d.statement.bank.value : d.type === "report" ? d.report.company : d.type === "unknown" ? null : d.invoice.vendor.value) ?? d.name;

export function Workbench() {
  const { toast } = useToast();
  const { t, lang, setLang } = useLang();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  usePaletteShortcut(openPalette);
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
            // Read the saved text again so improvements to the rules reach older uploads too;
            // keep the reviewer's edits and any type they chose by hand.
            const read = readLines(r.doc.lines);
            const chosen = r.type !== r.doc.detected?.type;
            restored.push({ ...r.doc, ...read, type: chosen ? r.type : read.type, invoice: r.invoice, image, imageUrl: URL.createObjectURL(image) });
          }
        }
        next = [...restored.sort((a, b) => b.addedAt - a.addedAt), ...next];
        next.forEach((d) => saved.current.add(d));
        return next;
      });
      setLoaded(true);
      // Open the document a shared link points at; uploads only exist on the device that added them.
      const id = decodeURIComponent(location.hash.slice(1));
      if (id && (id === "overview" || sampleDocs().some((d) => d.id === id) || records.some((r) => r.id === id && !r.sample))) setSelectedId(id);
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
    // The view lives in the URL, so a copied link opens the same document.
    try {
      history.replaceState(history.state, "", `${location.pathname}${location.search}#${id}`);
    } catch {}
  }, []);

  const copyLink = useCallback(async () => {
    const current = docs.find((d) => d.id === selectedId);
    const url = `${location.origin}${location.pathname}${lang === "tr" ? "?lang=tr" : ""}#${selectedId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(current && !current.sample ? t("Link copied. Your uploads stay on this device, so it opens here only.") : t("Link copied. It opens this view with the sample documents."));
    } catch {
      toast(t("The link could not be copied. Copy it from the address bar."), "error");
    }
  }, [docs, selectedId, lang, toast, t]);

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
      toast(t("Document removed from this device"));
    },
    [select, selectedId, toast, t],
  );

  const resetDemo = useCallback(async () => {
    await clearAll();
    const fresh = sampleDocs();
    saved.current = new WeakSet(fresh);
    setDocs(fresh);
    select("halcyon");
    toast(t("Demo reset: your uploads and edits were cleared"));
  }, [select, toast, t]);

  // The command palette resets through an event, so its list never holds the save-tracking ref.
  useEffect(() => {
    const onReset = () => void resetDemo();
    window.addEventListener("tally:reset", onReset);
    return () => window.removeEventListener("tally:reset", onReset);
  }, [resetDemo]);

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
              kind: scan.source === "pdf-text" ? (/\.pdf$/i.test(file.name) ? "PDF · text layer" : (scan.note ?? "Text file")) : "Your document",
              note: scan.note,
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
            if (!added.lines.length) toast(t("No text found. Try a sharper photo or the original PDF."), "error");
            else if (added.type === "unknown") toast(t("{name} doesn't look like an invoice, receipt or statement", { name: file.name }), "error");
          })
          .catch((err: unknown) => {
            // File problems are already worded for people; anything else is most likely the OCR engine failing to load.
            const message =
              err instanceof FileProblem
                ? err.message
                : /fetch|network|load/i.test(String((err as Error)?.message))
                  ? "The OCR engine could not load. Check your connection and try again."
                  : "This file could not be read. Try the original PDF or a sharper photo.";
            console.error(err);
            setPending((p) => p.map((x) => (x.id === id ? { ...x, error: message } : x)));
            toast(`${file.name}: ${t(message)}`, "error");
          });
      }
    },
    [select, toast, t],
  );

  /** Appends photographed or scanned pages to a document: stacked images, the rows read again as one. */
  const addPages = useCallback(
    async (id: string, files: File[]) => {
      const target = docs.find((d) => d.id === id);
      if (!target) return;
      setScanning({ id, stage: "Reading the new page", value: 0 });
      try {
        const scans: Scan[] = [];
        for (const f of files) scans.push(await scanFile(f, (p) => setScanning({ id, ...p })));
        const images = [await createImageBitmap(target.image ?? (await (await fetch(target.imageUrl)).blob())), ...(await Promise.all(scans.map((s) => createImageBitmap(s.image))))];
        const width = Math.max(target.width, ...scans.map((s) => s.width));
        const heights = [target.height, ...scans.map((s) => s.height)];
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = heights.reduce((a, b) => a + b, 0);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let y = 0;
        images.forEach((im, k) => {
          ctx.drawImage(im, 0, y, k === 0 ? target.width : scans[k - 1].width, heights[k]);
          y += heights[k];
        });
        const image = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("render"))), "image/png"));
        let offset = target.height;
        const lines = [...target.lines];
        scans.forEach((s, k) => {
          for (const l of wordsToLines(s.words)) lines.push({ ...l, bbox: l.bbox && { ...l.bbox, y0: l.bbox.y0 + offset, y1: l.bbox.y1 + offset } });
          offset += heights[k + 1];
        });
        const read = readLines(lines);
        const pages = (Number(/(\d+) pages/.exec(target.note ?? "")?.[1]) || 1) + scans.length;
        setDocs((all) => all.map((d) => (d.id === id ? { ...d, ...read, image, imageUrl: URL.createObjectURL(image), width, height: canvas.height, note: `${pages} pages` } : d)));
        toast(t(scans.length === 1 ? "Added {n} page" : "Added {n} pages", { n: scans.length }));
      } catch (err) {
        toast(t(err instanceof FileProblem ? err.message : "That page could not be read."), "error");
      } finally {
        setScanning(null);
      }
    },
    [docs, toast, t],
  );

  const rescan = useCallback(async () => {
    const target = doc;
    setScanning({ id: target.id, stage: "Starting", value: 0 });
    try {
      const words = await rescanUrl(target.imageUrl, (p) => setScanning({ id: target.id, ...p }));
      const read = readLines(wordsToLines(words));
      setDocs((all) => all.map((d) => (d.id === target.id ? { ...d, ...read } : d)));
      toast(t("Read {n} lines in your browser", { n: read.lines.length }));
    } catch {
      toast(t("OCR could not start. Check your connection: the engine loads from a CDN the first time."), "error");
    } finally {
      setScanning(null);
    }
  }, [doc, toast, t]);

  const exportAll = useCallback(
    async (format: "xlsx" | "csv") => {
      const invoices = docs.filter((d) => d.type === "invoice" || d.type === "receipt").map((d) => ({ name: d.name, invoice: d.invoice }));
      const statements = docs.filter((d) => d.type === "statement").map((d) => ({ name: d.name, statement: d.statement }));
      if (format === "csv") download(new Blob([toCsv(invoices)], { type: "text/csv" }), "invoices.csv");
      else download(await toXlsx(invoices, statements), "tally-export.xlsx");
      toast(format === "csv" ? t("Exported {n} invoices", { n: invoices.length }) : t("Exported {n} invoices and {m} statements", { n: invoices.length, m: statements.length }));
    },
    [docs, toast, t],
  );

  const commands = ((): Command[] => {
    const go = t("Go to");
    const act = t("Actions");
    const list: Command[] = [
      { id: "overview", label: t("Overview"), group: go, icon: LayoutDashboard, hint: t("Payments, VAT and cash flow"), run: () => select("overview") },
      ...docs.map((d) => ({
        id: `doc:${d.id}`,
        label: docTitle(d),
        group: t("Documents"),
        icon: d.type === "statement" ? Landmark : d.type === "receipt" ? Receipt : d.type === "report" ? Table2 : FileText,
        hint: t(TYPE_LABEL[d.type]),
        keywords: `${d.name} ${d.kind} ${t(d.kind)} ${t(TYPE_LABEL[d.type])}`,
        run: () => select(d.id),
      })),
    ];
    if (!showOverview)
      for (const ty of DOC_TYPES)
        if (ty !== doc.type) list.push({ id: `as:${ty}`, label: capitalize(t("Read as {type}", { type: t(TYPE_LABEL[ty]).toLocaleLowerCase(lang) }), lang), group: t("This document"), icon: FileText, run: () => setType(doc.id, ty) });
    if (!showOverview && doc.sample) list.push({ id: "ocr", label: t("Run OCR live"), group: t("This document"), icon: RefreshCw, run: () => void rescan() });
    list.push(
      { id: "add", label: t("Add documents"), group: act, icon: FilePlus2, hint: t("Photo, PDF, Office, e-mail"), run: () => window.dispatchEvent(new Event("tally:add-files")) },
      { id: "xlsx", label: t("Export everything to Excel"), group: act, icon: FileSpreadsheet, run: () => void exportAll("xlsx") },
      { id: "csv", label: t("Export invoices as CSV"), group: act, icon: FileSpreadsheet, run: () => void exportAll("csv") },
      { id: "link", label: t("Copy a link to this view"), group: act, icon: Link2, run: () => void copyLink() },
      { id: "theme", label: t("Switch light or dark theme"), group: act, icon: Moon, run: toggleTheme },
      { id: "lang", label: lang === "tr" ? "Switch to English" : "Türkçeye geç", group: act, icon: Languages, run: () => setLang(lang === "tr" ? "en" : "tr") },
      { id: "reset", label: t("Reset demo"), group: act, icon: RotateCcw, hint: t("Clears uploads and edits"), run: () => window.dispatchEvent(new Event("tally:reset")) },
      { id: "source", label: t("Source code on GitHub"), group: act, icon: Code2, run: () => window.open("https://github.com/ozenyunus35/invoice-extractor", "_blank", "noopener") },
    );
    return list;
  })();

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
          <span className="hidden text-muted sm:inline">{t("Invoice reader")}</span>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[12px] text-muted md:inline-flex">
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          {t("Runs in your browser · nothing is uploaded")}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={openPalette} className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2 text-muted hover:bg-surface-2 hover:text-text sm:min-w-44" aria-label={t("Search and commands")} aria-keyshortcuts="Meta+K Control+K">
            <Search className="size-4" aria-hidden />
            <span className="hidden flex-1 text-left sm:inline">{t("Search…")}</span>
            <kbd className="hidden rounded border border-border px-1 text-[10.5px] text-faint sm:inline">⌘K</kbd>
          </button>
          <button onClick={() => exportAll("xlsx")} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 font-medium hover:bg-surface-2">
            <FileSpreadsheet className="size-4 text-success" aria-hidden />
            <span className="hidden sm:inline">{t("Export all")}</span>
            <span className="sm:hidden">Excel</span>
          </button>
          <button onClick={() => exportAll("csv")} className="hidden h-8 items-center rounded-md px-2.5 text-muted hover:bg-surface-2 hover:text-text sm:inline-flex">
            CSV
          </button>
          <button onClick={copyLink} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text max-sm:hidden" aria-label={t("Copy a link to this view")} title={t("Copy a link to this view")}>
            <Link2 className="size-4" />
          </button>
          <LangToggle />
          <ThemeToggle />
          <a href="https://github.com/ozenyunus35/invoice-extractor" target="_blank" rel="noreferrer" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label={t("Source code on GitHub")}>
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

        <div className={cn("flex shrink-0 border-b border-border p-1 lg:hidden", showOverview && "hidden")} role="tablist" aria-label={t("View")}>
          {(["data", "document"] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={cn("flex-1 rounded-md py-1.5 font-medium", mobileTab === tab ? "bg-surface-2 text-text" : "text-muted")}
            >
              {tab === "data" ? t("Extracted data") : t("Document")}
            </button>
          ))}
        </div>

        <main className={cn("min-h-0 min-w-0 flex-1 overflow-hidden", showOverview ? "hidden" : mobileTab === "document" ? "flex" : "hidden lg:flex")}>
          <Viewer key={doc.id} doc={doc} focusLine={focusLine} onHoverLine={setFocusLine} scanning={scanning?.id === doc.id ? scanning : null} onRescan={rescan} onAddPages={(files) => addPages(doc.id, files)} avgConfidence={avgConfidence} />
        </main>

        <aside className={cn("min-h-0 w-full shrink-0 border-border lg:w-[440px] lg:border-l xl:w-[480px]", showOverview ? "hidden" : mobileTab === "data" ? "flex" : "hidden lg:flex")}>
          {doc.type === "report" ? (
            <ReportPanel key={doc.id} doc={doc} onType={(t) => setType(doc.id, t)} focusLine={focusLine} onFocusLine={setFocusLine} />
          ) : doc.type === "statement" ? (
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
      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
}
