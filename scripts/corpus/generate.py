"""Generates the evaluation corpus: invoices, receipts, bank statements and
documents Tally must reject, in nine languages and several layouts, each with
its ground truth. Run: python3 scripts/corpus/generate.py, then
scripts/corpus/render.sh to turn the HTML into PDFs, images and photos.

Every company, person, address and number is invented.
"""

import json
import random
from datetime import date, timedelta
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "corpus"
HTML = ROOT / "html"
rnd = random.Random(20261101)

MONTHS = {
    "en": "January February March April May June July August September October November December".split(),
    "tr": "Ocak Şubat Mart Nisan Mayıs Haziran Temmuz Ağustos Eylül Ekim Kasım Aralık".split(),
    "de": "Januar Februar März April Mai Juni Juli August September Oktober November Dezember".split(),
    "fr": "janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split(),
    "es": "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(),
    "it": "gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre".split(),
    "nl": "januari februari maart april mei juni juli augustus september oktober november december".split(),
    "pt": "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split(),
    "pl": "stycznia lutego marca kwietnia maja czerwca lipca sierpnia września października listopada grudnia".split(),
}

# Labels a real invoice in each language uses.
L = {
    "en": dict(title="Invoice", no="Invoice No", date="Invoice Date", due="Due Date", desc="Description", qty="Qty", unit="Unit Price", amount="Amount",
               sub="Subtotal", vat="VAT", total="Total Due", bill="Bill to", disc="Discount", ship="Shipping", rate="Rate", net="Net", tax_id="VAT No",
               receipt="Receipt", thanks="Thank you for your purchase", card="Card", incl="VAT included"),
    "tr": dict(title="Fatura", no="Fatura No", date="Fatura Tarihi", due="Son Ödeme Tarihi", desc="Açıklama", qty="Miktar", unit="Birim Fiyat", amount="Tutar",
               sub="Ara Toplam", vat="KDV", total="Genel Toplam", bill="Sayın", disc="İndirim", ship="Kargo", rate="Oran", net="Matrah", tax_id="Vergi No",
               receipt="Fiş", thanks="Bizi tercih ettiğiniz için teşekkürler", card="Kredi Kartı", incl="KDV dahil"),
    "de": dict(title="Rechnung", no="Rechnungsnummer", date="Rechnungsdatum", due="Fällig am", desc="Beschreibung", qty="Menge", unit="Einzelpreis", amount="Betrag",
               sub="Zwischensumme", vat="MwSt", total="Gesamtbetrag", bill="Rechnungsempfänger", disc="Rabatt", ship="Versand", rate="Satz", net="Netto", tax_id="USt-IdNr",
               receipt="Kassenbon", thanks="Vielen Dank für Ihren Einkauf", card="Karte", incl="inkl. MwSt"),
    "fr": dict(title="Facture", no="N° de facture", date="Date de facture", due="Date d'échéance", desc="Désignation", qty="Qté", unit="Prix unitaire", amount="Montant",
               sub="Total HT", vat="TVA", total="Total TTC", bill="Facturé à", disc="Remise", ship="Frais de port", rate="Taux", net="Base HT", tax_id="N° TVA",
               receipt="Ticket", thanks="Merci de votre visite", card="Carte bancaire", incl="TVA incluse"),
    "es": dict(title="Factura", no="Nº de factura", date="Fecha de factura", due="Fecha de vencimiento", desc="Descripción", qty="Cant.", unit="Precio unitario", amount="Importe",
               sub="Base imponible", vat="IVA", total="Total factura", bill="Cliente", disc="Descuento", ship="Gastos de envío", rate="Tipo", net="Base", tax_id="NIF",
               receipt="Ticket", thanks="Gracias por su compra", card="Tarjeta", incl="IVA incluido"),
    "it": dict(title="Fattura", no="Fattura n.", date="Data fattura", due="Scadenza", desc="Descrizione", qty="Q.tà", unit="Prezzo unitario", amount="Importo",
               sub="Imponibile", vat="IVA", total="Totale fattura", bill="Destinatario", disc="Sconto", ship="Spese di spedizione", rate="Aliquota", net="Imponibile", tax_id="P. IVA",
               receipt="Scontrino", thanks="Grazie e arrivederci", card="Carta", incl="IVA inclusa"),
    "nl": dict(title="Factuur", no="Factuurnummer", date="Factuurdatum", due="Vervaldatum", desc="Omschrijving", qty="Aantal", unit="Prijs per stuk", amount="Bedrag",
               sub="Subtotaal", vat="BTW", total="Totaal te betalen", bill="Factuur aan", disc="Korting", ship="Verzendkosten", rate="Tarief", net="Grondslag", tax_id="BTW-nr",
               receipt="Kassabon", thanks="Bedankt voor uw aankoop", card="Pin", incl="incl. BTW"),
    "pt": dict(title="Fatura", no="Fatura n.º", date="Data da fatura", due="Data de vencimento", desc="Descrição", qty="Qtd.", unit="Preço unitário", amount="Valor",
               sub="Total sem IVA", vat="IVA", total="Total a pagar", bill="Cliente", disc="Desconto", ship="Portes", rate="Taxa", net="Incidência", tax_id="NIF",
               receipt="Talão", thanks="Obrigado pela preferência", card="Cartão", incl="IVA incluído"),
    "pl": dict(title="Faktura VAT", no="Numer faktury", date="Data wystawienia", due="Termin płatności", desc="Nazwa towaru lub usługi", qty="Ilość", unit="Cena netto", amount="Wartość netto",
               sub="Razem netto", vat="VAT", total="Do zapłaty", bill="Nabywca", disc="Rabat", ship="Transport", rate="Stawka", net="Netto", tax_id="NIP",
               receipt="Paragon", thanks="Dziękujemy za zakupy", card="Karta", incl="w tym VAT"),
}

