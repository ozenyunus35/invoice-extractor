import { describe, expect, it } from "vitest";
import { datesIn } from "@/lib/dates";
import { extractInvoice } from "@/lib/extract";
import { detectDecimal, numbersIn, parseNumber, percentsIn } from "@/lib/numbers";
import { validateInvoice } from "@/lib/validate";

const lines = (text: string) =>
  text
    .trim()
    .split("\n")
    .map((t) => ({ text: t.trim() }))
    .filter((l) => l.text);

describe("numbers", () => {
  it("reads both decimal styles", () => {
    expect(parseNumber("1,234.56", ".")).toBe(1234.56);
    expect(parseNumber("1.234,56", ",")).toBe(1234.56);
    expect(parseNumber("12", ",")).toBe(12);
    expect(parseNumber("−3.50", ".")).toBe(-3.5);
  });

  it("detects the decimal separator and ignores dates", () => {
    expect(detectDecimal("Summe 1.190,00\nMwSt 190,00\nDatum 01.10.2026")).toBe(",");
    expect(detectDecimal("Total $1,190.00\nDate 01.10.2026")).toBe(".");
  });

  it("skips dates and percentages when listing numbers", () => {
    expect(numbersIn("VAT 20% on 31.10.2026 4.00", ".").map((n) => n.value)).toEqual([4]);
    expect(percentsIn("KDV %20")).toEqual([20]);
    expect(percentsIn("MwSt 7 %")).toEqual([7]);
    expect(percentsIn("TVA incluse 5.5%")).toEqual([5.5]);
    expect(percentsIn("Total %8,246.29")).toEqual([]);
  });
});

describe("dates", () => {
  it("reads numeric, ISO and written dates", () => {
    expect(datesIn("Datum: 31.10.2026")[0].iso).toBe("2026-10-31");
    expect(datesIn("Date 2026-10-05")[0].iso).toBe("2026-10-05");
    expect(datesIn("Issued Oct 5, 2026")[0].iso).toBe("2026-10-05");
    expect(datesIn("Tarih 5 Ekim 2026")[0].iso).toBe("2026-10-05");
    expect(datesIn("10/05/2026", true)[0].iso).toBe("2026-10-05");
    expect(datesIn("10/05/2026")[0].iso).toBe("2026-05-10");
  });

  it("rejects impossible dates", () => {
    expect(datesIn("31.02.2026")).toEqual([]);
  });
});

describe("US SaaS invoice", () => {
  const inv = extractInvoice(
    lines(`
      Halcyon Cloud Inc. INVOICE
      400 Harbor Way, Suite 12, Oakland, CA 94607
      Invoice No: INV-2026-0418
      Invoice Date: Oct 1, 2026
      Due Date: Oct 31, 2026
      Bill To
      Marlow & Pike LLC
      Description Qty Unit Price Amount
      Team plan seats 12 $24.00 $288.00
      Usage overage (GB) 340 $0.15 $51.00
      Priority support 1 $99.00 $99.00
      Subtotal $438.00
      Sales Tax (8.875%) $38.87
      Total Due $476.87
    `),
  );

  it("finds the header fields", () => {
    expect(inv.vendor.value).toBe("Halcyon Cloud Inc.");
    expect(inv.invoiceNumber.value).toBe("INV-2026-0418");
    expect(inv.date.value).toBe("2026-10-01");
    expect(inv.dueDate.value).toBe("2026-10-31");
    expect(inv.currency.value).toBe("USD");
  });

  it("reads the line items and totals", () => {
    expect(inv.items.map((i) => [i.description, i.quantity, i.unitPrice, i.amount])).toEqual([
      ["Team plan seats", 12, 24, 288],
      ["Usage overage (GB)", 340, 0.15, 51],
      ["Priority support", 1, 99, 99],
    ]);
    expect(inv.subtotal.value).toBe(438);
    expect(inv.vat).toMatchObject([{ rate: 8.875, amount: 38.87 }]);
    expect(inv.total.value).toBe(476.87);
  });

  it("passes every check", () => {
    expect(validateInvoice(inv).map((c) => [c.id, c.status])).toEqual([
      ["required", "pass"],
      ["items-sum", "pass"],
      ["subtotal-vat-total", "pass"],
      ["vat-rate", "pass"],
      ["line-math", "pass"],
    ]);
  });
});

