"""Writes some corpus invoices again as the files people also send: Word,
Excel, OpenDocument, CSV, plain text, a saved web page and an e-mail. Each
gets its own truth entry (same fields as the invoice it copies).
Run after generate.py: python3 scripts/corpus/office.py
"""

import json
import zipfile
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "corpus"
OUT = ROOT / "office"
OUT.mkdir(exist_ok=True)

import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("gen", Path(__file__).with_name("generate.py"))
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)


def rows_for(t: dict) -> tuple[list[str], list[list[str]], list[list[str]]]:
    """Header lines, item rows and totals rows, written the way the locale writes them."""
    loc = gen.LOCALE[t["locale"]]
    lab = gen.L[t["lang"]]
    mn = lambda x: gen.money(x, loc, symbol=False)  # noqa: E731
    m = lambda x: gen.money(x, loc)  # noqa: E731
    head = [t["vendor"], lab["title"], f"{lab['no']}: {t['number']}", f"{lab['date']}: {gen.fmt_date(gen.date.fromisoformat(t['date']), loc)}", f"{lab['due']}: {gen.fmt_date(gen.date.fromisoformat(t['due']), loc)}"]
    items = [[lab["desc"], lab["qty"], lab["unit"], lab["amount"]]] + [[f"Item {k + 1}", str(i["qty"]), mn(i["unit"]), mn(i["amount"])] for k, i in enumerate(t["items"])]
    vat_label = (lambda v: f"Sales Tax ({v['rate']}%)") if t["locale"] == "en-US" else (lambda v: f"{lab['vat']} {v['rate']:g}%" if t["lang"] != "tr" else f"{lab['vat']} %{v['rate']:g}")
    totals = [[lab["sub"], m(t["subtotal"])]] + [[vat_label(v), m(v["amount"])] for v in t["vat"]] + [[lab["total"], m(t["total"])]]
    return head, items, totals


def docx(path: Path, head, items, totals):
    p = lambda s: f'<w:p><w:r><w:t xml:space="preserve">{escape(s)}</w:t></w:r></w:p>'  # noqa: E731
    tc = lambda s: f"<w:tc>{p(s)}</w:tc>"  # noqa: E731
    table = "<w:tbl>" + "".join("<w:tr>" + "".join(tc(c) for c in r) + "</w:tr>" for r in items + totals) + "</w:tbl>"
    body = "".join(p(h) for h in head) + table + p("")
    doc = f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>'
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("word/document.xml", doc)


def xlsx(path: Path, head, items, totals):
    strings: list[str] = []

    def s(v: str) -> str:
        if v not in strings:
            strings.append(v)
        return f'<c t="s"><v>{strings.index(v)}</v></c>'

    rows = [[h] for h in head] + [[]] + items + [[]] + totals
    sheet = "".join(f'<row r="{k + 1}">' + "".join(s(c) for c in r) + "</row>" for k, r in enumerate(rows))
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
        z.writestr("xl/worksheets/sheet1.xml", f'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{sheet}</sheetData></worksheet>')
        z.writestr("xl/sharedStrings.xml", '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + "".join(f"<si><t>{escape(x)}</t></si>" for x in strings) + "</sst>")


def odt(path: Path, head, items, totals):
    p = lambda s: f"<text:p>{escape(s)}</text:p>"  # noqa: E731
    table = "<table:table>" + "".join("<table:table-row>" + "".join(f"<table:table-cell>{p(c)}</table:table-cell>" for c in r) + "</table:table-row>" for r in items + totals) + "</table:table>"
    content = f'<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:body><office:text>{"".join(p(h) for h in head)}{table}</office:text></office:body></office:document-content>'
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", "application/vnd.oasis.opendocument.text", compress_type=zipfile.ZIP_STORED)
        z.writestr("content.xml", content)


def html(head, items, totals) -> str:
    tr = lambda r: "<tr>" + "".join(f"<td>{escape(c)}</td>" for c in r) + "</tr>"  # noqa: E731
    return "<html><body>" + "".join(f"<p>{escape(h)}</p>" for h in head) + "<table>" + "".join(tr(r) for r in items + totals) + "</table></body></html>"


def main():
    manifest = json.loads((ROOT / "truth.json").read_text())
    picks = ["inv-en-GB-classic", "inv-de-multi-vat", "inv-tr-discount", "inv-fr-classic", "inv-es-modern", "inv-pl-classic", "inv-en-US-classic"]
    fmts = ["docx", "xlsx", "odt", "csv", "txt", "html", "eml"]
    extra = []
    for k, name in enumerate(picks):
        t = next(e for e in manifest if e["name"] == name)["truth"]
        head, items, totals = rows_for(t)
        for fmt in fmts if k < 3 else fmts[k % len(fmts) : k % len(fmts) + 2]:
            f = OUT / f"{name}.{fmt}"
            if fmt == "docx":
                docx(f, head, items, totals)
            elif fmt == "xlsx":
                xlsx(f, head, items, totals)
            elif fmt == "odt":
                odt(f, head, items, totals)
            elif fmt == "csv":
                sep = ";" if gen.LOCALE[t["locale"]]["dec"] == "," else ","
                f.write_text("\n".join(sep.join(f'"{c}"' if sep in c else c for c in r) for r in [[h] for h in head] + items + totals), encoding="utf-8")
            elif fmt == "txt":
                f.write_text("\n".join(head + ["    ".join(r) for r in items + totals]), encoding="utf-8")
            elif fmt == "html":
                f.write_text(html(head, items, totals), encoding="utf-8")
            elif fmt == "eml":
                body = html(head, items, totals)
                f.write_text(f"From: billing@{t['vendor'].split()[0].lower()}.example\nTo: ap@client.example\nSubject: {t['number']}\nMIME-Version: 1.0\nContent-Type: text/html; charset=utf-8\nContent-Transfer-Encoding: 8bit\n\n{body}\n", encoding="utf-8")
            extra.append(dict(name=f"off-{name}-{fmt}", file=f.name, width=1240, height=1754, truth=dict(t, layout=f"office-{fmt}", pdf_only=False, office=f.name)))
    manifest = [e for e in manifest if not e["name"].startswith("off-")] + extra
    (ROOT / "truth.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(extra)} office documents")


if __name__ == "__main__":
    main()