# Number style, currency and VAT rates per locale.
LOCALE = {
    "en-US": dict(lang="en", dec=".", thou=",", cur="USD", sym="$", pre=True, rates=[0], sales_tax=[8.875, 7.25, 6.0], date="mdy"),
    "en-GB": dict(lang="en", dec=".", thou=",", cur="GBP", sym="£", pre=True, rates=[20, 5], date="dmy"),
    "tr": dict(lang="tr", dec=",", thou=".", cur="TRY", sym="TL", pre=False, rates=[20, 10, 1], date="dmy."),
    "de": dict(lang="de", dec=",", thou=".", cur="EUR", sym="€", pre=False, rates=[19, 7], date="dmy."),
    "de-CH": dict(lang="de", dec=".", thou="'", cur="CHF", sym="CHF", pre=True, rates=[8.1, 2.6], date="dmy."),
    "fr": dict(lang="fr", dec=",", thou=" ", cur="EUR", sym="€", pre=False, rates=[20, 10, 5.5], date="dmy"),
    "es": dict(lang="es", dec=",", thou=".", cur="EUR", sym="€", pre=False, rates=[21, 10], date="dmy"),
    "it": dict(lang="it", dec=",", thou=".", cur="EUR", sym="€", pre=True, rates=[22, 10], date="dmy"),
    "nl": dict(lang="nl", dec=",", thou=".", cur="EUR", sym="€", pre=True, rates=[21, 9], date="dmy-"),
    "pt": dict(lang="pt", dec=",", thou=".", cur="EUR", sym="€", pre=False, rates=[23, 13, 6], date="dmy"),
    "pl": dict(lang="pl", dec=",", thou=" ", cur="PLN", sym="zł", pre=False, rates=[23, 8], date="dmy."),
    "en-IN": dict(lang="en", dec=".", thou=",", cur="INR", sym="₹", pre=True, rates=[18, 12], date="dmy", lakh=True),
    "en-JP": dict(lang="en", dec="", thou=",", cur="JPY", sym="¥", pre=True, rates=[10, 8], date="ymd"),
}

VENDORS = {
    "en": ["Harbor & Finch Supply Co.", "Northgate Analytics LLC", "Bluewater Print Ltd", "Copperline Studio Inc.", "Ashford Office Partners Ltd"],
    "tr": ["Ege Kırtasiye Ltd. Şti.", "Marmara Yazılım A.Ş.", "Anadolu Mutfak Gereçleri Ltd. Şti.", "Kuzeyrüzgarı Danışmanlık A.Ş."],
    "de": ["Weber & Söhne GmbH", "Alpenblick Druck GmbH", "Fischer Haustechnik KG", "Schneider Logistik AG"],
    "fr": ["Atelier Moreau SARL", "Boulangerie Lefèvre SAS", "Dupont Conseil SA", "Imprimerie Garnier SARL"],
    "es": ["Distribuciones Ortega S.L.", "Talleres Navarro S.A.", "Café Alameda S.L.", "Gráficas Romero S.L."],
    "it": ["Rossi Forniture S.r.l.", "Tipografia Bianchi S.r.l.", "Caffè Ferrari S.n.c.", "Moretti Impianti S.p.A."],
    "nl": ["Van Dijk Kantoorartikelen B.V.", "De Vries Installatie B.V.", "Bakkerij Jansen V.O.F."],
    "pt": ["Papelaria Costa Lda.", "Silva & Ferreira Lda.", "Gráfica Almeida S.A."],
    "pl": ["Kowalski Hurtownia Sp. z o.o.", "Nowak Serwis Sp. z o.o.", "Drukarnia Wiśniewski S.A."],
}

ITEMS = {
    "en": ["Consulting hours", "A4 copy paper (box)", "Toner cartridge", "Website maintenance", "Delivery van rental", "USB-C docking station", "Annual software licence", "Ergonomic office chair", "Printed brochures (500)", "Design revisions"],
    "tr": ["Danışmanlık saati", "A4 fotokopi kağıdı (koli)", "Toner kartuşu", "Web sitesi bakımı", "Araç kiralama", "USB-C yerleştirme istasyonu", "Yıllık yazılım lisansı", "Ergonomik ofis koltuğu", "Broşür baskısı (500 adet)", "Tasarım revizyonu"],
    "de": ["Beratungsstunden", "Kopierpapier A4 (Karton)", "Tonerkartusche", "Wartung der Website", "Transportermiete", "USB-C Dockingstation", "Jahreslizenz Software", "Ergonomischer Bürostuhl", "Broschürendruck (500 Stk.)", "Designänderungen"],
    "fr": ["Heures de conseil", "Papier A4 (carton)", "Cartouche de toner", "Maintenance du site web", "Location de camionnette", "Station d'accueil USB-C", "Licence logicielle annuelle", "Fauteuil de bureau ergonomique", "Impression de brochures (500)", "Retouches graphiques"],
    "es": ["Horas de consultoría", "Papel A4 (caja)", "Cartucho de tóner", "Mantenimiento web", "Alquiler de furgoneta", "Base de conexión USB-C", "Licencia anual de software", "Silla de oficina ergonómica", "Impresión de folletos (500)", "Revisiones de diseño"],
    "it": ["Ore di consulenza", "Carta A4 (scatola)", "Cartuccia toner", "Manutenzione sito web", "Noleggio furgone", "Docking station USB-C", "Licenza software annuale", "Sedia ergonomica", "Stampa brochure (500)", "Revisioni grafiche"],
    "nl": ["Adviesuren", "A4-kopieerpapier (doos)", "Tonercartridge", "Onderhoud website", "Huur bestelbus", "USB-C dockingstation", "Jaarlicentie software", "Ergonomische bureaustoel", "Drukwerk folders (500)", "Ontwerpaanpassingen"],
    "pt": ["Horas de consultoria", "Papel A4 (caixa)", "Tinteiro de toner", "Manutenção do site", "Aluguer de carrinha", "Estação USB-C", "Licença anual de software", "Cadeira ergonómica", "Impressão de folhetos (500)", "Revisões de design"],
    "pl": ["Usługi doradcze (godz.)", "Papier ksero A4 (karton)", "Toner do drukarki", "Obsługa strony www", "Wynajem busa", "Stacja dokująca USB-C", "Roczna licencja oprogramowania", "Krzesło biurowe", "Druk ulotek (500 szt.)", "Poprawki graficzne"],
}

CREDIT = {"en": "Credit Note", "tr": "İade Faturası", "de": "Gutschrift", "fr": "Avoir", "es": "Factura rectificativa", "it": "Nota di credito", "nl": "Creditnota", "pt": "Nota de crédito", "pl": "Faktura korygująca"}

CLIENTS = ["Meridian Health Group", "Ostrava Systems", "Kestrel Foods", "Lumen Architects", "Pinecrest Hotels", "Solace Dental"]