describe("German invoice with two VAT rates", () => {
  const inv = extractInvoice(
    lines(`
      Brauer & Lenz GmbH
      Rechnung
      Rechnungsnummer: RE-26-1187
      Rechnungsdatum: 14.10.2026
      USt-IdNr: DE 298765431
      Pos Beschreibung Menge Einzelpreis Betrag
      1 Kaffeebohnen Espresso 1 kg 6 18,50 111,00
      2 Hafermilch Barista 1 l 24 2,10 50,40
      3 Siebträger Reparatur 1 145,00 145,00
      Zwischensumme 306,40
      MwSt 7% auf 161,40 11,30
      MwSt 19% auf 145,00 27,55
      Gesamtbetrag 345,25 EUR
    `),
  );

  it("reads comma decimals and both VAT lines", () => {
    expect(inv.decimal).toBe(",");
    expect(inv.currency.value).toBe("EUR");
    expect(inv.taxId.value).toBe("DE 298765431");
    expect(inv.invoiceNumber.value).toBe("RE-26-1187");
    expect(inv.date.value).toBe("2026-10-14");
    expect(inv.items).toHaveLength(3);
    expect(inv.items[1]).toMatchObject({ quantity: 24, unitPrice: 2.1, amount: 50.4 });
    expect(inv.vat).toMatchObject([
      { rate: 7, base: 161.4, amount: 11.3 },
      { rate: 19, base: 145, amount: 27.55 },
    ]);
    expect(inv.total.value).toBe(345.25);
    expect(validateInvoice(inv).every((c) => c.status === "pass")).toBe(true);
  });
});

describe("Turkish e-Arşiv invoice", () => {
  const inv = extractInvoice(
    lines(`
      Kuzey Ofis Malzemeleri Ltd. Şti.
      e-Arşiv Fatura
      Vergi No: 4810293847
      Fatura No: KOM2026000000412
      Fatura Tarihi: 22.10.2026
      Sayın
      Deniz Yapı A.Ş.
      Açıklama Miktar Birim Fiyat Tutar
      A4 Fotokopi Kağıdı 80 gr 10 189,90 1.899,00
      Toner Kartuşu 2 1.250,00 2.500,00
      Ara Toplam 4.399,00
      Hesaplanan KDV %20 879,80
      Genel Toplam 5.278,80 TL
    `),
  );

  it("reads Turkish labels", () => {
    expect(inv.vendor.value).toBe("Kuzey Ofis Malzemeleri Ltd. Şti.");
    expect(inv.taxId.value).toBe("4810293847");
    expect(inv.invoiceNumber.value).toBe("KOM2026000000412");
    expect(inv.currency.value).toBe("TRY");
    expect(inv.subtotal.value).toBe(4399);
    expect(inv.vat).toMatchObject([{ rate: 20, amount: 879.8 }]);
    expect(inv.total.value).toBe(5278.8);
    expect(validateInvoice(inv).every((c) => c.status === "pass")).toBe(true);
  });
});

describe("UK café receipt", () => {
  const inv = extractInvoice(
    lines(`
      THE COPPER KETTLE
      12 Market Row, Bristol
      Receipt No 004211
      31/10/2026 08:42
      2 x Flat white 3.40 6.80
      Almond croissant 3.25
      Orange juice 2.95
      TOTAL £13.00
      VAT 20% incl. 2.17
    `),
  );

  it("reads a VAT-inclusive receipt", () => {
    expect(inv.vendor.value).toBe("THE COPPER KETTLE");
    expect(inv.date.value).toBe("2026-10-31");
    expect(inv.currency.value).toBe("GBP");
    expect(inv.items.map((i) => [i.description, i.quantity, i.amount])).toEqual([
      ["Flat white", 2, 6.8],
      ["Almond croissant", 1, 3.25],
      ["Orange juice", 1, 2.95],
    ]);
    expect(inv.total.value).toBe(13);
    const checks = Object.fromEntries(validateInvoice(inv).map((c) => [c.id, c.status]));
    expect(checks["items-sum"]).toBe("pass");
    expect(checks["vat-rate"]).toBe("pass");
  });
});

describe("invoice with a mistake", () => {
  it("flags totals that do not add up", () => {
    const inv = extractInvoice(
      lines(`
        Ridgeline Studio LLC
        Invoice # 2026-077
        Date: 10/12/2026
        Description Hours Rate Amount
        Brand workshop 6 $120.00 $720.00
        Logo design 14 $95.00 $1,330.00
        Subtotal $2,150.00
        Total $2,150.00
      `),
    );
    const checks = Object.fromEntries(validateInvoice(inv).map((c) => [c.id, c]));
    expect(inv.date.value).toBe("2026-10-12");
    expect(checks["items-sum"].status).toBe("fail");
    expect(checks["items-sum"].detail).toContain("off by 100.00");
  });
});
