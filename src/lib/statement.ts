import { datesIn, isMonthFirst } from "./dates";
import { fold } from "./extract";
import { cents, detectDecimal, near, numbersIn } from "./numbers";
import type { Check, Field, OcrLine } from "./types";

/*
 * Bank statement reader. A transaction starts on a line that begins with a
 * date and ends with an amount (and usually the running balance); lines
 * without a leading date continue the previous description.
 */

export type Transaction = {
  date: string;
  reference: string | null;
  description: string;
  amount: number;
  balance: number | null;
  line: number;
};

export type Statement = {
  bank: Field<string>;
  holder: Field<string>;
  iban: Field<string>;
  currency: Field<string>;
  periodStart: Field<string>;
  periodEnd: Field<string>;
  opening: Field<number>;
  closing: Field<number>;
  totalDebit: Field<number>;
  totalCredit: Field<number>;
  transactions: Transaction[];
  /** Whether the statement lists the newest transaction first. */
  newestFirst: boolean;
};

const empty = <T,>(): Field<T> => ({ value: null, line: null, confidence: 0 });

const HEADER = /\b(date|tarih|datum|buchungstag|valuta)\b.*\b(amount|tutar|betrag|debit|credit|borc|alacak|soll|haben|balance|bakiye|saldo)\b/;
const OPENING = /\b(opening balance|previous balance|balance brought forward|devreden bakiye|onceki bakiye|acilis bakiyesi|anfangssaldo|alter saldo|saldo alt)\b/;
const CLOSING = /\b(closing balance|new balance|ending balance|balance carried forward|kapanis bakiyesi|son bakiye|donem sonu bakiye|endsaldo|neuer saldo|saldo neu)\b/;
const DEBIT_TOTAL = /^\s*(total debits?|debits?|toplam borc|borc toplami|borc|summe soll|soll)\b/;
const CREDIT_TOTAL = /^\s*(total credits?|credits?|toplam alacak|alacak toplami|alacak|summe haben|haben)\b/;
const BANK = /\b(bank|banka|bankasi|sparkasse|volksbank|credit union|building society)\b/;
const HOLDER = /\b(customer|account holder|account name|musteri|hesap sahibi|kontoinhaber|name)\b\s*[:：]?\s*(.+)$/;
const IBAN = /\b([A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?)\b/;
const PERIOD = /\b(period|donem|zeitraum|statement period)\b/;

const LEADING_DATE = /^\s*(?:\d{1,4}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\.?\s+\p{L}{3,}\.?,?\s+\d{4}|\p{L}{3,}\.?\s+\d{1,2},?\s*\d{4})(?=\s|$)/u;

/** "Original: Örnek Katılım Bankası Account Transactions" → "Örnek Katılım Bankası". */
function bankName(text: string): string {
  const m = text.match(/(?:\p{Lu}[\p{L}&.'-]*\s+){0,4}(?:Bank|Bankası|Bankasi|Banka|Sparkasse|Volksbank|Credit Union)(?!\p{L})(?:\s+A\.?Ş\.?)?/u);
  return (m?.[0] ?? text).replace(/\s+/g, " ").trim();
}

const conf = (line: OcrLine | undefined, rule: number) => cents(rule * ((line?.confidence ?? 100) / 100));

/** True when a line's money cell is written as a debit: "-12,50", "12,50-", "(12.50)" or "12.50 DR". */
const isDebitText = (t: string) => /(^|\s)[-−]\s?\d|\d[-−](\s|$)|\(\s?\d[\d.,]*\s?\)|\b(dr|debit|borc)\b/i.test(t);

function parseTransaction(text: string, decimal: "," | ".", line: number, us: boolean): Transaction | null {
  const dates = datesIn(text, us);
  if (!dates.length || dates[0].index > 3) return null;
  // Remove the leading dates (booking and value date) before reading the rest.
  let rest = text;
  for (let prev = ""; prev !== rest; ) {
    prev = rest;
    rest = rest.replace(LEADING_DATE, "");
  }
  rest = rest.trim();
  const tokens = rest.split(/\s+/);
  let cut = tokens.length;
  while (cut > 0 && /^[-−(]?[\d.,'’]+[-−)]?$|^(dr|cr|try|tl|eur|usd|gbp|€|\$|£|₺)$/i.test(tokens[cut - 1])) cut--;
  const tail = tokens.slice(cut).join(" ");
  const nums = numbersIn(tail.replace(/[()]/g, " "), decimal);
  if (!nums.length) return null;
  let head = tokens.slice(0, cut);
  let reference: string | null = null;
  if (head.length > 1 && /^[A-Z0-9-]{4,}$/i.test(head[0]) && /\d/.test(head[0]) && /[A-Z]/i.test(head[0])) {
    reference = head[0];
    head = head.slice(1);
  }
  const description = head.join(" ");
  if (!/\p{L}{2}/u.test(description)) return null;

  const tailTokens = tail.split(/\s+/);
  let amount: number;
  let balance: number | null = null;
  if (nums.length >= 2) {
    balance = nums.at(-1)!.value;
    amount = nums.at(-2)!.value;
    // Separate debit and credit columns: "12,50  -  1.000,00" reads as two numbers anyway.
    if (amount > 0 && isDebitText(tailTokens.slice(0, -1).join(" "))) amount = -amount;
  } else {
    amount = nums[0].value;
    if (amount > 0 && isDebitText(tail)) amount = -amount;
  }
  return { date: dates[0].iso, reference, description, amount, balance, line };
}

/** Lines that close the table: totals and summary rows. */
const isSummary = (f: string) => OPENING.test(f) || CLOSING.test(f) || DEBIT_TOTAL.test(f) || CREDIT_TOTAL.test(f) || /^\s*(total|toplam|summe)\b/.test(f);

function labelled(lines: OcrLine[], folded: string[], re: RegExp, decimal: "," | "."): Field<number> {
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(folded[i])) continue;
    const n = numbersIn(lines[i].text, decimal).at(-1);
    if (n) return { value: n.value, line: i, confidence: conf(lines[i], 0.9) };
  }
  return empty();
}

/** How many rows agree with the running balance if the list reads in the given direction. */
function chainMatches(tx: Transaction[], newestFirst: boolean): number {
  let ok = 0;
  for (let i = 1; i < tx.length; i++) {
    const [prev, cur] = newestFirst ? [tx[i], tx[i - 1]] : [tx[i - 1], tx[i]];
    if (prev.balance !== null && cur.balance !== null && near(cents(prev.balance + cur.amount), cur.balance, 0.011)) ok++;
  }
  return ok;
}

export function extractStatement(lines: OcrLine[]): Statement {
  const text = lines.map((l) => l.text).join("\n");
  const folded = lines.map((l) => fold(l.text));
  const decimal = detectDecimal(text);
  const us = isMonthFirst(text, /\$\s?\d|\bUSD\b/.test(text));

  const headerIdx = folded.findIndex((f) => HEADER.test(f));
  const transactions: Transaction[] = [];
  let ended = false;
  for (let i = headerIdx + 1; i < lines.length && !ended; i++) {
    if (isSummary(folded[i]) && transactions.length) {
      ended = true;
      break;
    }
    const tx = parseTransaction(lines[i].text, decimal, i, us);
    if (tx) transactions.push(tx);
    else if (transactions.length && !datesIn(lines[i].text).length && !numbersIn(lines[i].text, decimal).some((n) => n.money) && i - transactions.at(-1)!.line <= 3) {
      // A wrapped description line.
      transactions.at(-1)!.description += ` ${lines[i].text.trim()}`;
    }
  }

  const newestFirst = chainMatches(transactions, true) > chainMatches(transactions, false) || (transactions.length > 1 && transactions[0].date > transactions.at(-1)!.date);

  // When amounts are printed without a sign (separate debit/credit columns), the balance decides.
  const opening = labelled(lines, folded, OPENING, decimal);
  const chrono = newestFirst ? [...transactions].reverse() : transactions;
  for (let i = 0; i < chrono.length; i++) {
    const prevBalance = i === 0 ? opening.value : chrono[i - 1].balance;
    const cur = chrono[i];
    if (prevBalance === null || cur.balance === null) continue;
    const diff = cents(cur.balance - prevBalance);
    if (near(Math.abs(diff), Math.abs(cur.amount), 0.011)) cur.amount = diff;
  }

  const bankIdx = folded.slice(0, 12).findIndex((f) => BANK.test(f));
  let holder: Field<string> = empty();
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const m = folded[i].match(HOLDER);
    if (m && m.index !== undefined) {
      const raw = lines[i].text.slice(m.index + m[0].length - m[2].length).replace(/^[:\s]+/, "");
      const value = raw.split(/\s{2,}|\b(?:Branch|Şube|Sube|IBAN|Address|Adres)\b/i)[0].trim();
      if (value) {
        holder = { value, line: i, confidence: conf(lines[i], 0.85) };
        break;
      }
    } else if (/^\s*(account holder|customer|musteri|hesap sahibi|kontoinhaber)\s*:?\s*$/.test(folded[i]) && lines[i + 1] && /\p{L}{3}/u.test(lines[i + 1].text)) {
      holder = { value: lines[i + 1].text.trim(), line: i + 1, confidence: conf(lines[i + 1], 0.7) };
      break;
    }
  }
  const ibanIdx = lines.findIndex((l) => IBAN.test(l.text.replace(/\s+/g, " ")));
  const periodIdx = folded.findIndex((f, i) => PERIOD.test(f) && datesIn(lines[i].text).length >= 2);
  const periodDates = periodIdx === -1 ? [] : datesIn(lines[periodIdx].text, us);
  const txDates = transactions.map((t) => t.date).sort();

  const currencyMatch = text.match(/\b(TRY|TL|EUR|USD|GBP)\b|[€$£₺]/);
  const currencyCode = currencyMatch ? ({ TL: "TRY", "€": "EUR", $: "USD", "£": "GBP", "₺": "TRY" } as Record<string, string>)[currencyMatch[0]] ?? currencyMatch[0] : null;

  return {
    bank: bankIdx === -1 ? empty() : { value: bankName(lines[bankIdx].text), line: bankIdx, confidence: conf(lines[bankIdx], 0.75) },
    holder,
    iban: ibanIdx === -1 ? empty() : { value: lines[ibanIdx].text.replace(/\s+/g, " ").match(IBAN)![1], line: ibanIdx, confidence: conf(lines[ibanIdx], 0.95) },
    currency: currencyCode ? { value: currencyCode, line: null, confidence: 0.9 } : empty(),
    periodStart: periodDates[0] ? { value: periodDates[0].iso, line: periodIdx, confidence: 0.95 } : txDates[0] ? { value: txDates[0], line: null, confidence: 0.6, derived: true } : empty(),
    periodEnd: periodDates[1] ? { value: periodDates[1].iso, line: periodIdx, confidence: 0.95 } : txDates.at(-1) ? { value: txDates.at(-1)!, line: null, confidence: 0.6, derived: true } : empty(),
    opening,
    closing: labelled(lines, folded, CLOSING, decimal),
    totalDebit: labelled(lines, folded, DEBIT_TOTAL, decimal),
    totalCredit: labelled(lines, folded, CREDIT_TOTAL, decimal),
    transactions,
    newestFirst,
  };
}

const money = (n: number) => n.toFixed(2);

/** Chronological view of the transactions, oldest first. */
export const chronological = (s: Statement) => (s.newestFirst ? [...s.transactions].reverse() : s.transactions);

export function statementTotals(s: Statement) {
  const moneyIn = cents(s.transactions.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0));
  const moneyOut = cents(s.transactions.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0));
  const tx = chronological(s);
  const first = tx[0];
  const last = tx.at(-1);
  const opening = s.opening.value ?? (first?.balance != null ? cents(first.balance - first.amount) : null);
  const closing = s.closing.value ?? last?.balance ?? null;
  return { moneyIn, moneyOut, opening, closing };
}

export function validateStatement(s: Statement): Check[] {
  const checks: Check[] = [];
  const tx = chronological(s);
  checks.push({
    id: "required",
    status: tx.length ? "pass" : "fail",
    label: "Transactions found",
    detail: tx.length ? `${tx.length} transactions, ${tx[0].date} to ${tx.at(-1)!.date}` : "No dated rows with amounts were found",
  });

  const withBalance = tx.filter((t) => t.balance !== null);
  if (withBalance.length < 2) {
    checks.push({ id: "line-math", status: "skip", label: "Running balance", detail: "The statement has no balance column" });
  } else {
    const bad: string[] = [];
    for (let i = 1; i < tx.length; i++) {
      const [prev, cur] = [tx[i - 1], tx[i]];
      if (prev.balance === null || cur.balance === null) continue;
      const expected = cents(prev.balance + cur.amount);
      if (!near(expected, cur.balance, 0.011)) bad.push(`${cur.date} "${cur.description.slice(0, 32)}": expected ${money(expected)}, printed ${money(cur.balance)}`);
    }
    checks.push({
      id: "line-math",
      status: bad.length ? "fail" : "pass",
      label: "Running balance",
      detail: bad.length ? bad.slice(0, 3).join("; ") + (bad.length > 3 ? ` and ${bad.length - 3} more` : "") : `Every balance follows from the one before (${tx.length - 1} steps)`,
    });
  }

  const { moneyIn, moneyOut, opening, closing } = statementTotals(s);
  const parts: string[] = [];
  let failed = false;
  if (s.totalDebit.value !== null) {
    const ok = near(Math.abs(s.totalDebit.value), Math.abs(moneyOut), 0.02);
    failed ||= !ok;
    parts.push(`debits ${money(Math.abs(moneyOut))}${ok ? " = " : " ≠ "}printed ${money(Math.abs(s.totalDebit.value))}`);
  }
  if (s.totalCredit.value !== null) {
    const ok = near(Math.abs(s.totalCredit.value), moneyIn, 0.02);
    failed ||= !ok;
    parts.push(`credits ${money(moneyIn)}${ok ? " = " : " ≠ "}printed ${money(Math.abs(s.totalCredit.value))}`);
  }
  checks.push({
    id: "items-sum",
    status: parts.length ? (failed ? "fail" : "pass") : "skip",
    label: "Debit and credit totals",
    detail: parts.length ? parts.join("; ") : "No printed totals to compare",
  });

  if (opening !== null && closing !== null && (s.opening.value !== null || s.closing.value !== null)) {
    const expected = cents(opening + moneyIn + moneyOut);
    checks.push({
      id: "subtotal-vat-total",
      status: near(expected, closing, 0.02) ? "pass" : "fail",
      label: "Opening + movements = closing",
      detail: `${money(opening)} + ${money(moneyIn)} − ${money(Math.abs(moneyOut))} = ${money(expected)}${near(expected, closing, 0.02) ? "" : `, printed ${money(closing)}`}`,
    });
  } else {
    checks.push({ id: "subtotal-vat-total", status: "skip", label: "Opening + movements = closing", detail: "No printed opening or closing balance" });
  }
  return checks;
}
