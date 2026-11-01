"""The files people really send, with the quirks real software writes.

Each one copies a corpus invoice (so the truth is known) into a file that is
hard to read for its own reasons:

- Word: letterhead in the page header, label<TAB>value lines, numbers split
  over several runs, a tracked change, a content control, a field code, a
  text box saved twice (modern + legacy copy), nested layout tables, and a
  Word file that only holds a pasted photo of the invoice;
- documents written by a real word processor (macOS textutil): .docx, .odt, .rtf;
- Excel: real numbers with currency and date formats, formulas with
  floating-point results, rich text, an inline string, a merged title, a
  hidden sheet, and sheets listed in a different order than their files;
- OpenDocument spreadsheet with thousands of repeated empty cells;
- CSV from Turkish Excel (Windows-1254, "sep=;", a line break inside a cell),
  a UTF-16 tab-separated "Unicode text" export, an ERP "Excel" file that is
  really a web page;
- e-mails: the invoice as a PDF attachment (plus a logo), a quoted-printable
  ISO-8859-9 body built from nested tables, a Word attachment;
- files with the wrong name: a PDF called .docx, a phone photo with no extension;
- e-invoices: Turkish e-Fatura (UBL-TR), XRechnung (UBL) and Factur-X (CII);
- an RTF from an accounting program in code page 1254.

Broken files for the robustness tests go to tests/e2e/fixtures/hard/.
Run after generate.py, render.mjs and photos.py: python3 scripts/corpus/hard.py
"""

from __future__ import annotations

import base64
import importlib.util
import json
import shutil
import subprocess
import tempfile
import zipfile
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "corpus"
OUT = CORPUS / "office"
BROKEN = ROOT / "tests" / "e2e" / "fixtures" / "hard"
OUT.mkdir(exist_ok=True)
BROKEN.mkdir(parents=True, exist_ok=True)

spec = importlib.util.spec_from_file_location("gen", Path(__file__).with_name("generate.py"))
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

NAMES = ["Consulting hours", "Annual software licence", "Printed brochures (500)", "Toner cartridge", "Delivery van rental", "Design revisions", "USB-C docking station", "A4 copy paper (box)", "Website maintenance"]
NAMES_TR = ["Danışmanlık saati", "Yıllık yazılım lisansı", "Broşür baskısı (500 adet)", "Toner kartuşu", "Kamyonet kiralama", "Tasarım revizyonu", "USB-C yerleştirme istasyonu", "A4 fotokopi kağıdı (koli)", "Web sitesi bakımı"]
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'


def truth(name: str) -> dict:
    return next(e for e in json.loads((CORPUS / "truth.json").read_text()) if e["name"] == name)["truth"]


def labels(t: dict):
    loc = gen.LOCALE[t["locale"]]
    lab = gen.L[t["lang"]]
    names = NAMES_TR if t["lang"] == "tr" else NAMES
    d = lambda k: gen.fmt_date(date.fromisoformat(t[k]), loc)  # noqa: E731
    m = lambda x, s=True: gen.money(x, loc, symbol=s)  # noqa: E731
    vat_label = lambda v: f"{lab['vat']} %{v['rate']:g}" if t["lang"] == "tr" else f"{lab['vat']} {v['rate']:g}%"  # noqa: E731
    return loc, lab, names, d, m, vat_label


def docx_zip(path: Path, document: str, extra: dict[str, bytes | str] | None = None):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr("word/document.xml", document)
        for k, v in (extra or {}).items():
            z.writestr(k, v)


def run(text: str, bold=False) -> str:
    rpr = "<w:rPr><w:b/><w:sz w:val=\"20\"/></w:rPr>" if bold else "<w:rPr><w:sz w:val=\"20\"/></w:rPr>"
    return f'<w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'


