/*
 * Documents people send instead of PDFs: Word, Excel and PowerPoint files,
 * their OpenDocument cousins, RTF, CSV and plain text, saved web pages,
 * e-mails (with the invoice attached or in the body) and e-invoice XML
 * (UBL, Turkish e-Fatura, XRechnung, Factur-X/ZUGFeRD).
 *
 * Each becomes text rows (table cells two spaces apart, the way the OCR rows
 * are built), which the same readers then understand. What a file really is
 * comes from its first bytes, not its name: a PDF saved as ".docx" or a
 * photo sent without an extension still opens.
 */

export type Sniffed = "pdf" | "image" | "heic" | "zip" | "ole" | "rtf" | "text" | "unknown";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, k) => b[at + k] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** What the file is, from its first bytes. */
export async function sniff(file: Blob): Promise<Sniffed> {
  const b = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  // Archives first: a ZIP that stores a PDF has "%PDF-" a few bytes in.
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return "zip";
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  // Some PDF writers put a few bytes of junk before the header.
  for (let i = 0; i < Math.min(b.length - 5, 1024); i++) if (startsWith(b, ascii("%PDF-"), i)) return "pdf";
  if (startsWith(b, [0xff, 0xd8, 0xff]) || startsWith(b, [0x89, 0x50, 0x4e, 0x47]) || startsWith(b, ascii("GIF8")) || startsWith(b, ascii("BM"))) return "image";
  if (startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8)) return "image";
  if (startsWith(b, ascii("ftyp"), 4)) {
    const brand = String.fromCharCode(...b.slice(8, 12));
    return /avif|avis/.test(brand) ? "image" : "heic";
  }
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return "heic"; // TIFF: same advice as HEIC
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06])) return "zip";
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "ole";
  if (startsWith(b, ascii("{\\rtf"))) return "rtf";
  if (startsWith(b, [0xff, 0xfe]) || startsWith(b, [0xfe, 0xff])) return "text";
  // Text: no NUL bytes and few control characters.
  let odd = 0;
  for (const v of b) {
    if (v === 0) return "unknown";
    if (v < 9 || (v > 13 && v < 32)) odd++;
  }
  return b.length && odd / b.length < 0.01 ? "text" : "unknown";
}

/** An OLE file (old .doc/.xls) or a password-protected Office file, which Office also stores as OLE. */
export async function isEncryptedOffice(file: Blob): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, Math.min(file.size, 2_000_000)).arrayBuffer());
  const needle = ascii("EncryptedPackage").flatMap((c) => [c, 0]);
  outer: for (let i = 0; i < b.length - needle.length; i++) {
    for (let k = 0; k < needle.length; k++) if (b[i + k] !== needle[k]) continue outer;
    return true;
  }
  return false;
}

/**
 * Bytes to text: a byte-order mark wins, then the declared charset, then
 * UTF-8 if it is valid, else the Windows code page Excel and Outlook use in
 * Turkey (1254) or Western Europe (1252).
 */
export function decodeText(bytes: Uint8Array, charset?: string | null): string {
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) return new TextDecoder("utf-8").decode(bytes.subarray(3));
  if (startsWith(bytes, [0xff, 0xfe])) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (startsWith(bytes, [0xfe, 0xff])) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  if (charset) {
    try {
      return new TextDecoder(charset.trim().toLowerCase()).decode(bytes);
    } catch {
      // Unknown label: fall through to detection.
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // ğĞıİşŞ sit where Windows-1252 has Icelandic letters nobody writes on an invoice.
    const turkish = bytes.some((v) => v === 0xf0 || v === 0xd0 || v === 0xfd || v === 0xdd || v === 0xfe || v === 0xde);
    return new TextDecoder(turkish ? "windows-1254" : "windows-1252").decode(bytes);
  }
}

/** A minimal ZIP reader: Office and OpenDocument files are ZIP archives of XML. */
async function unzip(buf: ArrayBuffer, want: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // The end-of-central-directory record sits in the last 64 KB.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let k = 0; k < count; k++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== 0x02014b50) throw new Error("damaged zip");
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!want(name)) continue;
    if (flags & 1) throw new Error("encrypted zip");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + size > bytes.length) throw new Error("damaged zip");
    const raw = bytes.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      files.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    }
  }
  return files;
}

const parseXml = (data: Uint8Array | undefined) => {
  if (!data) return null;
  const doc = new DOMParser().parseFromString(decodeText(data), "application/xml");
  return doc.getElementsByTagName("parsererror").length ? null : doc;
};
const local = (el: Element) => el.localName;
const kids = (el: Element, name?: string) => Array.from(el.children).filter((c) => !name || local(c) === name);
const all = (el: Element | Document, name: string) => Array.from(el.getElementsByTagName("*")).filter((c) => local(c) === name);
const tidy = (s: string) => s.replace(/[  ]+/g, " ").trim();
/** Tabs and table cells become the two-space column gap the readers expect. */
const cellsToRow = (cells: string[]) => cells.map((c) => tidy(c.replace(/\t+/g, "  ").replace(/ {3,}/g, "  "))).filter(Boolean).join("  ");

