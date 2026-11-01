import { describe, expect, it } from "vitest";
import { classifyDocument } from "@/lib/classify";
import { analyseReport, extractReport } from "@/lib/report";

const lines = (text: string) =>
  text
    .trim()
    .split("\n")
    .map((t) => ({ text: t.trim() }))
    .filter((l) => l.text);

// A small management pack with invented figures, in the shape real ones take:
// a cover note, statements with comparative columns, parentheses for negatives.
const EN = lines(`
  MERIDIAN TOOLING LTD | MANAGEMENT PACK
  DOCUMENT 01 / 03
  Income statement
  Year ended 31 December | Amounts in GBP thousands
  Revenue grew strongly while margins held. The comparison below uses nominal amounts.
  Item 2024 2025
  Revenue 12,000 15,000
  Cost of sales (7,200) (9,150)
  Gross profit 4,800 5,850
  Operating expenses (2,400) (2,900)
  Depreciation expense (300) (350)
  Operating profit 2,100 2,600
  Net finance costs (100) (120)
  Profit before tax 2,000 2,480
  Tax expense (500) (620)
  Net profit for the period 1,500 1,860
  DOCUMENT 02 / 03
  Balance sheet
  Item 31 December 2024 31 December 2025
  Cash and cash equivalents 900 1,400
  Trade receivables 2,100 2,600
  Inventories 1,500 1,700
  Total current assets 4,500 5,700
  Property, plant and equipment, net 3,000 3,300
  Total assets 7,500 9,000
  Trade payables 1,200 1,350
  Short-term borrowings 800 700
  Total current liabilities 2,000 2,050
  Long-term borrowings 1,500 1,090
  Total liabilities 3,500 3,140
  Paid-in capital 2,000 2,000
  Retained earnings 2,000 3,860
  Total equity 4,000 5,860
  Total liabilities and equity 7,500 9,000
  DOCUMENT 03 / 03
  Cash flow statement
  Item 2025
  Net profit for the period 1,860
  Depreciation adjustment 350
  Increase in trade receivables (500)
  Increase in inventories (200)
  Increase in trade payables 150
  Net cash from operating activities 1,660
  Purchases of property, plant and equipment (650)
  Net cash used in investing activities (650)
  Net short-term borrowings (100)
  Net long-term borrowings (410)
  Net cash from financing activities (510)
  Net increase in cash and cash equivalents 500
  Cash and cash equivalents at beginning of period 900
  Cash and cash equivalents at end of period 1,400
`);

const TR = lines(`
  ANADOLU TEKSTİL AŞ | ÖRNEK RAPOR
  BELGE 01 / 02
  Gelir tablosu
  Kalem 2025 ilk yarı 2026 ilk yarı
  Net satışlar 20.000 24.000
  Satışların maliyeti (13.000) (15.840)
  Brüt kâr 7.000 8.160
  Faaliyet giderleri (3.500) (4.000)
  Amortisman giderleri (500) (560)
  Faaliyet kârı 3.000 3.600
  Net finansman giderleri (400) (480)
  Vergi öncesi kâr 2.600 3.120
  Vergi gideri (650) (780)
  Dönem net kârı 1.950 2.340
  BELGE 02 / 02
  Bilanço
  Kalem 31 Aralık 2025 30 Haziran 2026
  Nakit ve nakit benzerleri 1.000 1.200
  Ticari alacaklar 3.000 3.400
  Dönen varlıklar toplamı 4.000 4.600
  Maddi duran varlıklar net 6.000 6.400
  Toplam varlıklar 10.000 11.000
  Kısa vadeli finansal borçlar 2.000 2.100
  Yükümlülükler toplamı 2.000 2.100
  Ödenmiş sermaye 5.000 5.000
  Geçmiş yıllar kârları 3.000 3.900
  Özkaynaklar toplamı 8.000 8.900
  Toplam kaynaklar 10.000 11.000
`);

