import { describe, expect, it } from "vitest";
import { datesIn } from "@/lib/dates";
import { csvRows, decodeText, rtfRows, unflattenTables } from "@/lib/office";

describe("CSV", () => {
  it("honours Excel's sep= line and keeps a quoted line break in one cell", () => {
    const rows = csvRows('sep=;\r\nAçıklama;Tutar\r\n"Danışmanlık\r\n(Ekim)";1.250,00\r\nToplam;1.250,00');
    expect(rows).toEqual(["Açıklama  Tutar", "Danışmanlık (Ekim)  1.250,00", "Toplam  1.250,00"]);
  });

  it("picks the separator that splits most lines, not the one in the first line", () => {
    expect(csvRows('Copperline Studio\nInvoice\nItem 1,25,4.50,112.50\nTotal,"£1,470.50"')).toEqual(["Copperline Studio", "Invoice", "Item 1  25  4.50  112.50", "Total  £1,470.50"]);
  });
});

describe("text encodings", () => {
  it("reads Turkish Excel's Windows-1254 CSV", () => {
    const bytes = Uint8Array.from([0x44, 0x61, 0x6e, 0xfd, 0xfe, 0x6d, 0x61, 0x6e, 0x6c, 0xfd, 0x6b, 0x20, 0xfe, 0x69, 0x72, 0x6b, 0x65, 0x74, 0x69]);
    expect(decodeText(bytes)).toBe("Danışmanlık şirketi");
  });

  it("reads UTF-16 text with a byte-order mark", () => {
    const s = "Gesamtbetrag\t1.234,56 €";
    const bytes = new Uint8Array(2 + s.length * 2);
    bytes.set([0xff, 0xfe]);
    for (let i = 0; i < s.length; i++) bytes.set([s.charCodeAt(i) & 0xff, s.charCodeAt(i) >> 8], 2 + i * 2);
    expect(decodeText(bytes)).toBe(s);
  });
});

describe("RTF", () => {
  it("decodes code-page bytes, tabs, table cells and TextEdit's backslash line breaks", () => {
    const rtf = "{\\rtf1\\ansi\\ansicpg1254{\\fonttbl{\\f0 Arial;}}{\\*\\generator X;}Ege K\\'fdrtasiye\\\nGenel Toplam:\\tab 2.077,20 TL\\par\\trowd\\intbl Toner\\cell 10\\cell 180,00\\cell\\row}";
    expect(rtfRows(rtf)).toEqual(["Ege Kırtasiye", "Genel Toplam:  2.077,20 TL", "Toner  10  180,00", ""]);
  });

  it("reads \\u escapes and skips their fallback character", () => {
    expect(rtfRows("{\\rtf1\\uc1 Fa\\u351?ura}")).toEqual(["Faşura"]);
  });
});

describe("flattened tables", () => {
  it("puts a table saved as one paragraph per cell back together", () => {
    const rows = ["Descripción", "Cant.", "Precio unitario", "Importe", "Consultoría", "1", "89,99", "89,99", "Licencia anual", "12", "12,90", "154,80", "Base imponible", "244,79 €", "IVA 21%", "51,41 €"];
    expect(unflattenTables(rows)).toEqual(["Descripción  Cant.  Precio unitario  Importe", "Consultoría  1  89,99  89,99", "Licencia anual  12  12,90  154,80", "Base imponible  244,79 €", "IVA 21%  51,41 €"]);
  });

  it("leaves ordinary paragraphs alone", () => {
    const rows = ["Dear customer,", "Thank you for your order.", "Kind regards"];
    expect(unflattenTables(rows)).toEqual(rows);
  });
});

describe("dates a phone photo ran together", () => {
  it.each([
    ["Fatura Tarihi  14 Mart2026", "2026-03-14"],
    ["Data da fatura.  27 de maio de2026", "2026-05-27"],
    ["Due Date:  Nov9,2026", "2026-11-09"],
  ])("%s", (line, iso) => expect(datesIn(line)[0]?.iso).toBe(iso));
});
