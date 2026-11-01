/*
 * Text documents people send instead of PDFs: Word and Excel files, their
 * OpenDocument cousins, CSV and plain text, saved web pages and e-mails.
 * Each becomes text rows (table cells two spaces apart, the way the OCR rows
 * are built), which the same readers then understand.
 */

/** Minimal ZIP reader: Office and OpenDocument files are ZIP archives of XML. */
async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
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
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.(xml|rels)$/.test(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) {
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      files.set(name, new Uint8Array(await new Response(stream).arrayBuffer()));
    }
  }
  return files;
}

const xml = (data: Uint8Array | undefined) => (data ? new DOMParser().parseFromString(new TextDecoder().decode(data), "application/xml") : null);
const byTag = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagName(tag));
const textOf = (node: Element, tag: string) => byTag(node, tag).map((t) => t.textContent ?? "").join("");

/** Word: paragraphs as lines, table rows as cells two spaces apart. */
function docxRows(doc: Document): string[] {
  const out: string[] = [];
  const body = byTag(doc, "w:body")[0];
  if (!body) return out;
  for (const node of Array.from(body.children)) {
    if (node.tagName === "w:tbl") {
      for (const tr of byTag(node, "w:tr")) out.push(byTag(tr, "w:tc").map((tc) => byTag(tc, "w:p").map((p) => textOf(p, "w:t")).join(" ").trim()).join("  "));
    } else if (node.tagName === "w:p") out.push(textOf(node, "w:t"));
  }
  return out;
}

/** Excel: every row of every sheet, shared strings resolved. */
function xlsxRows(files: Map<string, Uint8Array>): string[] {
  const shared = xml(files.get("xl/sharedStrings.xml"));
  const strings = shared ? byTag(shared, "si").map((si) => textOf(si, "t")) : [];
  const out: string[] = [];
  const sheets = [...files.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  for (const name of sheets) {
    const doc = xml(files.get(name))!;
    for (const row of byTag(doc, "row")) {
      const cells = byTag(row, "c").map((c) => {
        const v = byTag(c, "v")[0]?.textContent ?? textOf(c, "t");
        return c.getAttribute("t") === "s" ? (strings[Number(v)] ?? "") : v;
      });
      out.push(cells.join("  "));
    }
    out.push("");
  }
  return out;
}

/** OpenDocument text and spreadsheets: paragraphs, and table rows as cells. */
function odfRows(doc: Document): string[] {
  const out: string[] = [];
  const walk = (el: Element) => {
    for (const node of Array.from(el.children)) {
      if (node.tagName === "table:table-row") out.push(byTag(node, "table:table-cell").map((c) => (c.textContent ?? "").trim()).join("  "));
      else if (node.tagName === "text:p" || node.tagName === "text:h") out.push(node.textContent ?? "");
      else walk(node);
    }
  };
  walk(doc.documentElement);
  return out;
}

/** CSV or TSV: detect the separator, keep quoted cells together. */
export function csvRows(text: string): string[] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  return text.split(/\r?\n/).map((line) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"' && quoted) {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = !quoted;
      else if (ch === sep && !quoted) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells.filter((c, k) => c || k < cells.length - 1).join("  ");
  });
}

/** Web pages and e-mails: table rows as cells, block elements as lines. */
export function htmlRows(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, head").forEach((n) => n.remove());
  const out: string[] = [];
  const walk = (el: Element) => {
    for (const node of Array.from(el.children)) {
      if (node.tagName === "TR") out.push(Array.from(node.children).map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim()).join("  "));
      else if (/^(P|DIV|LI|H[1-6]|BR|SECTION|ARTICLE|HEADER|FOOTER|TD)$/.test(node.tagName) && !node.querySelector("tr, p, div, li, table")) out.push((node.textContent ?? "").replace(/\s+/g, " ").trim());
      else walk(node);
    }
  };
  walk(doc.body);
  return out;
}

/** The HTML or plain-text part of an e-mail (.eml), decoded. */
function emlText(raw: string): { html: boolean; text: string } {
  const decodeQP = (s: string) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const parts = raw.split(/\r?\n--[^\r\n]+/);
  const pick = parts.find((p) => /content-type:\s*text\/html/i.test(p)) ?? parts.find((p) => /content-type:\s*text\/plain/i.test(p)) ?? raw;
  const [head, ...rest] = pick.split(/\r?\n\r?\n/);
  let body = rest.join("\n\n");
  if (/content-transfer-encoding:\s*base64/i.test(head)) body = new TextDecoder().decode(Uint8Array.from(atob(body.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));
  else if (/quoted-printable/i.test(head)) body = new TextDecoder().decode(Uint8Array.from(decodeQP(body), (c) => c.charCodeAt(0)));
  return { html: /text\/html/i.test(head), text: body };
}

export const OFFICE = /\.(docx|xlsx|odt|ods|csv|tsv|txt|html?|eml|md|xml)$/i;

/** Text rows from any of the supported text documents. */
export async function officeRows(file: File): Promise<string[]> {
  const name = file.name.toLowerCase();
  if (/\.(csv|tsv)$/.test(name)) return csvRows(await file.text());
  if (/\.(txt|md)$/.test(name)) return (await file.text()).split(/\r?\n/);
  if (/\.html?$/.test(name)) return htmlRows(await file.text());
  if (/\.eml$/.test(name)) {
    const { html, text } = emlText(await file.text());
    return html ? htmlRows(text) : text.split(/\r?\n/);
  }
  const files = await unzip(await file.arrayBuffer());
  if (name.endsWith(".docx")) return docxRows(xml(files.get("word/document.xml"))!);
  if (name.endsWith(".xlsx")) return xlsxRows(files);
  if (/\.(odt|ods)$/.test(name)) return odfRows(xml(files.get("content.xml"))!);
  throw new Error("unsupported");
}