describe("financial reports", () => {
  it("are detected as reports, not receipts", () => {
    expect(classifyDocument(EN).type).toBe("report");
    expect(classifyDocument(TR).type).toBe("report");
  });

  it("finds each statement with its period columns", () => {
    const r = extractReport(EN);
    expect(r.company).toBe("MERIDIAN TOOLING LTD");
    expect(r.unit).toBe("GBP thousands");
    expect(r.tables.map((t) => [t.kind, t.title, t.columns])).toEqual([
      ["income", "Income statement", ["2024", "2025"]],
      ["balance", "Balance sheet", ["31 December 2024", "31 December 2025"]],
      ["cashflow", "Cash flow statement", ["2025"]],
    ]);
    expect(r.tables[0].rows[1]).toMatchObject({ label: "Cost of sales", values: [-7200, -9150] });
  });

  it("checks every identity and agrees across statements", () => {
    const a = analyseReport(extractReport(EN));
    expect(a.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(a.checks.map((c) => c.label)).toEqual(
      expect.arrayContaining([
        "Income statement: net profit = profit before tax − tax",
        "Balance sheet: assets = liabilities + equity",
        "Cash flow statement: opening cash + net change = closing cash",
        "Closing cash: cash flow statement = balance sheet",
        "Net profit: income statement = cash flow statement",
      ]),
    );
    expect(a.ratios.find((x) => x.label === "Gross margin")?.values.map((v) => v.value)).toEqual([40, 39]);
    expect(a.ratios.find((x) => x.label === "Current ratio")?.values.map((v) => v.value)).toEqual([2.3, 2.8]);
  });

  it("reads Turkish statements, dotted thousands and kâr", () => {
    const r = extractReport(TR);
    expect(r.decimal).toBe(",");
    expect(r.tables.map((t) => t.kind)).toEqual(["income", "balance"]);
    expect(r.tables[0].columns).toEqual(["2025 ilk yarı", "2026 ilk yarı"]);
    const a = analyseReport(r);
    expect(a.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(a.headline.find((h) => h.label === "Net profit")).toMatchObject({ value: 2340, previous: 1950 });
  });

  it("flags a balance sheet that does not balance", () => {
    const broken = EN.map((l) => (l.text.startsWith("Total equity") ? { text: "Total equity 4,000 5,960" } : l));
    const failed = analyseReport(extractReport(broken)).checks.filter((c) => c.status === "fail").map((c) => c.label);
    expect(failed).toContain("Balance sheet: assets = liabilities + equity");
  });

  it("rebuilds a balance sheet from a shadowed phone photo's noisy OCR", () => {
    // What the reader gets from a crooked, half-shadowed photo: specks on lines of their own,
    // pale first-column figures missed, junk at row ends, "17.100" and "27,900" side by side.
    const r = extractReport(lines(`NORTHGATE PACKAGING AS | EXAMPLE
DOCUMENT 02 / 05
Comparative balance sheet  p  >
Amounts in TRY thousands
|
Cash and cash equivalents  ]
Trade receivables
Inventories
Total current assets  15.200  19,450  ¢€
Y
Property, plant and equipment  9,800
Total assets  »  25.000  29.250
{
Trade payables  Sa  =30 J
]
{ Total current liabilities  10.100  12,400
Share capital  6,000  6.000
Retained earnings  8.900  10,850  |
Total equity  14.900  16,850
Total liabilities and equity  25,000  29,250
The figures are illustrative.`));
    expect(r.tables).toHaveLength(1);
    const t = r.tables[0];
    expect(t.title).toBe("Comparative balance sheet");
    expect(t.rows.map((x) => [x.label, x.values])).toEqual([
      ["Cash and cash equivalents", [null, null]],
      ["Trade receivables", [null, null]],
      ["Inventories", [null, null]],
      ["Total current assets", [15200, 19450]],
      ["Property, plant and equipment", [null, 9800]],
      ["Total assets", [25000, 29250]],
      ["Trade payables Sa", [null, null]],
      ["Total current liabilities", [10100, 12400]],
      ["Share capital", [6000, 6000]],
      ["Retained earnings", [8900, 10850]],
      ["Total equity", [14900, 16850]],
      ["Total liabilities and equity", [25000, 29250]],
    ]);
    expect(analyseReport(r).checks.filter((c) => c.status === "fail")).toEqual([]);
  });

  it("keeps clean text strict: no figure-less rows, no stray digits", () => {
    const r = extractReport(lines(`Balance sheet
Item 2025 2026
Cash 1,200 1,500
Receivables 800 950`));
    expect(r.tables[0].rows.map((x) => x.values)).toEqual([[1200, 1500], [800, 950]]);
  });
});
