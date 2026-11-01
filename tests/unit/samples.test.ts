import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractInvoice } from "@/lib/extract";
import { wordsToLines, type OcrWord } from "@/lib/layout";
import { validateInvoice } from "@/lib/validate";

/** Real tesseract.js output for the sample images (scripts/ocr-samples.mjs). */
const read = (name: string) => {
  const { words } = JSON.parse(readFileSync(`src/data/ocr/${name}.json`, "utf8")) as { words: OcrWord[] };
  const inv = extractInvoice(wordsToLines(words));
  const checks = Object.fromEntries(validateInvoice(inv).map((c) => [c.id, c.status]));
  return { inv, checks };
};

const EXPECTED = {
  halcyon: { vendor: "Halcyon Cloud Inc.", number: "INV-2026-0418", date: "2026-10-01", currency: "USD", items: 4, total: 525.87, fails: [] },
  brauer: { vendor: "Brauer & Lenz GmbH", number: "RE-26-1187", date: "2026-10-14", currency: "EUR", items: 3, total: 345.25, fails: [] },
  kuzey: { vendor: "Kuzey Ofis Malzemeleri Ltd. Şti.", number: "KOM2026000000412", date: "2026-10-22", currency: "TRY", items: 3, total: 6313.8, fails: [] },
  ridgeline: { vendor: "Ridgeline Studio LLC", number: "2026-077", date: "2026-10-12", currency: "USD", items: 3, total: 2910, fails: ["items-sum"] },
  kettle: { vendor: "THE COPPER KETTLE", number: "004211", date: "2026-10-31", currency: "GBP", items: 4, total: 18.5, fails: [] },
};

describe("sample documents through real OCR", () => {
  it.each(Object.entries(EXPECTED))("%s", (name, want) => {
    const { inv, checks } = read(name);
    expect(inv.vendor.value).toBe(want.vendor);
    expect(inv.invoiceNumber.value).toBe(want.number);
    expect(inv.date.value).toBe(want.date);
    expect(inv.currency.value).toBe(want.currency);
    expect(inv.items).toHaveLength(want.items);
    expect(inv.total.value).toBe(want.total);
    expect(Object.keys(checks).filter((id) => checks[id] === "fail")).toEqual(want.fails);
  });

  it("recovers a VAT rate that OCR misread", () => {
    expect(read("kuzey").inv.vat[0]).toMatchObject({ rate: 20, rateDerived: true, amount: 1052.3 });
  });
});

describe("tilted, blurred phone photos", () => {
  // OCR of the samples rotated 4.5° / −2.5°, blurred and darkened (tests/e2e/fixtures/*-photo.jpg).
  const photo = (name: string) => {
    const { words } = JSON.parse(readFileSync(`tests/unit/fixtures/${name}-photo.json`, "utf8")) as { words: OcrWord[] };
    const inv = extractInvoice(wordsToLines(words));
    return { inv, failed: validateInvoice(inv).filter((c) => c.status === "fail") };
  };

  it("straightens the rows before reading them", () => {
    for (const [name, total, items] of [["kettle", 18.5, 4], ["halcyon", 525.87, 4]] as const) {
      const { inv, failed } = photo(name);
      expect(inv.total.value).toBe(total);
      expect(inv.items).toHaveLength(items);
      expect(failed).toEqual([]);
    }
  });
});