def money(x: float, loc: dict, symbol=True) -> str:
    if not loc["dec"]:
        s = f"{round(x):,}".replace(",", loc["thou"])
    elif loc.get("lakh"):
        whole, frac = f"{abs(x):.2f}".split(".")
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        s = ",".join(groups + [tail]) if groups else tail
        s = ("-" if x < 0 else "") + s + "." + frac
    else:
        s = f"{x:,.2f}".replace(",", "§").replace(".", loc["dec"]).replace("§", loc["thou"])
    if not symbol:
        return s
    return f"{loc['sym']}{'' if loc['sym'] in '$£€¥₹' else ' '}{s}" if loc["pre"] else f"{s} {loc['sym']}"


def fmt_date(d: date, loc: dict, long=False) -> str:
    lang = loc["lang"]
    if long:
        m = MONTHS[lang][d.month - 1]
        if lang == "en":
            return f"{m[:3]} {d.day}, {d.year}" if loc["date"] == "mdy" else f"{d.day} {m} {d.year}"
        if lang in ("es", "pt"):
            return f"{d.day} de {m} de {d.year}"
        if lang == "de":
            return f"{d.day}. {m} {d.year}"
        return f"{d.day} {m} {d.year}"
    style = loc["date"]
    if style == "mdy":
        return f"{d.month:02d}/{d.day:02d}/{d.year}"
    if style == "ymd":
        return f"{d.year}/{d.month:02d}/{d.day:02d}"
    sep = "." if style.endswith(".") else "-" if style.endswith("-") else "/"
    return f"{d.day:02d}{sep}{d.month:02d}{sep}{d.year}"


def r2(x: float) -> float:
    return round(x + 1e-9, 2)


def make_invoice(locale: str, layout: str, idx: int) -> dict:
    loc = LOCALE[locale]
    lang = loc["lang"]
    lab = L[lang]
    jpy = not loc["dec"]
    vendor = rnd.choice(VENDORS[lang])
    issued = date(2026, rnd.randint(1, 10), rnd.randint(1, 28))
    due = issued + timedelta(days=rnd.choice([14, 30, 45]))
    number = rnd.choice(["INV-{y}-{n:04d}", "{y}/{n:05d}", "F{y}{n:06d}", "RE-{n:05d}", "FV/{n}/{m:02d}/{y}"]).format(y=issued.year, n=rnd.randint(1, 99999), m=issued.month)
    sales_tax = locale == "en-US"
    rates = loc["rates"]
    n_items = 22 if layout == "multipage" else rnd.randint(2, 7)
    items = []
    names = rnd.sample(ITEMS[lang], len(ITEMS[lang]))
    names = [names[k % len(names)] + (f" ({k // len(names) + 1})" if k >= len(names) else "") for k in range(n_items)]
    for name in names:
        qty = rnd.choice([1, 1, 2, 3, 5, 10, 12, 25])
        unit = rnd.choice([4.5, 12.9, 18.0, 45.0, 89.99, 120.0, 249.0, 1250.0]) * (100 if jpy else 1)
        unit = round(unit) if jpy else unit
        if layout == "credit":
            unit = -unit
        amount = round(qty * unit) if jpy else r2(qty * unit)
        rate = 0 if sales_tax else (rates[0] if len(rates) == 1 or layout != "multi-vat" else rnd.choice(rates[:2]))
        items.append(dict(desc=name, qty=qty, unit=unit, amount=amount, rate=rate))
    if layout == "discount":
        d = -r2(sum(i["amount"] for i in items) * 0.05)
        d = round(d) if jpy else d
        items.append(dict(desc=lab["disc"] + " 5%", qty=1, unit=d, amount=d, rate=items[0]["rate"]))
        s = 15.0 * (100 if jpy else 1)
        items.append(dict(desc=lab["ship"], qty=1, unit=s, amount=s, rate=items[0]["rate"]))
    subtotal = r2(sum(i["amount"] for i in items))
    vat_lines = []
    if sales_tax:
        rate = rnd.choice(loc["sales_tax"])
        vat_lines.append(dict(rate=rate, base=subtotal, amount=r2(subtotal * rate / 100)))
    else:
        for rate in sorted({i["rate"] for i in items}, reverse=True):
            base = r2(sum(i["amount"] for i in items if i["rate"] == rate))
            amt = round(base * rate / 100) if jpy else r2(base * rate / 100)
            vat_lines.append(dict(rate=rate, base=base, amount=amt))
    total = r2(subtotal + sum(v["amount"] for v in vat_lines))
    truth = dict(
        kind="invoice", locale=locale, lang=lang, layout=layout, vendor=vendor, number=number, date=issued.isoformat(), due=due.isoformat(),
        currency=loc["cur"], subtotal=subtotal, vat=[dict(rate=v["rate"], amount=v["amount"]) for v in vat_lines], total=total,
        items=[dict(qty=i["qty"], unit=i["unit"], amount=i["amount"]) for i in items],
    )
    long_dates = idx % 2 == 1
    ds, dd = fmt_date(issued, loc, long_dates), fmt_date(due, loc, long_dates)
    client = rnd.choice(CLIENTS)
    m = lambda x: money(x, loc)  # noqa: E731
    mn = lambda x: money(x, loc, symbol=False)  # noqa: E731
    vat_label = (lambda v: f"Sales Tax ({v['rate']}%)") if sales_tax else (lambda v: f"{lab['vat']} {v['rate']:g}%" if lang != "tr" else f"{lab['vat']} %{v['rate']:g}")
    rows = "".join(
        f"<tr><td>{escape(i['desc'])}</td><td class=n>{i['qty']}</td><td class=n>{mn(i['unit'])}</td>"
        + (f"<td class=n>{i['rate']:g}%</td>" if layout == "multi-vat" else "")
        + f"<td class=n>{mn(i['amount'])}</td></tr>"
        for i in items
    )
    vat_rows = "".join(f"<div><span>{escape(vat_label(v))}</span><span>{m(v['amount'])}</span></div>" for v in vat_lines)
    meta = f"""<table class=meta><tr><td>{lab['no']}:</td><td>{escape(number)}</td></tr><tr><td>{lab['date']}:</td><td>{ds}</td></tr><tr><td>{lab['due']}:</td><td>{dd}</td></tr><tr><td>{lab['tax_id']}:</td><td>{rnd.randint(10**8, 10**9 - 1)}</td></tr></table>"""
    head = f"<tr><th>{lab['desc']}</th><th class=n>{lab['qty']}</th><th class=n>{lab['unit']}</th>" + (f"<th class=n>{lab['rate']}</th>" if layout == "multi-vat" else "") + f"<th class=n>{lab['amount']}</th></tr>"
    totals = f"""<div class=sum><div><span>{lab['sub']}</span><span>{m(subtotal)}</span></div>{vat_rows}<div class=grand><span>{lab['total']}</span><span>{m(total)}</span></div></div>"""
    style = {"classic": "classic", "modern": "modern", "multi-vat": "modern", "discount": "classic", "credit": "classic", "dense": "dense", "leaders": "classic", "multipage": "classic"}[layout]
    title = CREDIT[lang] if layout == "credit" else lab["title"]
    if layout == "dense":
        # Small type, everything on few lines, no table rules: the kind a small shop prints.
        rows = "".join(f"<tr><td>{escape(i['desc'])}</td><td class=n>{i['qty']}</td><td class=n>{mn(i['unit'])}</td><td class=n>{mn(i['amount'])}</td></tr>" for i in items)
        body = f"""<div class=dense><div class=dhead><div><b>{escape(vendor)}</b><br>{lab['tax_id']} {rnd.randint(10**8, 10**9 - 1)}</div><div class=dtitle>{title}</div></div>
<p>{lab['no']}: {escape(number)} &nbsp;·&nbsp; {lab['date']}: {ds} &nbsp;·&nbsp; {lab['due']}: {dd}</p><p>{lab['bill']}: {escape(client)}</p>
<table class=dt><tr><th>{lab['desc']}</th><th class=n>{lab['qty']}</th><th class=n>{lab['unit']}</th><th class=n>{lab['amount']}</th></tr>{rows}</table>
<div class=dsum>{lab['sub']} {m(subtotal)}<br>{"<br>".join(f"{escape(vat_label(v))} {m(v['amount'])}" for v in vat_lines)}<br><b>{lab['total']} {m(total)}</b></div></div>"""
        return dict(truth=truth, html=page(body, style), size=(1240, 1754))
    if layout == "leaders":
        # No table at all: "3 × Toner cartridge ........ 135,00" with dotted leaders.
        lines = "".join(f"<div class=lead><span>{i['qty']} × {escape(i['desc'])}</span><i></i><span>{mn(i['amount'])}</span></div>" for i in items)
        rows_html = f"<div class=leaders>{lines}</div>"
    else:
        rows_html = f"<table class=items>{head}{rows}</table>"
    body = f"""<div class="top {style}"><div><div class=brand>{escape(vendor)}</div><div class=sub>{rnd.randint(1, 240)} {escape(rnd.choice(['Market Street', 'Hauptstraße', 'Rue de la Paix', 'Calle Mayor', 'Via Roma', 'Kerkstraat', 'Rua Augusta', 'ul. Długa', 'Atatürk Cad.']))} · info@{vendor.split()[0].lower().strip('&.,')}.example</div></div><div class=doc>{title}</div></div>
<div class=metawrap><div><div class=label>{lab['bill']}</div>{escape(client)}<br>{rnd.randint(1, 99)} {escape(rnd.choice(['Oak Avenue', 'Lindenweg', 'Boulevard Haussmann', 'Gran Vía', 'Corso Italia', 'Damrak', 'Avenida da Liberdade', 'ul. Polna', 'İstiklal Cad.']))}</div>{meta}</div>
{rows_html}{totals}<div class=foot>IBAN {rnd.choice(['DE','FR','ES','IT','NL','PT','PL','TR','GB'])}{rnd.randint(10,99)} 0000 0000 0000 0000 00 · {escape(lab['thanks'])}</div>"""
    if layout == "multipage":
        truth["pdf_only"] = True
        return dict(truth=truth, html=page(body, style).replace("html, body { width: 1240px; height: 1754px;", "html, body { width: 1240px; min-height: 1754px;"), size=(1240, 1754))
    return dict(truth=truth, html=page(body, style), size=(1240, 1754))