def split_runs(text: str) -> str:
    """Word splits text into runs wherever formatting or spell-check state changes: "1.2" + "34,56"."""
    cut = max(1, len(text) // 2)
    return f'{run(text[:cut])}<w:proofErr w:type="spellStart"/>{run(text[cut:])}<w:proofErr w:type="spellEnd"/>'


def para(*parts: str) -> str:
    return f'<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9000"/></w:tabs></w:pPr>{"".join(parts)}</w:p>'


TAB = "<w:r><w:tab/></w:r>"


def word_tabs(t: dict, path: Path):
    loc, lab, names, d, m, vat_label = labels(t)
    header = f'<?xml version="1.0" encoding="UTF-8"?><w:hdr {W}>{para(run(t["vendor"], True), TAB, run(lab["title"].upper(), True))}{para(run("12 Harbour Road, Leeds LS1 4DY"))}</w:hdr>'
    field = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + run("1") + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    footer = f'<?xml version="1.0" encoding="UTF-8"?><w:ftr {W}>{para(run("IBAN GB29 0000 0000 0000 0000 00"), TAB, run("Page "), field)}</w:ftr>'
    # The bill-to block sits in a text box: Word stores it twice (DrawingML and a VML fallback).
    box = f'{para(run(lab["bill"], True))}{para(run("Kestrel Foods Ltd"))}{para(run("7 Mill Lane, York"))}'
    textbox = f'<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="1" name="Text Box 1"/><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>{box}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>{box}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>'
    body = [
        para(textbox),
        para(run(f"{lab['no']}:"), TAB, split_runs(t["number"])),
        # The date sits in a content control (a date picker), as templates do.
        f'<w:sdt><w:sdtPr><w:date w:fullDate="{t["date"]}T00:00:00Z"/></w:sdtPr><w:sdtContent>{para(run(lab["date"] + ":"), TAB, run(d("date")))}</w:sdtContent></w:sdt>',
        para(run(f"{lab['due']}:"), TAB, run(d("due"))),
        para(),
    ]
    shd = '<w:shd w:fill="23394D"/>'
    cell = lambda s, shade=False: f'<w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/>{shd if shade else ""}</w:tcPr>{para(split_runs(s) if any(ch.isdigit() for ch in s) else run(s, shade))}</w:tc>'  # noqa: E731
    rows = [[lab["desc"], lab["qty"], lab["unit"], lab["amount"]]] + [[names[k % len(names)], str(i["qty"]), m(i["unit"], False), m(i["amount"], False)] for k, i in enumerate(t["items"])]
    table = "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr>" + "".join("<w:tr>" + "".join(cell(c, k == 0) for c in r) + "</w:tr>" for k, r in enumerate(rows)) + "</w:tbl>"
    body.append(table)
    body.append(para(run(f"{lab['sub']}"), TAB, run(m(t["subtotal"]))))
    for v in t["vat"]:
        body.append(para(run(vat_label(v)), TAB, run(m(v["amount"]))))
    # A tracked change: the old total deleted, the right one inserted.
    wrong = m(round(t["total"] * 1.1, 2))
    body.append(para(run(lab["total"], True), TAB, f'<w:del w:id="1" w:author="Finance"><w:r><w:delText>{escape(wrong)}</w:delText></w:r></w:del><w:ins w:id="2" w:author="Finance">{run(m(t["total"]), True)}</w:ins>'))
    doc = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document {W}><w:body>{"".join(body)}<w:sectPr><w:headerReference w:type="default" r:id="rId8"/></w:sectPr></w:body></w:document>'
    docx_zip(path, doc, {"word/header1.xml": header, "word/header2.xml": header, "word/footer1.xml": footer})


def word_layout(t: dict, path: Path):
    """An invoice laid out with tables inside tables, as many Word templates are."""
    loc, lab, names, d, m, vat_label = labels(t)
    p = lambda s, b=False: para(run(s, b))  # noqa: E731
    tc = lambda inner: '<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>' + inner + "</w:tc>"  # noqa: E731
    meta = "<w:tbl>" + "".join(f"<w:tr>{tc(p(a))}{tc(p(b))}</w:tr>" for a, b in [(f"{lab['no']}:", t["number"]), (f"{lab['date']}:", d("date")), (f"{lab['due']}:", d("due"))]) + "</w:tbl>"
    outer = f"<w:tbl><w:tr>{tc(p(t['vendor'], True) + p('Via Roma 14, Milano'))}{tc(p(lab['title'].upper(), True) + meta + p(''))}</w:tr></w:tbl>"
    items = "<w:tbl>" + "".join("<w:tr>" + "".join(tc(p(c)) for c in r) + "</w:tr>" for r in [[lab["desc"], lab["qty"], lab["unit"], lab["amount"]]] + [[names[k % len(names)], str(i["qty"]), m(i["unit"], False), m(i["amount"], False)] for k, i in enumerate(t["items"])]) + "</w:tbl>"
    totals = "<w:tbl>" + "".join(f"<w:tr>{tc(p(a))}{tc(p(b))}</w:tr>" for a, b in [(lab["sub"], m(t["subtotal"]))] + [(vat_label(v), m(v["amount"])) for v in t["vat"]] + [(lab["total"], m(t["total"]))]) + "</w:tbl>"
    doc = f'<?xml version="1.0" encoding="UTF-8"?><w:document {W}><w:body>{outer}{p("")}{items}{p("")}{totals}<w:sectPr/></w:body></w:document>'
    docx_zip(path, doc)


def word_picture(photo: Path, path: Path):
    """Someone photographed the invoice and pasted the photo into Word."""
    pic = '<w:r><w:drawing><wp:inline><wp:extent cx="5400000" cy="7600000"/><wp:docPr id="1" name="Picture 1"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
    doc = f'<?xml version="1.0" encoding="UTF-8"?><w:document {W}><w:body>{para(pic)}<w:sectPr/></w:body></w:document>'
    docx_zip(path, doc, {"word/media/image1.jpeg": photo.read_bytes(), "word/_rels/document.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.jpeg"/></Relationships>'})


def html_invoice(t: dict, charset="utf-8", layout_tables=False, brs=False) -> str:
    loc, lab, names, d, m, vat_label = labels(t)
    head = f'<meta charset="{charset}">' if charset else ""
    meta = f"{lab['no']}: {escape(t['number'])}<br>{lab['date']}: {d('date')}<br>{lab['due']}: {d('due')}" if brs else f"<p>{lab['no']}: {escape(t['number'])}</p><p>{lab['date']}: {d('date')}</p><p>{lab['due']}: {d('due')}</p>"
    rows = "".join(f"<tr><td>{escape(names[k % len(names)])}</td><td>{i['qty']}</td><td>{m(i['unit'], False)}</td><td>{m(i['amount'], False)}</td></tr>" for k, i in enumerate(t["items"]))
    totals = f"<tr><td colspan=3>{lab['sub']}</td><td>{m(t['subtotal'])}</td></tr>" + "".join(f"<tr><td colspan=3>{vat_label(v)}</td><td>{m(v['amount'])}</td></tr>" for v in t["vat"]) + f"<tr><td colspan=3><b>{lab['total']}</b></td><td><b>{m(t['total'])}</b></td></tr>"
    items = f"<table><tr><th>{lab['desc']}</th><th>{lab['qty']}</th><th>{lab['unit']}</th><th>{lab['amount']}</th></tr>{rows}{totals}</table>"
    preheader = '<div style="display:none">Your invoice is ready - view it online</div>'
    if layout_tables:
        body = f'{preheader}<table width="100%"><tr><td><table><tr><td><h2>{escape(t["vendor"])}</h2></td><td align="right"><h1>{lab["title"].upper()}</h1>{meta}</td></tr></table></td></tr><tr><td>{items}</td></tr></table>'
    else:
        body = f"<h2>{escape(t['vendor'])}</h2><h1>{lab['title'].upper()}</h1>{meta}{items}"
    return f"<html><head>{head}<style>td{{padding:4px}}</style></head><body>{body}</body></html>"


def textutil(html: str, fmt: str, path: Path):
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "in.html"
        src.write_text(html, encoding="utf-8")
        subprocess.run(["textutil", "-convert", fmt, "-inputencoding", "UTF-8", str(src), "-output", str(path)], check=True, capture_output=True)


def col(n: int) -> str:
    return "ABCDEFGHIJ"[n]


def excel_real(t: dict, path: Path):
    """Numbers stored as numbers, formatted by Excel: what an invoice template in Excel saves."""
    loc, lab, names, d, m, vat_label = labels(t)
    strings: list[str] = []

    def s(v: str) -> int:
        if v not in strings:
            strings.append(v)
        return strings.index(v)

    sym = {"EUR": '[$€-407]', "TRY": '"₺"', "GBP": '[$£-809]', "USD": '[$$-409]', "PLN": '[$zł-415]'}.get(t["currency"], "")
    after = t["currency"] in ("EUR", "PLN")
    money_fmt = f'#,##0.00\\ {sym}' if after else f'{sym}#,##0.00'
    xml_rows = []
    r = 1

    def row(cells: list[str]):
        nonlocal r
        xml_rows.append(f'<row r="{r}">' + "".join(c.replace("§", f"{r}") for c in cells) + "</row>")
        r += 1

    def sc(c: int, text: str, style=0):
        return f'<c r="{col(c)}§" t="s" s="{style}"><v>{s(text)}</v></c>'

    serial = lambda iso: (date.fromisoformat(iso) - date(1899, 12, 30)).days  # noqa: E731
    row([f'<c r="A§" t="inlineStr"><is><t>{escape(t["vendor"])}</t></is></c>'])
    row([sc(0, lab["title"].upper())])
    row([sc(0, f"{lab['no']}:"), sc(1, t["number"])])
    row([sc(0, f"{lab['date']}:"), f'<c r="B§" s="2"><v>{serial(t["date"])}</v></c>'])
    row([sc(0, f"{lab['due']}:"), f'<c r="B§" s="2"><v>{serial(t["due"])}</v></c>'])
    row([])
    row([sc(k, h, 3) for k, h in enumerate([lab["desc"], lab["qty"], lab["unit"], lab["amount"]])])
    first = r
    for k, i in enumerate(t["items"]):
        # Excel saves the formula and its floating-point result: 25 * 89.99 = 2249.7499999999995.
        row([sc(0, names[k % len(names)]), f'<c r="B§"><v>{i["qty"]}</v></c>', f'<c r="C§" s="1"><v>{repr(float(i["unit"]))}</v></c>', f'<c r="D§" s="1"><f>B§*C§</f><v>{repr(i["qty"] * i["unit"])}</v></c>'])
    last = r - 1
    row([])
    row([sc(2, lab["sub"]), f'<c r="D§" s="1"><f>SUM(D{first}:D{last})</f><v>{repr(sum(i["qty"] * i["unit"] for i in t["items"]))}</v></c>'])
    for v in t["vat"]:
        row([sc(2, vat_label(v)), f'<c r="D§" s="1"><v>{repr(v["amount"] + 1e-12)}</v></c>'])
    # The label is rich text: two runs.
    row([f'<c r="C§" t="s"><v>{len(strings)}</v></c>', f'<c r="D§" s="1"><v>{repr(t["total"])}</v></c>'])
    rich = f'<si><r><rPr><b/></rPr><t>{escape(lab["total"].split()[0])}</t></r><r><t xml:space="preserve"> {escape(" ".join(lab["total"].split()[1:]))}</t></r><rPh sb="0" eb="1"><t>ignored</t></rPh></si>'
    sheet = f'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>{"".join(xml_rows)}</sheetData><mergeCells count="1"><mergeCell ref="A1:D1"/></mergeCells></worksheet>'
    junk = '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>lookup table 99999.99 Total 123</t></is></c></row></sheetData></worksheet>'
    styles = f'<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="{escape(money_fmt, quote=True)}"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts><cellXfs count="4"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/><xf numFmtId="0"/></cellXfs></styleSheet>'
    sst = '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + "".join(f"<si><t>{escape(x)}</t></si>" for x in strings) + rich + "</sst>"
    # The invoice is sheet3.xml but listed first; sheet1.xml is a hidden lookup sheet.
    book = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Invoice" sheetId="3" r:id="rId3"/><sheet name="Lookup" sheetId="1" state="hidden" r:id="rId1"/></sheets></workbook>'
    rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId3" Type="worksheet" Target="/xl/worksheets/sheet3.xml"/></Relationships>'
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        z.writestr("xl/workbook.xml", book)
        z.writestr("xl/_rels/workbook.xml.rels", rels)
        z.writestr("xl/worksheets/sheet1.xml", junk)
        z.writestr("xl/worksheets/sheet3.xml", sheet)
        z.writestr("xl/styles.xml", styles)
        z.writestr("xl/sharedStrings.xml", sst)


def ods(t: dict, path: Path):
    loc, lab, names, d, m, vat_label = labels(t)
    cellp = lambda s: '<table:table-cell office:value-type="string"><text:p>' + escape(s) + "</text:p></table:table-cell>"  # noqa: E731
    cur = lambda x: f'<table:table-cell office:value-type="currency" office:currency="{t["currency"]}" office:value="{x}"><text:p>{escape(m(x))}</text:p></table:table-cell>'  # noqa: E731
    empty = '<table:table-cell table:number-columns-repeated="16380"/>'
    rows = [[cellp(t["vendor"])], [cellp(lab["title"].upper())], [cellp(f"{lab['no']}:"), cellp(t["number"])], [cellp(f"{lab['date']}:"), cellp(d("date"))], [cellp(f"{lab['due']}:"), cellp(d("due"))], [cellp(h) for h in [lab["desc"], lab["qty"], lab["unit"], lab["amount"]]]]
    rows += [[cellp(names[k % len(names)]), f'<table:table-cell office:value-type="float" office:value="{i["qty"]}"><text:p>{i["qty"]}</text:p></table:table-cell>', cur(i["unit"]), cur(i["amount"])] for k, i in enumerate(t["items"])]
    rows += [['<table:covered-table-cell/>', cellp(lab["sub"]), cur(t["subtotal"])]] + [['<table:covered-table-cell/>', cellp(vat_label(v)), cur(v["amount"])] for v in t["vat"]] + [['<table:covered-table-cell/>', cellp(lab["total"]), cur(t["total"])]]
    body = "".join(f"<table:table-row>{''.join(r)}{empty}</table:table-row>" for r in rows) + '<table:table-row table:number-rows-repeated="1048000"><table:table-cell table:number-columns-repeated="16384"/></table:table-row>'
    content = f'<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"><office:body><office:spreadsheet><table:table table:name="Fatura">{body}</table:table></office:spreadsheet></office:body></office:document-content>'
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", "application/vnd.oasis.opendocument.spreadsheet", compress_type=zipfile.ZIP_STORED)
        z.writestr("content.xml", content)


def csv_1254(t: dict, path: Path):
    loc, lab, names, d, m, vat_label = labels(t)
    q = lambda s: f'"{s}"' if ";" in s or "\n" in s or '"' in s else s  # noqa: E731
    lines = ["sep=;", t["vendor"], lab["title"].upper(), f"{lab['no']}:;{t['number']}", f"{lab['date']}:;{d('date')}", f"{lab['due']}:;{d('due')}", ";".join([lab["desc"], lab["qty"], lab["unit"], lab["amount"]])]
    for k, i in enumerate(t["items"]):
        desc = names[k % len(names)] + ('\n(Ekim dönemi, "proje B")' if k == 0 else "")
        lines.append(";".join([q(desc.replace('"', '""')), str(i["qty"]), m(i["unit"], False), m(i["amount"], False)]))
    lines += [f"{lab['sub']};;;{m(t['subtotal'])}"] + [f"{vat_label(v)};;;{m(v['amount'])}" for v in t["vat"]] + [f"{lab['total']};;;{m(t['total'])}"]
    path.write_bytes("\r\n".join(lines).encode("cp1254"))


def utf16_tsv(t: dict, path: Path):
    loc, lab, names, d, m, vat_label = labels(t)
    lines = [t["vendor"], lab["title"].upper(), f"{lab['no']}:\t{t['number']}", f"{lab['date']}:\t{d('date')}", f"{lab['due']}:\t{d('due')}", "\t".join([lab["desc"], lab["qty"], lab["unit"], lab["amount"]])]
    lines += ["\t".join([names[k % len(names)], str(i["qty"]), m(i["unit"], False), m(i["amount"], False)]) for k, i in enumerate(t["items"])]
    lines += [f"{lab['sub']}\t\t\t{m(t['subtotal'])}"] + [f"{vat_label(v)}\t\t\t{m(v['amount'])}" for v in t["vat"]] + [f"{lab['total']}\t\t\t{m(t['total'])}"]
    path.write_bytes(b"\xff\xfe" + "\r\n".join(lines).encode("utf-16-le"))


def eml(parts: list[tuple[dict, bytes]], boundary: str, subject: str, outer="multipart/mixed") -> bytes:
    out = [f"From: Billing <billing@vendor.example>\r\nTo: ap@client.example\r\nSubject: {subject}\r\nDate: Mon, 2 Nov 2026 09:14:00 +0300\r\nMessage-ID: <x{boundary}@vendor.example>\r\nMIME-Version: 1.0\r\nContent-Type: {outer}; boundary=\"{boundary}\"\r\n\r\nThis is a multi-part message in MIME format.\r\n".encode()]
    for headers, body in parts:
        out.append(f"--{boundary}\r\n".encode() + "".join(f"{k}: {v}\r\n" for k, v in headers.items()).encode() + b"\r\n" + body + b"\r\n")
    out.append(f"--{boundary}--\r\n".encode())
    return b"".join(out)


def b64(data: bytes) -> bytes:
    s = base64.b64encode(data).decode()
    return "\r\n".join(s[i : i + 76] for i in range(0, len(s), 76)).encode()


def qp(text: str, charset: str) -> bytes:
    raw = text.encode(charset)
    out, line = [], ""
    for byte in raw:
        ch = chr(byte)
        enc = ch if 32 < byte < 127 and ch != "=" else ("=" + f"{byte:02X}" if byte not in (10, 13) else ch)
        if ch == "\n":
            out.append(line)
            line = ""
            continue
        if len(line) + len(enc) > 72:
            out.append(line + "=")
            line = ""
        line += enc
    out.append(line)
    return "\r\n".join(out).encode()


def eml_pdf(t: dict, pdf: Path, path: Path):
    alt = eml([({"Content-Type": "text/plain; charset=utf-8"}, b"Hello,\r\n\r\nplease find attached our invoice.\r\n\r\nKind regards"), ({"Content-Type": "text/html; charset=utf-8"}, b"<p>Hello,</p><p>please find attached our invoice.</p><p>Kind regards</p>")], "alt-2", "x", "multipart/alternative")
    alt_body = alt.split(b"\r\n\r\n", 1)[1]
    logo = (ROOT / "public" / "favicon.ico").read_bytes() if (ROOT / "public" / "favicon.ico").exists() else b"\x89PNG\r\n\x1a\n" + b"0" * 200
    path.write_bytes(
        eml(
            [
                ({"Content-Type": 'multipart/alternative; boundary="alt-2"'}, alt_body),
                ({"Content-Type": "image/png; name=logo.png", "Content-Disposition": "inline; filename=logo.png", "Content-Transfer-Encoding": "base64"}, b64(logo)),
                ({"Content-Type": f'application/pdf; name="{t["number"]}.pdf"', "Content-Disposition": f'attachment; filename="{t["number"]}.pdf"', "Content-Transfer-Encoding": "base64"}, b64(pdf.read_bytes())),
            ],
            "mix-1",
            f"Invoice {t['number']}",
        )
    )


def eml_qp(t: dict, path: Path):
    html = html_invoice(t, charset="", layout_tables=True, brs=True)
    path.write_bytes(eml([({"Content-Type": "text/plain; charset=iso-8859-9", "Content-Transfer-Encoding": "quoted-printable"}, qp("Faturanız ektedir.", "iso-8859-9")), ({"Content-Type": "text/html; charset=iso-8859-9", "Content-Transfer-Encoding": "quoted-printable"}, qp(html, "iso-8859-9"))], "b1", "Fatura", "multipart/alternative"))


def eml_docx(docx: Path, path: Path):
    path.write_bytes(eml([({"Content-Type": "text/plain; charset=utf-8"}, b"Rechnung anbei."), ({"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": 'attachment; filename*=utf-8\'\'Rechnung%20M%C3%A4rz.docx', "Content-Transfer-Encoding": "base64"}, b64(docx.read_bytes()))], "b2", "Rechnung"))


def ubl(t: dict, path: Path, turkish: bool):
    loc, lab, names, d, m, vat_label = labels(t)
    cur = t["currency"]
    a = lambda x: f'currencyID="{cur}">{x:.2f}'  # noqa: E731
    lines = "".join(
        f'<cac:InvoiceLine><cbc:ID>{k + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="C62">{i["qty"]}</cbc:InvoicedQuantity><cbc:LineExtensionAmount {a(i["amount"])}</cbc:LineExtensionAmount><cac:Item><cbc:Name>{escape(names[k % len(names)])}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount {a(i["unit"])}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>'
        for k, i in enumerate(t["items"])
    )
    taxes = "".join(f'<cac:TaxSubtotal><cbc:TaxableAmount {a(v.get("base") or t["subtotal"])}</cbc:TaxableAmount><cbc:TaxAmount {a(v["amount"])}</cbc:TaxAmount><cbc:Percent>{v["rate"]}</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>{"KDV" if turkish else "VAT"}</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>' for v in t["vat"])
    seller_id = '<cac:PartyIdentification><cbc:ID schemeID="VKN">4640300551</cbc:ID></cac:PartyIdentification>' if turkish else ""
    tax_scheme = "" if turkish else '<cac:PartyTaxScheme><cbc:CompanyID>DE811569869</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>'
    ext = '<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignatureValue>MIIG2zCCBcOgAwIBAgIIX3Z1c2Vy 1.234,56 Total 999</ds:SignatureValue></ds:Signature></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>' if turkish else ""
    profile = "<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>TR1.2</cbc:CustomizationID><cbc:ProfileID>TEMELFATURA</cbc:ProfileID>" if turkish else "<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>"
    due = "" if turkish else f"<cbc:DueDate>{t['due']}</cbc:DueDate>"
    pay_due = f"<cac:PaymentMeans><cbc:PaymentMeansCode>42</cbc:PaymentMeansCode><cbc:PaymentDueDate>{t['due']}</cbc:PaymentDueDate></cac:PaymentMeans>" if turkish else ""
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
{ext}{profile}<cbc:ID>{t["number"]}</cbc:ID><cbc:UUID>f47ac10b-58cc-4372-a567-0e02b2c3d479</cbc:UUID><cbc:IssueDate>{t["date"]}</cbc:IssueDate>{due}<cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode><cbc:Note>Yalnız #{t["total"]}# {cur}</cbc:Note><cbc:DocumentCurrencyCode>{cur}</cbc:DocumentCurrencyCode><cbc:LineCountNumeric>{len(t["items"])}</cbc:LineCountNumeric>
<cac:AccountingSupplierParty><cac:Party>{seller_id}<cac:PartyName><cbc:Name>{escape(t["vendor"])}</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:StreetName>Atatürk Cad.</cbc:StreetName><cbc:BuildingNumber>12</cbc:BuildingNumber><cbc:CityName>İzmir</cbc:CityName><cbc:PostalZone>35210</cbc:PostalZone></cac:PostalAddress>{tax_scheme}</cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyName><cbc:Name>Kestrel Gıda A.Ş.</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>{pay_due}
<cac:TaxTotal><cbc:TaxAmount {a(sum(v["amount"] for v in t["vat"]))}</cbc:TaxAmount>{taxes}</cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount {a(t["subtotal"])}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount {a(t["subtotal"])}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount {a(t["total"])}</cbc:TaxInclusiveAmount><cbc:PayableAmount {a(t["total"])}</cbc:PayableAmount></cac:LegalMonetaryTotal>
{lines}</Invoice>'''
    path.write_text(xml, encoding="utf-8")


def cii(t: dict, path: Path):
    loc, lab, names, d, m, vat_label = labels(t)
    dt = lambda iso: iso.replace("-", "")  # noqa: E731
    items = "".join(
        f'<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>{k + 1}</ram:LineID></ram:AssociatedDocumentLineDocument><ram:SpecifiedTradeProduct><ram:Name>{escape(names[k % len(names)])}</ram:Name></ram:SpecifiedTradeProduct><ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>{i["unit"]:.2f}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement><ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="C62">{i["qty"]}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery><ram:SpecifiedLineTradeSettlement><ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>{i["amount"]:.2f}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>'
        for k, i in enumerate(t["items"])
    )
    taxes = "".join(f"<ram:ApplicableTradeTax><ram:CalculatedAmount>{v['amount']:.2f}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>{(v.get('base') or t['subtotal']):.2f}</ram:BasisAmount><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>{v['rate']}</ram:RateApplicablePercent></ram:ApplicableTradeTax>" for v in t["vat"])
    xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
<rsm:ExchangedDocument><ram:ID>{t["number"]}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">{dt(t["date"])}</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
<rsm:SupplyChainTradeTransaction>{items}
<ram:ApplicableHeaderTradeAgreement><ram:SellerTradeParty><ram:Name>{escape(t["vendor"])}</ram:Name><ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">FR40303265045</ram:ID></ram:SpecifiedTaxRegistration></ram:SellerTradeParty><ram:BuyerTradeParty><ram:Name>Kestrel Foods SARL</ram:Name></ram:BuyerTradeParty></ram:ApplicableHeaderTradeAgreement>
<ram:ApplicableHeaderTradeDelivery/>
<ram:ApplicableHeaderTradeSettlement><ram:InvoiceCurrencyCode>{t["currency"]}</ram:InvoiceCurrencyCode>{taxes}<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">{dt(t["due"])}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms><ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>{t["subtotal"]:.2f}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>{t["subtotal"]:.2f}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="{t["currency"]}">{sum(v["amount"] for v in t["vat"]):.2f}</ram:TaxTotalAmount><ram:GrandTotalAmount>{t["total"]:.2f}</ram:GrandTotalAmount><ram:DuePayableAmount>{t["total"]:.2f}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation></ram:ApplicableHeaderTradeSettlement>
</rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>'''
    path.write_text(xml, encoding="utf-8")


def rtf_1254(t: dict, path: Path):
    loc, lab, names, d, m, vat_label = labels(t)

    def enc(s: str) -> str:
        out = ""
        for ch in s:
            b = ch.encode("cp1254", errors="replace")
            out += ch if b[0] < 128 and ch not in "\\{}" else ("\\" + ch if ch in "\\{}" else f"\\'{b[0]:02x}")
        return out

    row = lambda cells: "\\trowd" + "".join(f"\\cellx{(k + 1) * 2200}" for k in range(len(cells))) + "".join(f"\\intbl {enc(c)}\\cell" for c in cells) + "\\row\n"  # noqa: E731
    body = [f"{{\\b {enc(t['vendor'])}}}\\par", f"{enc(lab['title'].upper())}\\par", f"{enc(lab['no'])}:\\tab {enc(t['number'])}\\par", f"{enc(lab['date'])}:\\tab {enc(d('date'))}\\par", f"{enc(lab['due'])}:\\tab {enc(d('due'))}\\par\\par"]
    body.append(row([lab["desc"], lab["qty"], lab["unit"], lab["amount"]]))
    for k, i in enumerate(t["items"]):
        body.append(row([names[k % len(names)], str(i["qty"]), m(i["unit"], False), m(i["amount"], False)]))
    body.append("\\pard\\par")
    body += [f"{enc(lab['sub'])}\\tab {enc(m(t['subtotal']))}\\par"] + [f"{enc(vat_label(v))}\\tab {enc(m(v['amount']))}\\par" for v in t["vat"]] + [f"{{\\b {enc(lab['total'])}}}\\tab {enc(m(t['total']))}\\par"]
    rtf = "{\\rtf1\\ansi\\ansicpg1254\\deff0{\\fonttbl{\\f0\\fswiss Arial;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\generator Logo Muhasebe 3.1;}{\\info{\\title Fatura 99,00 TL}}\\f0\\fs20\n" + "\n".join(body) + "}"
    path.write_bytes(rtf.encode("ascii"))


def main():
    manifest = json.loads((CORPUS / "truth.json").read_text())
    manifest = [e for e in manifest if not e["name"].startswith("hard-")]
    extra = []

    def add(case: str, base: str, file: Path):
        t = truth(base)
        extra.append(dict(name=f"hard-{case}", file=file.name, width=1240, height=1754, truth=dict(t, layout=f"hard-{case}", pdf_only=False, office=file.name)))

    jobs = [
        ("word-tabs", "inv-en-GB-classic", "docx", word_tabs),
        ("word-layout", "inv-it-classic", "docx", word_layout),
        ("excel-real-de", "inv-de-multi-vat", "xlsx", excel_real),
        ("excel-real-tr", "inv-tr-discount", "xlsx", excel_real),
        ("excel-real-us", "inv-en-US-classic", "xlsx", excel_real),
        ("ods-repeated", "inv-tr-classic", "ods", ods),
        ("csv-excel-tr", "inv-tr-modern", "csv", csv_1254),
        ("unicode-text", "inv-de-classic", "txt", utf16_tsv),
        ("efatura", "inv-tr-multi-vat", "xml", lambda t, p: ubl(t, p, True)),
        ("xrechnung", "inv-de-discount", "xml", lambda t, p: ubl(t, p, False)),
        ("facturx", "inv-fr-multi-vat", "xml", cii),
        ("rtf-1254", "inv-tr-leaders", "rtf", rtf_1254),
        ("eml-quoted-tr", "inv-tr-classic", "eml", eml_qp),
    ]
    for case, base, ext, fn in jobs:
        f = OUT / f"hard-{case}.{ext}"
        fn(truth(base), f)
        add(case, base, f)

    # Written by a real word processor.
    for fmt, base in [("docx", "inv-es-classic"), ("odt", "inv-pl-classic"), ("rtf", "inv-fr-classic")]:
        f = OUT / f"hard-textutil.{fmt}"
        textutil(html_invoice(truth(base)), fmt, f)
        add(f"textutil-{fmt}", base, f)

    # An ERP "Excel export" that is a web page in Windows-1254.
    f = OUT / "hard-erp-export.xls"
    f.write_bytes(html_invoice(truth("inv-tr-multi-vat"), charset="windows-1254").encode("cp1254"))
    add("erp-export", "inv-tr-multi-vat", f)

    # The invoice as a PDF attached to an e-mail; a Word file attached to another.
    f = OUT / "hard-eml-pdf.eml"
    eml_pdf(truth("inv-en-US-discount"), CORPUS / "pdf" / "inv-en-US-discount.pdf", f)
    add("eml-pdf", "inv-en-US-discount", f)
    f = OUT / "hard-eml-docx.eml"
    eml_docx(OUT / "hard-word-tabs.docx", f)
    add("eml-docx", "inv-en-GB-classic", f)

    # The Turkish e-Arşiv portal downloads an invoice as a ZIP of its XML and an HTML view.
    f = OUT / "hard-earsiv.zip"
    with tempfile.TemporaryDirectory() as tmp:
        x = Path(tmp) / "x.xml"
        ubl(truth("inv-tr-discount"), x, True)
        with zipfile.ZipFile(f, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("f47ac10b-58cc-4372-a567-0e02b2c3d479/", "")
            z.writestr("f47ac10b-58cc-4372-a567-0e02b2c3d479/f47ac10b-58cc-4372-a567-0e02b2c3d479.html", html_invoice(truth("inv-tr-discount")))
            z.writestr("f47ac10b-58cc-4372-a567-0e02b2c3d479/f47ac10b-58cc-4372-a567-0e02b2c3d479.xml", x.read_bytes())
            z.writestr("__MACOSX/._x.xml", b"\0\5\x16\7")
    add("earsiv-zip", "inv-tr-discount", f)

    # Wrong or missing names.
    f = OUT / "hard-pdf-named.docx"
    shutil.copy(CORPUS / "pdf" / "inv-nl-classic.pdf", f)
    add("pdf-named-docx", "inv-nl-classic", f)
    f = OUT / "IMG-20261101-WA0003"
    shutil.copy(CORPUS / "photo" / "inv-de-classic.jpg", f)
    add("photo-no-extension", "inv-de-classic", f)
    f = OUT / "hard-word-picture.docx"
    word_picture(CORPUS / "photo" / "inv-fr-modern.jpg", f)
    add("word-picture", "inv-fr-modern", f)

    # Broken files: each must get a clear message, never a crash or a blank page.
    good = (OUT / "hard-word-tabs.docx").read_bytes()
    (BROKEN / "half-downloaded.docx").write_bytes(good[: len(good) // 2])
    with zipfile.ZipFile(OUT / "hard-word-tabs.docx") as src, zipfile.ZipFile(BROKEN / "no-body.docx", "w") as dst:
        for item in src.infolist():
            if item.filename != "word/document.xml":
                dst.writestr(item, src.read(item.filename))
    with zipfile.ZipFile(OUT / "hard-word-tabs.docx") as src, zipfile.ZipFile(BROKEN / "cut-xml.docx", "w") as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            dst.writestr(item, data[: len(data) // 3] if item.filename == "word/document.xml" else data)
    ole = bytes.fromhex("d0cf11e0a1b11ae1") + b"\0" * 504 + "EncryptedPackage".encode("utf-16-le") + b"\0" * 2000
    (BROKEN / "password.docx").write_bytes(ole)
    (BROKEN / "old-word.doc").write_bytes(bytes.fromhex("d0cf11e0a1b11ae1") + b"\0" * 504 + "WordDocument".encode("utf-16-le") + b"\0" * 2000)
    (BROKEN / "outlook.msg").write_bytes(bytes.fromhex("d0cf11e0a1b11ae1") + b"\0" * 504 + "__substg1.0_0037001F".encode("utf-16-le") + b"\0" * 2000)
    with zipfile.ZipFile(BROKEN / "invoices.zip", "w") as z:
        z.writestr("a.pdf", (CORPUS / "pdf" / "inv-nl-classic.pdf").read_bytes())
    with zipfile.ZipFile(BROKEN / "empty-workbook.xlsx", "w") as z:
        z.writestr("xl/workbook.xml", '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>')
    (BROKEN / "not-an-invoice.xml").write_text('<?xml version="1.0"?><config><server port="8080"/></config>')
    (BROKEN / "random.bin").write_bytes(bytes(range(256)) * 8)
    (BROKEN / "broken-photo.jpg").write_bytes((CORPUS / "photo" / "inv-de-classic.jpg").read_bytes()[:3000])
    bad = eml([({"Content-Type": "text/html; charset=utf-8"}, html_invoice(truth("inv-en-GB-classic")).encode()), ({"Content-Type": "application/pdf; name=x.pdf", "Content-Disposition": "attachment; filename=x.pdf", "Content-Transfer-Encoding": "base64"}, b"JVBERi0xLjQKJ!!!not base64!!!")], "b9", "Invoice")
    (BROKEN / "bad-attachment.eml").write_bytes(bad)
    textutil(html_invoice(truth("inv-en-GB-classic")), "doc", BROKEN / "textutil-old.doc")

    (CORPUS / "truth.json").write_text(json.dumps(manifest + extra, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(extra)} hard documents, {len(list(BROKEN.iterdir()))} broken files")


if __name__ == "__main__":
    main()
