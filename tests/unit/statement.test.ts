import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyDocument } from "@/lib/classify";
import { wordsToLines, type OcrWord } from "@/lib/layout";
import { extractStatement, statementTotals, validateStatement } from "@/lib/statement";

const lines = (text: string) =>
  text
    .trim()
    .split("\n")
    .map((t) => ({ text: t.trim() }))
    .filter((l) => l.text);

// Shaped like a Turkish bank's "Hesap Hareketleri" export, newest first, with invented data.
const TR_STATEMENT = lines(`
  ENGLISH TRANSLATION
  Original: Örnek Bankası Account Transactions statement (Turkish: "Hesap Hareketleri")
  Customer : DENIZ KAYA Branch Code : MERKEZ ŞUBE
  Address : ATATÜRK CAD. NO: 12 Customer/Account No : 100000001-5001
  IBAN : TR00 0001 0000 0000 0000 0000 01
  Currency : TRY
  Period : 26.09.2026-26.10.2026
  Date Receipt No Description Amount Balance
  20.10.2026 F24311 MESSAGE FEE AMOUNT -0,37 0,00
  20.10.2026 F24311 BSMV (BANKING AND INSURANCE TRANSACTIONS TAX) AMOUNT -0,18 0,37
  20.10.2026 F24311 COMMISSION AMOUNT -3,63 0,55
  20.10.2026 F24311 FAST transfer to ACME LTD -243,21 4,18
  05.10.2026 F54150 VIRTUAL POS PURCHASE CARD NO: 5282 **** **** 0000 MERCHANT: -115,00 247,39
  MUSIC STREAMING RECONCILIATION: 0971963
  01.10.2026 F43538 Refund of cancelled transaction 358,62 362,39
  30.09.2026 F08331 VIRTUAL POS PURCHASE MERCHANT: ONLINE STORE -358,62 3,77
  30.09.2026 F08328 Incoming FAST transaction 360,00 362,39
  29.09.2026 F12008 Incoming FAST transaction 2,39 2,39
  Debit: -721,01
  Credit: 721,01
`);

describe("statement detection", () => {
  it("does not read a bank statement as an invoice", () => {
    expect(classifyDocument(TR_STATEMENT).type).toBe("statement");
  });

  it.each([
    ["halcyon", "invoice"],
    ["brauer", "invoice"],
    ["kuzey", "invoice"],
    ["ridgeline", "invoice"],
    ["kettle", "receipt"],
  ])("classifies the %s sample as %s", (name, type) => {
    const { words } = JSON.parse(readFileSync(`src/data/ocr/${name}.json`, "utf8")) as { words: OcrWord[] };
    expect(classifyDocument(wordsToLines(words)).type).toBe(type);
  });

  it("says unknown for text that is neither", () => {
    expect(classifyDocument(lines("Meeting notes\nDiscuss roadmap with the team\nNext steps: hire two engineers")).type).toBe("unknown");
  });
});

describe("Turkish statement, newest first", () => {
  const s = extractStatement(TR_STATEMENT);

  it("reads the header", () => {
    expect(s.bank.value).toBe("Örnek Bankası");
    expect(s.holder.value).toBe("DENIZ KAYA");
    expect(s.iban.value?.replace(/\s/g, "")).toBe("TR000001000000000000000001");
    expect(s.currency.value).toBe("TRY");
    expect([s.periodStart.value, s.periodEnd.value]).toEqual(["2026-09-26", "2026-10-26"]);
    expect(s.newestFirst).toBe(true);
  });

  it("reads every transaction and joins wrapped descriptions", () => {
    expect(s.transactions).toHaveLength(9);
    expect(s.transactions[0]).toMatchObject({ date: "2026-10-20", reference: "F24311", description: "MESSAGE FEE AMOUNT", amount: -0.37, balance: 0 });
    expect(s.transactions[4].description).toContain("RECONCILIATION: 0971963");
    expect(s.transactions[5].amount).toBe(358.62);
  });

  it("checks the running balance and the totals", () => {
    expect(validateStatement(s).map((c) => [c.label, c.status])).toEqual([
      ["Transactions found", "pass"],
      ["Running balance", "pass"],
      ["Debit and credit totals", "pass"],
      ["Opening + movements = closing", "skip"],
    ]);
    expect(statementTotals(s)).toMatchObject({ moneyIn: 721.01, moneyOut: -721.01, opening: 0, closing: 0 });
  });
});

describe("English statement, oldest first, separate debit and credit columns", () => {
  const s = extractStatement(
    lines(`
      Northshore Bank
      Statement of account
      Account holder: Juniper Health Co.
      Statement period 01/10/2026 to 31/10/2026
      Date Description Debit Credit Balance
      Opening balance 12,480.00
      02/10/2026 Payroll October 8,200.00 4,280.00
      05/10/2026 Client payment INV-2026-077 2,910.00 7,190.00
      12/10/2026 Office rent 2,150.00 5,040.00
      28/10/2026 Card fee 12.50 5,027.50
      Closing balance 5,027.50
    `),
  );

  it("works out the signs from the balance", () => {
    expect(s.newestFirst).toBe(false);
    expect(s.transactions.map((t) => t.amount)).toEqual([-8200, 2910, -2150, -12.5]);
  });

  it("matches opening + movements to the closing balance", () => {
    const checks = Object.fromEntries(validateStatement(s).map((c) => [c.label, c.status]));
    expect(checks["Running balance"]).toBe("pass");
    expect(checks["Opening + movements = closing"]).toBe("pass");
  });
});

describe("statement sample through real OCR", () => {
  const { words } = JSON.parse(readFileSync("src/data/ocr/northshore.json", "utf8")) as { words: OcrWord[] };
  const lines2 = wordsToLines(words);
  const s = extractStatement(lines2);

  it("is detected and read month first", () => {
    expect(classifyDocument(lines2).type).toBe("statement");
    expect(s.bank.value).toBe("Northshore Bank");
    expect(s.transactions).toHaveLength(12);
    expect(s.transactions[0]).toMatchObject({ date: "2026-10-01", amount: -84.17, balance: 9758.18 });
    expect([s.periodStart.value, s.periodEnd.value]).toEqual(["2026-10-01", "2026-10-31"]);
  });

  it("balances", () => {
    expect(validateStatement(s).filter((c) => c.status === "fail")).toEqual([]);
    expect(statementTotals(s)).toMatchObject({ moneyIn: 11420.5, moneyOut: -15197.52, opening: 9842.35, closing: 6065.33 });
  });
});