def make_receipt(locale: str, idx: int) -> dict:
    loc = LOCALE[locale]
    lab = L[loc["lang"]]
    jpy = not loc["dec"]
    vendor = rnd.choice(VENDORS[loc["lang"]])
    when = date(2026, rnd.randint(1, 10), rnd.randint(1, 28))
    rate = loc["rates"][-1] if loc["rates"][-1] else 10
    items = []
    for name in rnd.sample(ITEMS[loc["lang"]], rnd.randint(2, 5)):
        qty = rnd.choice([1, 1, 2, 3])
        unit = rnd.choice([2.4, 3.8, 5.5, 9.9, 14.0]) * (100 if jpy else 1)
        unit = round(unit) if jpy else unit
        items.append(dict(desc=name[:22], qty=qty, unit=unit, amount=round(qty * unit) if jpy else r2(qty * unit)))
    total = r2(sum(i["amount"] for i in items))
    vat = round(total * rate / (100 + rate)) if jpy else r2(total * rate / (100 + rate))
    mn = lambda x: money(x, loc, symbol=False)  # noqa: E731
    lines = "".join(f"<div class=row><span>{i['qty']} x {escape(i['desc'])}</span><span>{mn(i['amount'])}</span></div>" if i["qty"] > 1 else f"<div class=row><span>{escape(i['desc'])}</span><span>{mn(i['amount'])}</span></div>" for i in items)
    body = f"""<div class=r><div class=c><b>{escape(vendor.upper())}</b></div><div class=c>{lab['receipt']} #{rnd.randint(1000, 99999)}</div><div class=c>{fmt_date(when, loc)} {rnd.randint(8, 21):02d}:{rnd.randint(0, 59):02d}</div><hr>{lines}<hr>
<div class="row b"><span>TOTAL</span><span>{money(total, loc)}</span></div><div class=row><span>{lab['incl']} {rate:g}%</span><span>{mn(vat)}</span></div><div class=row><span>{lab['card']}</span><span>{mn(total)}</span></div><hr><div class=c>{escape(lab['thanks'])}</div></div>"""
    truth = dict(kind="receipt", locale=locale, lang=loc["lang"], layout="receipt", vendor=vendor.upper(), date=when.isoformat(), currency=loc["cur"], total=total, vat=[dict(rate=rate, amount=vat)],
                 items=[dict(qty=i["qty"], unit=i["unit"], amount=i["amount"]) for i in items])
    return dict(truth=truth, html=receipt_page(body), size=(640, 1100))