/* ------------------------------------------------------------------ Word */

/** The text of one Word paragraph or cell: runs, tabs as gaps, line breaks as new lines. Text boxes are returned apart. */
function wordInline(el: Element, boxes: Element[]): string {
  let s = "";
  for (const c of Array.from(el.children)) {
    const n = local(c);
    if (n === "t") s += c.textContent ?? "";
    else if (n === "tab" || n === "ptab") s += "\t";
    else if (n === "br" || n === "cr") s += "\n";
    else if (n === "noBreakHyphen") s += "-";
    else if (n === "sym") s += String.fromCharCode(parseInt(c.getAttribute("w:char") ?? "20", 16));
    else if (n === "txbxContent") boxes.push(c);
    // Deleted text, field codes and the old-style copy of every drawing are not what the page shows.
    else if (n === "delText" || n === "instrText" || n === "Fallback" || n === "pPr" || n === "rPr" || n === "del") continue;
    else s += wordInline(c, boxes);
  }
  return s;
}

function wordBlocks(el: Element, out: string[]) {
  for (const c of Array.from(el.children)) {
    const n = local(c);
    if (n === "p") {
      const boxes: Element[] = [];
      out.push(...wordInline(c, boxes).split("\n").map((l) => cellsToRow(l.split("\t"))));
      for (const b of boxes) wordBlocks(b, out);
    } else if (n === "tbl") {
      for (const tr of kids(c, "tr")) {
        const cells = kids(tr, "tc").concat(kids(tr, "sdt").flatMap((s) => all(s, "tc")));
        // A table used for layout (a table inside a cell): read its contents as blocks.
        if (cells.some((tc) => all(tc, "tbl").length)) {
          for (const tc of cells) wordBlocks(tc, out);
          continue;
        }
        const texts = cells.map((tc) => {
          const lines: string[] = [];
          wordBlocks(tc, lines);
          return lines.filter(Boolean).join(" ");
        });
        out.push(cellsToRow(texts));
      }
    } else if (n !== "sectPr" && n !== "tblPr" && n !== "Fallback") wordBlocks(c, out);
  }
}

function docxRows(files: Map<string, Uint8Array>): string[] {
  const doc = parseXml(files.get("word/document.xml"));
  if (!doc) throw new Error("no document");
  const part = (prefix: string) => {
    const seen = new Set<string>();
    const rows: string[] = [];
    for (const name of [...files.keys()].filter((n) => n.startsWith(prefix) && n.endsWith(".xml")).sort()) {
      const x = parseXml(files.get(name));
      if (!x) continue;
      const lines: string[] = [];
      wordBlocks(x.documentElement, lines);
      const key = lines.join("\n");
      // Word keeps a first-page, an even-page and a default header, often identical.
      if (!key.trim() || seen.has(key)) continue;
      seen.add(key);
      rows.push(...lines);
    }
    return rows;
  };
  const body: string[] = [];
  wordBlocks(doc.documentElement, body);
  // The letterhead (company name, address) usually lives in the header.
  return [...part("word/header"), ...body, ...part("word/footer")];
}

/* ------------------------------------------------------------------ Excel */

const BUILTIN_DATE = new Set([14, 15, 16, 17, 22, 27, 30, 36, 50, 57]);

type CellFormat = { date: boolean; percent: boolean; decimals: number | null; symbol: string; after: boolean };