STATEMENT = {
    "en-GB": dict(title="Statement of account", head=["Date", "Description", "Paid out", "Paid in", "Balance"], open="Balance brought forward", close="Balance carried forward", bank="Thornbury Bank"),
    "tr": dict(title="Hesap Hareketleri", head=["Tarih", "Açıklama", "Borç", "Alacak", "Bakiye"], open="Devreden Bakiye", close="Dönem Sonu Bakiye", bank="Yıldız Katılım Bankası"),
    "de": dict(title="Kontoauszug", head=["Buchungstag", "Verwendungszweck", "Soll", "Haben", "Saldo"], open="Alter Saldo", close="Neuer Saldo", bank="Sparkasse Rheintal"),
    "fr": dict(title="Relevé de compte", head=["Date", "Libellé", "Débit", "Crédit", "Solde"], open="Ancien solde", close="Nouveau solde", bank="Banque Delacroix"),
    "es": dict(title="Extracto de cuenta", head=["Fecha", "Concepto", "Cargo", "Abono", "Saldo"], open="Saldo anterior", close="Saldo final", bank="Banco Alcázar"),
    "it": dict(title="Estratto conto", head=["Data", "Descrizione", "Addebiti", "Accrediti", "Saldo"], open="Saldo iniziale", close="Saldo finale", bank="Banca Lombarda Nord"),
    "nl": dict(title="Rekeningafschrift", head=["Datum", "Omschrijving", "Af", "Bij", "Saldo"], open="Beginsaldo", close="Eindsaldo", bank="Polderbank"),
    "pl": dict(title="Wyciąg z rachunku", head=["Data", "Opis operacji", "Obciążenia", "Uznania", "Saldo"], open="Saldo początkowe", close="Saldo końcowe", bank="Bank Mazowiecki"),
}

PAYEES = ["Card payment SUPERMARKET 0423", "Transfer to J. Novak", "Salary OCTOBER", "Direct debit ELECTRIC CO", "ATM withdrawal 1182", "Refund ONLINE STORE", "Rent payment", "Insurance premium", "Card payment FUEL STATION", "Interest"]


def make_statement(locale: str, idx: int) -> dict:
    loc = LOCALE[locale]
    s = STATEMENT[locale]
    newest_first = idx % 2 == 1
    start = date(2026, rnd.randint(1, 9), 1)
    balance = r2(rnd.uniform(500, 9000))
    opening = balance
    tx = []
    day = start
    for k in range(rnd.randint(6, 14)):
        day = day + timedelta(days=rnd.randint(1, 3))
        amt = r2(rnd.choice([-1, -1, -1, 1]) * rnd.uniform(5, 1800))
        balance = r2(balance + amt)
        tx.append(dict(date=day, desc=rnd.choice(PAYEES) + f" {rnd.randint(100, 999)}", amount=amt, balance=balance))
    shown = list(reversed(tx)) if newest_first else tx
    mn = lambda x: money(x, loc, symbol=False)  # noqa: E731
    rows = "".join(
        f"<tr><td>{fmt_date(t['date'], loc)}</td><td>{escape(t['desc'])}</td><td class=n>{mn(-t['amount']) if t['amount'] < 0 else ''}</td><td class=n>{mn(t['amount']) if t['amount'] > 0 else ''}</td><td class=n>{mn(t['balance'])}</td></tr>"
        for t in shown
    )
    open_row = f"<tr><td></td><td>{s['open']}</td><td></td><td></td><td class=n>{mn(opening)}</td></tr>"
    close_row = f"<tr><td></td><td><b>{s['close']}</b></td><td></td><td></td><td class=n><b>{mn(balance)}</b></td></tr>"
    head = "".join(f"<th{' class=n' if i >= 2 else ''}>{h}</th>" for i, h in enumerate(s["head"]))
    body = f"""<div class="top modern"><div><div class=brand>{s['bank']}</div><div class=sub>IBAN {rnd.choice(['GB', 'TR', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL'])}00 0000 0000 0000 0000 {rnd.randint(10, 99)}</div></div><div class=doc style="font-size:30px">{s['title']}</div></div>
<div class=metawrap><div>{escape(rnd.choice(CLIENTS))}</div><div>{fmt_date(start, loc)} – {fmt_date(day, loc)}</div></div>
<table class=items><tr>{head}</tr>{close_row if newest_first else open_row}{rows}{open_row if newest_first else close_row}</table>"""
    truth = dict(kind="statement", locale=locale, lang=loc["lang"], layout="statement", bank=s["bank"], newest_first=newest_first, opening=opening, closing=balance,
                 transactions=[dict(date=t["date"].isoformat(), amount=t["amount"], balance=t["balance"]) for t in tx])
    return dict(truth=truth, html=page(body, "modern"), size=(1240, 1754))

REPORT = {
    "en": dict(loc="en-GB", company="Larkspur Components Ltd", doc="DOCUMENT", unit="Amounts in GBP thousands", item="Item",
               inc="Income statement", bal="Balance sheet", cf="Cash flow statement", periods=["2025", "2026"], dates=["31 December 2025", "31 December 2026"],
               rows=dict(revenue="Revenue", cogs="Cost of sales", gp="Gross profit", opex="Operating expenses", dep="Depreciation expense", op="Operating profit", fin="Net finance costs", pbt="Profit before tax", tax="Tax expense", np="Net profit for the period",
                         cash="Cash and cash equivalents", rec="Trade receivables", inv="Inventories", tca="Total current assets", ppe="Property, plant and equipment, net", ta="Total assets",
                         pay="Trade payables", std="Short-term borrowings", tcl="Total current liabilities", ltd="Long-term borrowings", tl="Total liabilities", cap="Paid-in capital", re="Retained earnings", te="Total equity", tle="Total liabilities and equity",
                         cfo="Net cash from operating activities", capex="Purchases of property, plant and equipment", cfi="Net cash used in investing activities", debt="Net change in borrowings", cff="Net cash from financing activities", chg="Net increase in cash and cash equivalents", open="Cash and cash equivalents at beginning of period", close="Cash and cash equivalents at end of period", dadj="Depreciation adjustment", wc="Change in working capital")),
    "tr": dict(loc="tr", company="Akdeniz Makine Sanayi AŞ", doc="BELGE", unit="Birim bin TL", item="Kalem",
               inc="Gelir tablosu", bal="Bilanço", cf="Nakit akış tablosu", periods=["2025", "2026"], dates=["31 Aralık 2025", "31 Aralık 2026"],
               rows=dict(revenue="Net satışlar", cogs="Satışların maliyeti", gp="Brüt kâr", opex="Faaliyet giderleri", dep="Amortisman giderleri", op="Faaliyet kârı", fin="Net finansman giderleri", pbt="Vergi öncesi kâr", tax="Vergi gideri", np="Dönem net kârı",
                         cash="Nakit ve nakit benzerleri", rec="Ticari alacaklar", inv="Stoklar", tca="Dönen varlıklar toplamı", ppe="Maddi duran varlıklar net", ta="Toplam varlıklar",
                         pay="Ticari borçlar", std="Kısa vadeli finansal borçlar", tcl="Kısa vadeli yükümlülükler toplamı", ltd="Uzun vadeli finansal borçlar", tl="Yükümlülükler toplamı", cap="Ödenmiş sermaye", re="Geçmiş yıllar kârları", te="Özkaynaklar toplamı", tle="Toplam kaynaklar",
                         cfo="Faaliyetlerden sağlanan net nakit", capex="Maddi duran varlık alımları", cfi="Yatırımlarda kullanılan net nakit", debt="Net kredi kullanımı", cff="Finansmandan sağlanan net nakit", chg="Nakit ve nakit benzerlerindeki net artış", open="Dönem başı nakit ve nakit benzerleri", close="Dönem sonu nakit ve nakit benzerleri", dadj="Amortisman düzeltmesi", wc="İşletme sermayesindeki değişim")),
    "de": dict(loc="de", company="Brenner Antriebstechnik GmbH", doc="DOKUMENT", unit="Angaben in TEUR", item="Posten",
               inc="Gewinn- und Verlustrechnung", bal="Bilanz", cf="Kapitalflussrechnung", periods=["2025", "2026"], dates=["31.12.2025", "31.12.2026"],
               rows=dict(revenue="Umsatzerlöse", cogs="Umsatzkosten", gp="Bruttoergebnis", opex="Betriebliche Aufwendungen", dep="Abschreibungen", op="Betriebsergebnis", fin="Zinsaufwand", pbt="Ergebnis vor Steuern", tax="Ertragsteuern", np="Jahresüberschuss",
                         cash="Liquide Mittel", rec="Forderungen aus Lieferungen und Leistungen", inv="Vorräte", tca="Summe Umlaufvermögen", ppe="Sachanlagen", ta="Summe Aktiva",
                         pay="Verbindlichkeiten aus Lieferungen und Leistungen", std="Kurzfristige Finanzverbindlichkeiten", tcl="Summe kurzfristige Verbindlichkeiten", ltd="Langfristige Finanzverbindlichkeiten", tl="Summe Verbindlichkeiten", cap="Gezeichnetes Kapital", re="Gewinnrücklagen", te="Summe Eigenkapital", tle="Summe Passiva",
                         cfo="Cashflow aus laufender Geschäftstätigkeit", capex="Investitionen in Sachanlagen", cfi="Cashflow aus Investitionstätigkeit", debt="Veränderung Finanzverbindlichkeiten", cff="Cashflow aus Finanzierungstätigkeit", chg="Veränderung der liquiden Mittel", open="Liquide Mittel am Anfang der Periode", close="Liquide Mittel am Ende der Periode", dadj="Abschreibungen (Korrektur)", wc="Veränderung Working Capital")),
    "fr": dict(loc="fr", company="Fonderie Marchand SAS", doc="DOCUMENT", unit="En milliers d'euros", item="Poste",
               inc="Compte de résultat", bal="Bilan", cf="Tableau des flux de trésorerie", periods=["2025", "2026"], dates=["31 décembre 2025", "31 décembre 2026"],
               rows=dict(revenue="Chiffre d'affaires", cogs="Coût des ventes", gp="Marge brute", opex="Charges d'exploitation", dep="Dotations aux amortissements", op="Résultat d'exploitation", fin="Charges financières nettes", pbt="Résultat avant impôt", tax="Impôt sur les sociétés", np="Résultat net",
                         cash="Trésorerie", rec="Créances clients", inv="Stocks", tca="Total actif circulant", ppe="Immobilisations corporelles", ta="Total actif",
                         pay="Dettes fournisseurs", std="Emprunts à court terme", tcl="Total passif courant", ltd="Emprunts à long terme", tl="Total dettes", cap="Capital social", re="Réserves", te="Total capitaux propres", tle="Total passif",
                         cfo="Flux de trésorerie liés à l'activité", capex="Acquisitions d'immobilisations", cfi="Flux de trésorerie liés aux opérations d'investissement", debt="Variation des emprunts", cff="Flux de trésorerie liés aux opérations de financement", chg="Variation de trésorerie", open="Trésorerie d'ouverture", close="Trésorerie de clôture", dadj="Dotations aux amortissements (retraitement)", wc="Variation du besoin en fonds de roulement")),
    "es": dict(loc="es", company="Talleres Iberia S.A.", doc="DOCUMENTO", unit="Importes en miles de euros", item="Partida",
               inc="Cuenta de pérdidas y ganancias", bal="Balance de situación", cf="Estado de flujos de efectivo", periods=["2025", "2026"], dates=["31/12/2025", "31/12/2026"],
               rows=dict(revenue="Ventas netas", cogs="Coste de ventas", gp="Margen bruto", opex="Gastos de explotación", dep="Amortización", op="Resultado de explotación", fin="Gastos financieros netos", pbt="Resultado antes de impuestos", tax="Impuesto sobre beneficios", np="Resultado del ejercicio",
                         cash="Efectivo y equivalentes", rec="Deudores comerciales", inv="Existencias", tca="Total activo corriente", ppe="Inmovilizado material", ta="Total activo",
                         pay="Acreedores comerciales", std="Deudas a corto plazo", tcl="Total pasivo corriente", ltd="Deudas a largo plazo", tl="Total pasivo", cap="Capital social", re="Reservas", te="Total patrimonio neto", tle="Total patrimonio neto y pasivo",
                         cfo="Flujos de efectivo de las actividades de explotación", capex="Adquisición de inmovilizado", cfi="Flujos de efectivo de las actividades de inversión", debt="Variación de deudas", cff="Flujos de efectivo de las actividades de financiación", chg="Aumento neto de efectivo", open="Efectivo al inicio del periodo", close="Efectivo al final del periodo", dadj="Amortización (ajuste)", wc="Variación del capital circulante")),
}