function readFormats(styles: Document | null): CellFormat[] {
  if (!styles) return [];
  const custom = new Map<number, string>();
  for (const f of all(styles, "numFmt")) custom.set(Number(f.getAttribute("numFmtId")), f.getAttribute("formatCode") ?? "");
  const xfs = all(styles, "cellXfs")[0];
  if (!xfs) return [];
  return kids(xfs, "xf").map((xf) => {
    const id = Number(xf.getAttribute("numFmtId") ?? 0);
    const code = custom.get(id) ?? (id === 9 || id === 10 ? "0%" : id === 2 || id === 4 ? "0.00" : id === 1 || id === 3 ? "0" : id === 7 || id === 8 ? "$#,##0.00" : "");
    const plain = code.split(";")[0].replace(/"[^"]*"|\\./g, (m) => (m.startsWith('"') ? m : ""));
    const bracket = plain.match(/\[\$([^\]-]*)/);
    const quoted = plain.match(/"([^"]*)"/)?.[1]?.trim();
    const symbol = bracket?.[1] || plain.match(/[€$£₺¥₹]/)?.[0] || (quoted && /^(TL|zł|kr|CHF|EUR|USD|TRY)$/i.test(quoted) ? quoted : "");
    const body = plain.replace(/\[[^\]]*\]|"[^"]*"/g, "");
    const dec = body.match(/\.([0#]+)/);
    return {
      date: BUILTIN_DATE.has(id) || (/[dmy]/i.test(body) && !/[0#]/.test(body)),
      percent: body.includes("%"),
      decimals: dec ? dec[1].length : /[0#]/.test(body) ? 0 : null,
      symbol,
      after: symbol !== "" && plain.indexOf(symbol) > plain.search(/[0#]/),
    };
  });
}

/** Excel stores days since 1899-12-30; shown here as an ISO date the date reader understands. */
const serialToIso = (serial: number) => new Date(Math.round((serial - 25569) * 86_400_000)).toISOString().slice(0, 10);

function formatNumber(raw: string, f: CellFormat | undefined): string {
  const v = Number(raw);
  if (!Number.isFinite(v)) return raw;
  if (f?.date && v > 0 && v < 2_958_466) return serialToIso(v);
  if (f?.percent) return `${Number((v * 100).toPrecision(12))}%`;
  // Floating point noise (603.8700000000001) goes; the format's decimals stay (18.00).
  const n = f?.decimals != null ? v.toFixed(f.decimals) : String(Number(v.toPrecision(12)));
  if (!f?.symbol) return n;
  return f.after ? `${n} ${f.symbol}` : `${f.symbol}${n}`;
}

function xlsxRows(files: Map<string, Uint8Array>): string[] {
  const shared = parseXml(files.get("xl/sharedStrings.xml"));
  // Rich text keeps its runs; phonetic guides (rPh) are not part of the cell.
  const strings = shared ? all(shared, "si").map((si) => [...kids(si, "t"), ...kids(si, "r").flatMap((r) => kids(r, "t"))].map((t) => t.textContent ?? "").join("")) : [];
  const formats = readFormats(parseXml(files.get("xl/styles.xml")));
  // Sheets in the order the workbook lists them, not the order of the file names.
  const book = parseXml(files.get("xl/workbook.xml"));
  const rels = parseXml(files.get("xl/_rels/workbook.xml.rels"));
  const target = new Map(rels ? all(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target") ?? ""]) : []);
  let sheets = book
    ? all(book, "sheet")
        .filter((s) => s.getAttribute("state") !== "hidden" && s.getAttribute("state") !== "veryHidden")
        .map((s) => {
          const t = target.get(s.getAttribute("r:id")) ?? "";
          return t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`;
        })
        .filter((n) => files.has(n))
    : [];
  if (!sheets.length) sheets = [...files.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.slice(19)) - parseInt(b.slice(19)));
  if (!sheets.length) throw new Error("no sheets");
  const out: string[] = [];
  for (const name of sheets) {
    const doc = parseXml(files.get(name));
    if (!doc) continue;
    for (const row of all(doc, "row")) {
      const cells = kids(row, "c").map((c) => {
        const t = c.getAttribute("t");
        const v = kids(c, "v")[0]?.textContent ?? "";
        if (t === "s") return strings[Number(v)] ?? "";
        if (t === "inlineStr") return all(c, "t").map((x) => x.textContent ?? "").join("");
        if (t === "str" || t === "e") return v;
        if (t === "b") return v === "1" ? "TRUE" : "FALSE";
        return v === "" ? "" : formatNumber(v, formats[Number(c.getAttribute("s") ?? 0)]);
      });
      out.push(cellsToRow(cells));
    }
    out.push("");
  }
  return out;
}

/* ------------------------------------------------------------------ PowerPoint */

function pptxRows(files: Map<string, Uint8Array>): string[] {
  const slides = [...files.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.slice(16)) - parseInt(b.slice(16)));
  const out: string[] = [];
  for (const name of slides) {
    const doc = parseXml(files.get(name));
    if (!doc) continue;
    const para = (p: Element) => kids(p).map((r) => (local(r) === "br" ? "\n" : all(r, "t").map((t) => t.textContent ?? "").join(""))).join("");
    const tables = new Set(all(doc, "tbl"));
    for (const tbl of tables) for (const tr of all(tbl, "tr")) out.push(cellsToRow(all(tr, "tc").map((tc) => all(tc, "p").map(para).join(" "))));
    for (const p of all(doc, "p")) {
      if ([...tables].some((t) => t.contains(p)) || local(p.parentElement!) !== "txBody") continue;
      out.push(...para(p).split("\n").map(tidy));
    }
    out.push("");
  }
  return out;
}

/* ------------------------------------------------------------------ OpenDocument */

function odfInline(el: Element): string {
  let s = "";
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) s += n.textContent;
    else if (n.nodeType === 1) {
      const e = n as Element;
      const name = local(e);
      if (name === "s") s += " ".repeat(Number(e.getAttribute("text:c") ?? 1));
      else if (name === "tab") s += "\t";
      else if (name === "line-break") s += "\n";
      else if (name === "note" || name === "annotation") continue;
      else s += odfInline(e);
    }
  }
  return s;
}

function odfRows(doc: Document): string[] {
  const out: string[] = [];
  const walk = (el: Element) => {
    for (const node of Array.from(el.children)) {
      const n = local(node);
      if (n === "table-row") {
        // Spreadsheets repeat empty rows and cells by the thousand ("number-rows-repeated").
        const cells = kids(node).filter((c) => local(c) === "table-cell" || local(c) === "covered-table-cell");
        const texts = cells.map((c) => kids(c, "p").map((p) => odfInline(p).replace(/\n/g, " ")).join(" "));
        const row = cellsToRow(texts);
        if (row) out.push(row);
      } else if (n === "p" || n === "h") out.push(...odfInline(node).split("\n").map((l) => cellsToRow(l.split("\t"))));
      else if (n === "frame" || n === "text-box") walk(node);
      else if (n !== "annotation" && n !== "note" && n !== "tracked-changes") walk(node);
    }
  };
  walk(doc.documentElement);
  return out;
}

/* ------------------------------------------------------------------ RTF */

/** RTF from TextEdit, WordPad and many accounting exports: text, tabs, table cells and code-page bytes. */
export function rtfRows(rtf: string): string[] {
  let out = "";
  let bytes: number[] = [];
  let codepage = "windows-1252";
  const flush = () => {
    if (bytes.length) out += new TextDecoder(codepage).decode(new Uint8Array(bytes));
    bytes = [];
  };
  const skipGroups = /^(fonttbl|colortbl|stylesheet|info|pict|object|themedata|colorschememapping|latentstyles|datastore|xmlnstbl|listtable|listoverridetable|rsidtbl|generator|filetbl|revtbl|fldinst|nonshppict|shpinst|mmathPr|pgdsctbl)$/;
  const stack: { skip: boolean; uc: number }[] = [{ skip: false, uc: 1 }];
  let skipChars = 0;
  for (let i = 0; i < rtf.length; i++) {
    const ch = rtf[i];
    const top = stack[stack.length - 1];
    if (ch === "{") {
      stack.push({ ...top });
      // "{\*\destination ...}" is something a reader may ignore.
      if (rtf.startsWith("\\*", i + 1)) stack[stack.length - 1].skip = true;
      continue;
    }
    if (ch === "}") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (ch === "\\") {
      const next = rtf[i + 1];
      if (next === "'") {
        const v = parseInt(rtf.slice(i + 2, i + 4), 16);
        i += 3;
        if (skipChars > 0) skipChars--;
        else if (!top.skip) bytes.push(v);
        continue;
      }
      if (next === "\\" || next === "{" || next === "}") {
        i++;
        if (!top.skip) {
          flush();
          out += next;
        }
        continue;
      }
      // A backslash at the end of a line is a paragraph break (TextEdit writes them).
      if (next === "\n" || next === "\r") {
        i++;
        if (!top.skip) {
          flush();
          out += "\n";
        }
        continue;
      }
      if (next === "~") {
        i++;
        if (!top.skip) out += " ";
        continue;
      }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i + 1, i + 40));
      if (!m) {
        i++;
        continue;
      }
      i += m[0].length;
      const [word, arg] = [m[1], m[2] === undefined ? null : Number(m[2])];
      if (skipGroups.test(word)) {
        top.skip = true;
        continue;
      }
      if (word === "ansicpg" && arg) codepage = `windows-${arg}`;
      if (word === "uc" && arg !== null) top.uc = arg;
      if (top.skip) continue;
      flush();
      if (word === "par" || word === "line" || word === "row" || word === "sect" || word === "page") out += "\n";
      else if (word === "tab" || word === "cell") out += "\t";
      else if (word === "u" && arg !== null) {
        out += String.fromCharCode(arg < 0 ? arg + 65536 : arg);
        skipChars = top.uc;
      }
      continue;
    }
    if (ch === "\r" || ch === "\n") continue;
    if (top.skip) continue;
    if (skipChars > 0) {
      skipChars--;
      continue;
    }
    flush();
    out += ch;
  }
  flush();
  return out.split("\n").map((l) => cellsToRow(l.split("\t")));
}

/* ------------------------------------------------------------------ CSV and text */

/** CSV or TSV: the separator is the one that splits the first lines most evenly; quoted cells may hold separators and line breaks. */
export function csvRows(text: string): string[] {
  let body = text.replace(/^﻿/, "");
  let sep: string | undefined;
  const hint = body.match(/^sep=(.)\r?\n/);
  if (hint) {
    sep = hint[1];
    body = body.slice(hint[0].length);
  }
  if (!sep) {
    const sample = body.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
    let best = -1;
    for (const s of [";", "\t", ",", "|"]) {
      const counts = sample.map((l) => l.split(s).length - 1);
      const lines = counts.filter((c) => c > 0).length;
      const score = lines * 10 + Math.max(0, ...counts) - (new Set(counts.filter((c) => c > 0)).size - 1);
      if (lines && score > best) [best, sep] = [score, s];
    }
  }
  sep ??= ",";
  const rows: string[] = [];
  let cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch === "\n" || ch === "\r" ? " " : ch;
    } else if (ch === '"' && !cur.trim()) quoted = true;
    else if (ch === sep) {
      cells.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && body[i + 1] === "\n") i++;
      cells.push(cur);
      rows.push(cellsToRow(cells));
      cells = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || cells.length) {
    cells.push(cur);
    rows.push(cellsToRow(cells));
  }
  return rows;
}

/* ------------------------------------------------------------------ Web pages and e-mail */

/** Web pages and e-mails: table rows as cells, block elements and line breaks as lines. */
export function htmlRows(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, head, template, noscript").forEach((n) => n.remove());
  // Hidden preheader text in marketing e-mails.
  doc.querySelectorAll('[style*="display:none"], [style*="display: none"]').forEach((n) => n.remove());
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  // A heading and the text after it in the same cell are separate lines.
  doc.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, address, blockquote, pre, dt, dd").forEach((el) => el.append("\n"));
  const out: string[] = [];
  const text = (el: Element) => (el.textContent ?? "").split("\n").map(tidy);
  const BLOCK = /^(P|DIV|LI|H[1-6]|SECTION|ARTICLE|HEADER|FOOTER|TD|TH|PRE|BLOCKQUOTE|ADDRESS|DT|DD|CENTER|FONT|SPAN|A|B|STRONG)$/;
  const walk = (el: Element) => {
    for (const child of Array.from(el.childNodes)) {
      // Loose text beside block elements ("Total: <b>…</b>" inside a bare div).
      if (child.nodeType === 3) {
        out.push(...(child.textContent ?? "").split("\n").map(tidy).filter(Boolean));
        continue;
      }
      if (child.nodeType !== 1) continue;
      const node = child as Element;
      if (node.tagName === "TR") {
        // A layout table (an e-mail built from nested tables): go inside instead.
        if (node.querySelector("table")) walk(node);
        else {
          const cells = Array.from(node.children).map((c) => text(c).filter(Boolean));
          if (cells.some((c) => c.length > 1)) {
            // Cells with several lines (an address block beside an invoice number): one row per line.
            const depth = Math.max(...cells.map((c) => c.length));
            for (let k = 0; k < depth; k++) out.push(cellsToRow(cells.map((c) => c[k] ?? "")));
          } else out.push(cellsToRow(cells.map((c) => c[0] ?? "")));
        }
      } else if (BLOCK.test(node.tagName) && !node.querySelector("tr, p, div, li, table, h1, h2, h3, h4")) out.push(...text(node).filter(Boolean));
      else walk(node);
    }
  };
  walk(doc.body);
  return out;
}

type MimePart = { headers: Map<string, string>; body: Uint8Array };

const binary = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};
const toBytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

function parsePart(raw: string): MimePart {
  const split = raw.search(/\r?\n\r?\n/);
  const head = split < 0 ? raw : raw.slice(0, split);
  const body = split < 0 ? "" : raw.slice(split).replace(/^\r?\n\r?\n/, "");
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) headers.set(m[1].toLowerCase(), m[2]);
  }
  const enc = (headers.get("content-transfer-encoding") ?? "").toLowerCase();
  let bytes: Uint8Array;
  if (enc.includes("base64")) {
    try {
      bytes = toBytes(atob(body.replace(/[^A-Za-z0-9+/=]/g, "")));
    } catch {
      bytes = toBytes(body);
    }
  } else if (enc.includes("quoted-printable")) bytes = toBytes(body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))));
  else bytes = toBytes(body);
  return { headers, body: bytes };
}

/** A header parameter; RFC 2231 names (filename*=utf-8''Rechnung%20M%C3%A4rz.docx) are decoded. */
const param = (header: string | undefined, name: string) => {
  const m = header?.match(new RegExp(`${name}(\\*)?=\\s*"?([^";]+)"?`, "i"));
  if (!m) return undefined;
  if (!m[1]) return m[2];
  try {
    return decodeURIComponent(m[2].replace(/^[\w-]*'[\w-]*'/, ""));
  } catch {
    return m[2];
  }
};

/** Every leaf part of a MIME message, nested multiparts included. */
function mimeLeaves(raw: string): MimePart[] {
  const part = parsePart(raw);
  const type = part.headers.get("content-type") ?? "text/plain";
  const boundary = param(type, "boundary");
  if (!/^multipart\//i.test(type) || !boundary) return [part];
  const text = binary(part.body);
  const chunks = text.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?[ \\t]*\\r?\\n?`));
  return chunks.slice(1).filter((c) => c.trim()).flatMap((c) => mimeLeaves(c));
}

export type Extracted = {
  rows: string[];
  /** What the file turned out to be, for the reviewer: "Word document", "E-mail with a PDF attached". */
  kind: string;
  /** Pictures inside the file, largest first: read with OCR when the file has no text of its own. */
  images: Blob[];
  /** Documents attached to an e-mail. */
  attachments: File[];
};

function emlContent(bytes: Uint8Array): Extracted {
  const leaves = mimeLeaves(binary(bytes));
  const attachments: File[] = [];
  let html: string | null = null;
  let plain: string | null = null;
  for (const p of leaves) {
    const type = (p.headers.get("content-type") ?? "text/plain").split(";")[0].trim().toLowerCase();
    const disposition = p.headers.get("content-disposition") ?? "";
    const name = param(disposition, "filename") ?? param(p.headers.get("content-type"), "name");
    if (name || /attachment/i.test(disposition) || !type.startsWith("text/")) {
      if (p.body.length) attachments.push(new File([p.body as BlobPart], name ?? `attachment.${type.split("/")[1] ?? "bin"}`, { type }));
      continue;
    }
    const text = decodeText(p.body, param(p.headers.get("content-type"), "charset"));
    if (type === "text/html") html ??= text;
    else plain ??= text;
  }
  const rows = html !== null ? htmlRows(html) : (plain ?? "").split(/\r?\n/);
  return { rows, kind: "E-mail", images: [], attachments };
}

/* ------------------------------------------------------------------ E-invoice XML */

/**
 * Structured e-invoices: UBL 2.1 (Peppol, XRechnung, Turkish e-Fatura UBL-TR)
 * and UN/CEFACT CII (Factur-X, ZUGFeRD). The figures are exact, so they are
 * written out as a plain invoice page for the same reader.
 */
function einvoiceRows(doc: Document): string[] | null {
  const root = doc.documentElement;
  const first = (el: Element | Document, ...path: string[]): Element | undefined => {
    let cur: Element[] = el instanceof Document ? [el.documentElement] : [el];
    for (const name of path) cur = cur.flatMap((c) => kids(c, name));
    return cur[0];
  };
  const txt = (el: Element | undefined) => tidy(el?.textContent ?? "");
  const amount = (el: Element | undefined, cur: string) => (el ? `${Number(txt(el)).toFixed(2)} ${el.getAttribute("currencyID") ?? cur}` : "");
  const rows: string[] = [];
  const isoDate = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);

  if (local(root) === "Invoice" || local(root) === "CreditNote") {
    const credit = local(root) === "CreditNote";
    const cur = txt(first(root, "DocumentCurrencyCode")) || "EUR";
    const party = (role: string) => first(root, role, "Party");
    const partyName = (p: Element | undefined) => txt(p && (first(p, "PartyName", "Name") ?? first(p, "PartyLegalEntity", "RegistrationName") ?? first(p, "Person", "FamilyName")));
    const seller = party("AccountingSupplierParty");
    const buyer = party("AccountingCustomerParty");
    rows.push(partyName(seller), credit ? "CREDIT NOTE" : "INVOICE");
    const addr = seller && first(seller, "PostalAddress");
    if (addr) rows.push([txt(first(addr, "StreetName")), txt(first(addr, "BuildingNumber")), txt(first(addr, "PostalZone")), txt(first(addr, "CityName"))].filter(Boolean).join(" "));
    const taxId = seller && (txt(first(seller, "PartyTaxScheme", "CompanyID")) || txt(all(seller, "ID").find((e) => /VKN|TCKN/.test(e.getAttribute("schemeID") ?? ""))));
    rows.push(`Invoice No:  ${txt(first(root, "ID"))}`, `Invoice Date:  ${txt(first(root, "IssueDate"))}`);
    const due = txt(first(root, "DueDate")) || txt(first(root, "PaymentMeans", "PaymentDueDate"));
    if (due) rows.push(`Due Date:  ${due}`);
    if (taxId) rows.push(`VAT No:  ${taxId}`);
    rows.push("Bill to", partyName(buyer), "", "Description  Qty  Unit price  Amount");
    for (const line of kids(root, credit ? "CreditNoteLine" : "InvoiceLine")) {
      const qty = txt(first(line, credit ? "CreditedQuantity" : "InvoicedQuantity")) || "1";
      const name = txt(first(line, "Item", "Name")) || txt(first(line, "Item", "Description")) || "Item";
      rows.push(`${name}  ${Number(qty)}  ${amount(first(line, "Price", "PriceAmount"), cur)}  ${amount(first(line, "LineExtensionAmount"), cur)}`);
    }
    rows.push("");
    const totals = first(root, "LegalMonetaryTotal");
    rows.push(`Subtotal  ${amount(totals && (first(totals, "TaxExclusiveAmount") ?? first(totals, "LineExtensionAmount")), cur)}`);
    for (const t of kids(root, "TaxTotal").flatMap((t) => kids(t, "TaxSubtotal"))) {
      const pct = txt(first(t, "Percent")) || txt(first(t, "TaxCategory", "Percent"));
      rows.push(`VAT ${Number(pct)}%  ${amount(first(t, "TaxAmount"), cur)}`);
    }
    rows.push(`Total  ${amount(totals && (first(totals, "PayableAmount") ?? first(totals, "TaxInclusiveAmount")), cur)}`);
    return rows.filter((r, k) => r || rows[k - 1]);
  }

  if (local(root) === "CrossIndustryInvoice") {
    const tx = first(root, "SupplyChainTradeTransaction");
    const agreement = tx && first(tx, "ApplicableHeaderTradeAgreement");
    const settlement = tx && first(tx, "ApplicableHeaderTradeSettlement");
    const cur = txt(settlement && first(settlement, "InvoiceCurrencyCode")) || "EUR";
    const seller = agreement && first(agreement, "SellerTradeParty");
    rows.push(txt(seller && first(seller, "Name")), "INVOICE");
    const exch = first(root, "ExchangedDocument");
    rows.push(`Invoice No:  ${txt(exch && first(exch, "ID"))}`, `Invoice Date:  ${isoDate(txt(exch && first(exch, "IssueDateTime", "DateTimeString")))}`);
    const due = settlement && first(settlement, "SpecifiedTradePaymentTerms", "DueDateDateTime", "DateTimeString");
    if (due) rows.push(`Due Date:  ${isoDate(txt(due))}`);
    const vatId = seller && all(seller, "ID").find((e) => e.getAttribute("schemeID") === "VA");
    if (vatId) rows.push(`VAT No:  ${txt(vatId)}`);
    rows.push("Bill to", txt(agreement && first(agreement, "BuyerTradeParty", "Name")), "", "Description  Qty  Unit price  Amount");
    for (const li of tx ? kids(tx, "IncludedSupplyChainTradeLineItem") : []) {
      const name = txt(first(li, "SpecifiedTradeProduct", "Name")) || "Item";
      const qty = txt(first(li, "SpecifiedLineTradeDelivery", "BilledQuantity")) || "1";
      const price = first(li, "SpecifiedLineTradeAgreement", "NetPriceProductTradePrice", "ChargeAmount");
      const total = first(li, "SpecifiedLineTradeSettlement", "SpecifiedTradeSettlementLineMonetarySummation", "LineTotalAmount");
      rows.push(`${name}  ${Number(qty)}  ${amount(price, cur)}  ${amount(total, cur)}`);
    }
    rows.push("");
    const sum = settlement && first(settlement, "SpecifiedTradeSettlementHeaderMonetarySummation");
    rows.push(`Subtotal  ${amount(sum && (first(sum, "TaxBasisTotalAmount") ?? first(sum, "LineTotalAmount")), cur)}`);
    for (const t of settlement ? kids(settlement, "ApplicableTradeTax") : []) rows.push(`VAT ${Number(txt(first(t, "RateApplicablePercent")))}%  ${amount(first(t, "CalculatedAmount"), cur)}`);
    rows.push(`Total  ${amount(sum && (first(sum, "GrandTotalAmount") ?? first(sum, "DuePayableAmount")), cur)}`);
    return rows;
  }
  return null;
}

/* ------------------------------------------------------------------ Flattened tables */

const AMOUNT_CELL = /^[-−(]?\s*(?:[€$£₺¥₹]\s?)?[-−]?\d[\d.,' \u00a0]*\)?\s*(?:%|[€$£₺¥₹]|TL|zł|kr|CHF|EUR|USD|GBP|TRY|PLN)?$/i;

/**
 * Some writers (macOS TextEdit among them) save a table as one paragraph per
 * cell. A run of short headings followed by groups of the same size whose
 * later cells are numbers is put back together as rows, and a label line
 * followed by a lone amount ("Base imponible" / "244,79 €") becomes one row.
 */
export function unflattenTables(rows: string[]): string[] {
  const lines = rows.map((r) => r.trim());
  const out: string[] = [];
  let i = 0;
  const numericGroup = (start: number, k: number) => start + k <= lines.length && lines.slice(start + 1, start + k).every((c) => AMOUNT_CELL.test(c)) && !AMOUNT_CELL.test(lines[start]) && lines[start] !== "";
  while (i < lines.length) {
    let merged = false;
    for (const k of [6, 5, 4, 3]) {
      const head = lines.slice(i, i + k);
      if (head.length < k || !head.every((c) => c && c.length <= 30 && !/\d/.test(c) && !c.includes("  "))) continue;
      if (!numericGroup(i + k, k) || !numericGroup(i + 2 * k, k)) continue;
      out.push(head.join("  "));
      i += k;
      while (numericGroup(i, k)) {
        out.push(lines.slice(i, i + k).join("  "));
        i += k;
      }
      merged = true;
      break;
    }
    if (merged) continue;
    if (lines[i] && !AMOUNT_CELL.test(lines[i]) && lines[i].length <= 40 && !lines[i].includes("  ") && !/\d[.,]\d/.test(lines[i]) && AMOUNT_CELL.test(lines[i + 1] ?? "") && /\d[.,]\d/.test(lines[i + 1] ?? "")) {
      out.push(`${lines[i]}  ${lines[i + 1]}`);
      i += 2;
      continue;
    }
    out.push(rows[i]);
    i++;
  }
  return out;
}

/* ------------------------------------------------------------------ Entry point */

const IMAGE_FILE = /\.(png|jpe?g|gif|bmp|webp)$/i;
const imageType = (n: string) => `image/${n.split(".").pop()!.toLowerCase().replace("jpg", "jpeg")}`;

/**
 * The documents inside a plain ZIP archive (the Turkish e-Arşiv portal, for one,
 * downloads invoices as a ZIP of XML and HTML), without folders or macOS extras.
 */
export async function zipEntries(file: File): Promise<File[]> {
  const files = await unzip(await file.arrayBuffer(), (n) => !n.endsWith("/") && !n.startsWith("__MACOSX/") && !/(^|\/)\.[^/]*$/.test(n));
  return [...files.entries()].map(([n, b]) => new File([b as BlobPart], n.split("/").pop()!, {}));
}

/** Text rows, embedded pictures and attachments from any of the supported documents. */
export async function extractContent(file: File, kind: Sniffed): Promise<Extracted> {
  const content = await readContent(file, kind);
  return { ...content, rows: unflattenTables(content.rows) };
}

async function readContent(file: File, kind: Sniffed): Promise<Extracted> {
  const name = file.name.toLowerCase();
  const none = { images: [] as Blob[], attachments: [] as File[] };
  if (kind === "zip") {
    const buf = await file.arrayBuffer();
    const files = await unzip(buf, (n) => /\.(xml|rels)$/.test(n) || n === "mimetype" || /^(word\/media|xl\/media|ppt\/media|Pictures)\//.test(n));
    const images = [...files.entries()]
      .filter(([n]) => IMAGE_FILE.test(n))
      .sort((a, b) => b[1].length - a[1].length)
      .map(([n, b]) => new Blob([b as BlobPart], { type: imageType(n) }));
    if (files.has("word/document.xml")) return { rows: docxRows(files), kind: "Word document", images, attachments: [] };
    if (files.has("xl/workbook.xml") || [...files.keys()].some((n) => n.startsWith("xl/worksheets/"))) return { rows: xlsxRows(files), kind: "Excel workbook", images, attachments: [] };
    if ([...files.keys()].some((n) => n.startsWith("ppt/slides/"))) return { rows: pptxRows(files), kind: "PowerPoint slides", images, attachments: [] };
    if (files.has("content.xml")) {
      const mime = files.has("mimetype") ? new TextDecoder().decode(files.get("mimetype")) : "";
      const doc = parseXml(files.get("content.xml"));
      if (!doc) throw new Error("damaged");
      return { rows: odfRows(doc), kind: /spreadsheet/.test(mime) ? "OpenDocument spreadsheet" : /presentation/.test(mime) ? "OpenDocument slides" : "OpenDocument text", images, attachments: [] };
    }
    // Office structure without its main part: a damaged document, not an archive.
    if ([...files.keys()].some((n) => /^(word|xl|ppt)\//.test(n) || n === "mimetype")) throw new Error("damaged");
    throw new Error("zip archive");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "rtf") return { rows: rtfRows(binary(bytes)), kind: "RTF document", ...none };
  // An e-mail: a block of "Header: value" lines that names the usual mail headers.
  const top = binary(bytes.subarray(0, 8000));
  const headerBlock = top.split(/\r?\n\r?\n/)[0];
  const mailHeaders = /^[\w-]+:/.test(top) && (headerBlock.match(/^(mime-version|from|to|subject|received|return-path|content-type|message-id|delivered-to|date):/gim) ?? []).length >= 2;
  if (/\.(eml|mht|mhtml)$/.test(name) || mailHeaders) return emlContent(bytes);
  // A charset named in the page itself (<meta charset="windows-1254">).
  const head = binary(bytes.subarray(0, 2048));
  const text = decodeText(bytes, head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? head.match(/<\?xml[^>]+encoding=["']([\w-]+)/i)?.[1]);
  const start = text.trimStart().slice(0, 600);
  if (/^<\?xml|^<(\w+:)?(Invoice|CreditNote|CrossIndustryInvoice)\b/.test(start)) {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const rows = doc.getElementsByTagName("parsererror").length ? null : einvoiceRows(doc);
    if (rows) return { rows, kind: /e-?fatura|UBL-TR|TR1\.2/i.test(text.slice(0, 3000)) ? "e-Fatura (UBL-TR)" : "E-invoice XML", ...none };
    if (!/<html/i.test(start)) throw new Error("xml");
  }
  if (/\.html?$/.test(name) || /^(<!doctype html|<html|<head|<body|<table|<div|<meta)/i.test(start)) return { rows: htmlRows(text), kind: "Web page", ...none };
  if (/\.(csv|tsv)$/.test(name)) return { rows: csvRows(text), kind: "CSV file", ...none };
  // A text file whose lines are all split by the same separator is a CSV without the name.
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  if (!/\.(txt|md)$/.test(name) && lines.length >= 3 && [";", "\t"].some((s) => lines.filter((l) => l.includes(s)).length >= lines.length * 0.8)) return { rows: csvRows(text), kind: "CSV file", ...none };
  return { rows: text.split(/\r?\n/), kind: "Text file", ...none };
}