def make_report(lang: str, broken: bool) -> dict:
    R = REPORT[lang]
    loc = LOCALE[R["loc"]]
    r = R["rows"]

    def n(x: int) -> str:
        s2 = f"{abs(x):,}".replace(",", loc["thou"])
        return f"({s2})" if x < 0 else s2

    inc = []
    for k in range(2):
        rev = rnd.randint(20, 90) * 1000
        cogs = -round(rev * rnd.uniform(0.55, 0.7))
        gp = rev + cogs
        opex = -round(rev * rnd.uniform(0.12, 0.2))
        dep = -rnd.randint(4, 12) * 100
        op = gp + opex + dep
        fin = -rnd.randint(2, 9) * 100
        pbt = op + fin
        tax = -round(pbt * 0.25)
        inc.append(dict(revenue=rev, cogs=cogs, gp=gp, opex=opex, dep=dep, op=op, fin=fin, pbt=pbt, tax=tax, np=pbt + tax))
    bal = []
    for k in range(2):
        cash, rec, inv_ = rnd.randint(10, 60) * 100, rnd.randint(40, 120) * 100, rnd.randint(30, 90) * 100
        tca = cash + rec + inv_
        ppe = rnd.randint(80, 200) * 100
        ta = tca + ppe
        pay, std = rnd.randint(20, 60) * 100, rnd.randint(10, 40) * 100
        tcl = pay + std
        ltd = rnd.randint(20, 80) * 100
        tl = tcl + ltd
        cap = rnd.randint(30, 80) * 100
        re_ = ta - tl - cap
        bal.append(dict(cash=cash, rec=rec, inv=inv_, tca=tca, ppe=ppe, ta=ta, pay=pay, std=std, tcl=tcl, ltd=ltd, tl=tl, cap=cap, re=re_, te=cap + re_, tle=tl + cap + re_))
    np_ = inc[1]["np"]
    dadj = -inc[1]["dep"]
    chg = bal[1]["cash"] - bal[0]["cash"]
    capex = -rnd.randint(5, 30) * 100
    debt = rnd.randint(-20, 20) * 100
    cfi, cff = capex, debt
    cfo = chg - cfi - cff
    wc = cfo - np_ - dadj
    cf = [("np", np_), ("dadj", dadj), ("wc", wc), ("cfo", cfo), ("capex", capex), ("cfi", cfi), ("debt", debt), ("cff", cff), ("chg", chg), ("open", bal[0]["cash"]), ("close", bal[1]["cash"])]
    if broken:
        bal[1]["te"] += 500  # the balance sheet no longer balances

    def table(title: str, cols: list, rows: list) -> str:
        head = f"<tr><th>{R['item']}</th>" + "".join(f"<th class=n>{c}</th>" for c in cols) + "</tr>"
        body = "".join(f"<tr><td>{escape(r[k])}</td>" + "".join(f"<td class=n>{n(v)}</td>" for v in vals) + "</tr>" for k, vals in rows)
        return f"<p class=dno>{R['doc']} {{no}} / 03</p><h2>{escape(title)}</h2><p class=unit>{R['unit']}</p><table class=items>{head}{body}</table>"

    t1 = table(R["inc"], R["periods"], [(k, [inc[0][k], inc[1][k]]) for k in ["revenue", "cogs", "gp", "opex", "dep", "op", "fin", "pbt", "tax", "np"]]).replace("{no}", "01")
    t2 = table(R["bal"], R["dates"], [(k, [bal[0][k], bal[1][k]]) for k in ["cash", "rec", "inv", "tca", "ppe", "ta", "pay", "std", "tcl", "ltd", "tl", "cap", "re", "te", "tle"]]).replace("{no}", "02")
    t3 = table(R["cf"], [R["periods"][1]], [(k, [v]) for k, v in cf]).replace("{no}", "03")
    body = f"<p class=co>{escape(R['company'])} | {escape(R['unit'])}</p>{t1}<div style='page-break-before:always'></div>{t2}<div style='page-break-before:always'></div>{t3}"
    truth = dict(kind="report", lang=lang, locale=R["loc"], layout="report-broken" if broken else "report", pdf_only=True,
                 kinds=["income", "balance", "cashflow"], net_profit=np_, broken=broken)
    html = page(body, "plain").replace("html, body { width: 1240px; height: 1754px;", "html, body { width: 1240px; min-height: 1754px;")
    return dict(truth=truth, html=html, size=(1240, 1754))


REJECT = {
    "contract": "<h1>Service Agreement</h1><p>This agreement is made between Lumen Architects (the Client) and Northgate Analytics LLC (the Provider). The Provider agrees to deliver monthly reports. Either party may terminate this agreement with thirty days written notice.</p><p>1. Term. The term begins on the effective date and continues for twelve months.</p><p>2. Fees. Fees are set out in Schedule A and are payable within 30 days.</p><p>3. Confidentiality. Each party shall keep the other party's information confidential.</p><p>Signed: ____________________ Date: ____________</p>",
    "cv": "<h1>Elif Arslan</h1><p>Product Designer · İzmir · elif@mail.example</p><h2>Experience</h2><p>2022–2026 Senior Designer, Marmara Yazılım A.Ş. Led the redesign of the mobile banking app.</p><p>2019–2022 UI Designer, Ege Kırtasiye Ltd. Şti.</p><h2>Education</h2><p>BA Graphic Design, Dokuz Eylül University, 2019</p><h2>Skills</h2><p>Figma, user research, prototyping, design systems</p>",
    "menu": "<h1>Trattoria Bella</h1><h2>Antipasti</h2><p>Bruschetta al pomodoro ........ 7,50</p><p>Carpaccio di manzo ........ 12,00</p><h2>Primi</h2><p>Spaghetti alle vongole ........ 15,50</p><p>Risotto ai funghi ........ 14,00</p><h2>Dolci</h2><p>Tiramisù ........ 6,50</p><p>Panna cotta ........ 6,00</p><p>Coperto 2,00 · Servizio incluso</p>",
    "letter": "<p>Hamburg, 12. Oktober 2026</p><p>Sehr geehrte Frau Weber,</p><p>vielen Dank für Ihre Anfrage vom 3. Oktober. Gerne bestätigen wir den Termin am Donnerstag um 10 Uhr in unserem Büro. Bitte bringen Sie die Unterlagen zum Projekt mit.</p><p>Mit freundlichen Grüßen<br>Thomas Fischer</p>",
    "notes": "<h1>Meeting notes – roadmap</h1><ul><li>Ship the onboarding flow before the end of Q4</li><li>Hire two engineers for the platform team</li><li>Review analytics dashboard with sales</li><li>Next meeting: 14 November</li></ul>",
    "timetable": "<h1>Bus 42 – weekday timetable</h1><table class=items><tr><th>Stop</th><th>Dep.</th><th>Dep.</th><th>Dep.</th></tr><tr><td>Central Station</td><td>07:05</td><td>07:35</td><td>08:05</td></tr><tr><td>Market Square</td><td>07:12</td><td>07:42</td><td>08:12</td></tr><tr><td>University</td><td>07:20</td><td>07:50</td><td>08:20</td></tr><tr><td>Hospital</td><td>07:31</td><td>08:01</td><td>08:31</td></tr></table>",
}


CSS = """@page { size: 1240px 1754px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1240px; height: 1754px; background: #fff; }
body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1d1f23; font-size: 21px; line-height: 1.45; padding: 90px 100px; }
.top { display: flex; justify-content: space-between; align-items: flex-start; }
.top.modern { background: #f2f4f7; margin: -90px -100px 0; padding: 70px 100px 40px; border-bottom: 4px solid #3b5bdb; }
.brand { font-size: 38px; font-weight: 700; } .sub { color: #555a63; font-size: 18px; margin-top: 6px; }
.doc { font-size: 40px; font-weight: 300; letter-spacing: 4px; text-transform: uppercase; color: #3a3f47; }
.metawrap { margin-top: 56px; display: flex; justify-content: space-between; gap: 40px; }
.meta td { padding: 2px 0; } .meta td:first-child { color: #555a63; padding-right: 24px; }
.label { color: #555a63; font-size: 16px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
table.items { width: 100%; border-collapse: collapse; margin-top: 60px; }
table.items th { text-align: left; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; color: #555a63; border-bottom: 2px solid #1d1f23; padding: 10px 0; }
table.items td { padding: 14px 0; border-bottom: 1px solid #e3e5e8; vertical-align: top; }
.modern + .metawrap + table.items td, .modern ~ table.items td { border-bottom: none; }
table.items .n { text-align: right; padding-left: 22px; white-space: nowrap; }
.sum { margin-top: 30px; margin-left: auto; width: 540px; } .sum div { display: flex; justify-content: space-between; padding: 7px 0; }
.sum .grand { border-top: 2px solid #1d1f23; margin-top: 8px; padding-top: 14px; font-size: 27px; font-weight: 700; }
.foot { position: absolute; left: 100px; right: 100px; bottom: 80px; color: #555a63; font-size: 16px; border-top: 1px solid #e3e5e8; padding-top: 16px; }
.dense { font-size: 14px; line-height: 1.35; } .dhead { display: flex; justify-content: space-between; } .dtitle { font-size: 22px; font-weight: 700; }
.dense p { margin: 4px 0; } table.dt { width: 100%; border-collapse: collapse; margin-top: 18px; } .dt th { text-align: left; font-weight: 600; padding: 2px 0; } .dt td { padding: 1px 0; } .dt .n { text-align: right; padding-left: 14px; }
.dsum { margin-top: 14px; text-align: right; }
.leaders { margin-top: 60px; } .lead { display: flex; gap: 10px; align-items: baseline; padding: 6px 0; } .lead i { flex: 1; border-bottom: 2px dotted #999; }
.foot { position: static; margin-top: 40px; }
.co { color: #555a63; } .dno { margin-top: 30px; color: #555a63; letter-spacing: 2px; } .unit { color: #555a63; font-size: 17px; }
h1 { font-size: 40px; margin-bottom: 24px; } h2 { font-size: 26px; margin: 26px 0 10px; } p, li { margin: 8px 0; } ul { padding-left: 28px; }"""


def page(body: str, _style: str) -> str:
    return f"<!doctype html><html><head><meta charset=utf-8><style>{CSS}</style></head><body>{body}</body></html>"


def receipt_page(body: str) -> str:
    return f"""<!doctype html><html><head><meta charset=utf-8><style>@page {{ size: 640px 1100px; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ width: 640px; height: 1100px; background: #ebe8e1; }}
.r {{ width: 520px; margin: 40px auto; background: #fbfaf6; padding: 44px 40px 60px; font-family: "Courier New", monospace; font-size: 22px; line-height: 1.5; color: #222; }}
.c {{ text-align: center; }} .row {{ display: flex; justify-content: space-between; gap: 16px; }} .b {{ font-weight: 700; font-size: 26px; }} hr {{ border: 0; border-top: 2px dashed #888; margin: 16px 0; }}
</style></head><body>{body}</body></html>"""


def main() -> None:
    HTML.mkdir(parents=True, exist_ok=True)
    docs = []
    layouts = ["classic", "modern", "multi-vat", "discount"]
    for locale in LOCALE:
        for k, layout in enumerate(layouts):
            docs.append((f"inv-{locale}-{layout}", make_invoice(locale, layout, k)))
    # Harder cases in a spread of languages.
    for k, locale in enumerate(["en-GB", "tr", "de", "fr", "es", "it", "nl", "pt", "pl"]):
        docs.append((f"inv-{locale}-credit", make_invoice(locale, "credit", k)))
        docs.append((f"inv-{locale}-dense", make_invoice(locale, "dense", k + 1)))
        docs.append((f"inv-{locale}-leaders", make_invoice(locale, "leaders", k)))
    for k, locale in enumerate(["en-US", "de", "tr", "es"]):
        docs.append((f"inv-{locale}-multipage", make_invoice(locale, "multipage", k)))
    for locale in ["en-GB", "tr", "de", "fr", "es", "it", "nl", "pt", "pl", "en-JP"]:
        docs.append((f"rcp-{locale}", make_receipt(locale, 0)))
    for k, locale in enumerate(STATEMENT):
        for v in range(2):
            docs.append((f"stm-{locale}-{v}", make_statement(locale, v)))
    for lang in REPORT:
        docs.append((f"rep-{lang}", make_report(lang, False)))
        docs.append((f"rep-{lang}-broken", make_report(lang, True)))
    for name, html in REJECT.items():
        docs.append((f"rej-{name}", dict(truth=dict(kind="reject", layout=name), html=page(html, "plain"), size=(1240, 1754))))

    manifest = []
    for name, d in docs:
        (HTML / f"{name}.html").write_text(d["html"], encoding="utf-8")
        manifest.append(dict(name=name, width=d["size"][0], height=d["size"][1], truth=d["truth"]))
    (ROOT / "truth.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(manifest)} documents")


if __name__ == "__main__":
    main()
