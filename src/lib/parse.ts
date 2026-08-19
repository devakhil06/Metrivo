import * as XLSX from "xlsx";
import { cleanText, cleanAmount, isNoiseRow } from "./preprocess";
import { inferDirection } from "./direction";

const MAX_SHEET_ROWS = 100_000;

export interface RawTransaction {
  date: Date;
  amount: number;
  direction: "credit" | "debit";
  rawType?: string;
  description: string;
  merchant?: string;
  paymentMethod?: string;
}

export interface ParseResult {
  transactions: RawTransaction[];
  warnings: string[];
}

const DATE_ALIASES = [
  "date",
  "transaction date",
  "transactiondate",
  "txn date",
  "txndate",
  "value date",
  "valuedate",
  "posting date",
  "postingdate",
  "day",
  "dt",
];
const DESC_ALIASES = [
  "description",
  "narration",
  "particulars",
  "details",
  "memo",
  "remarks",
  "transaction details",
  "transactiondetails",
  "name",
  "item",
  "label",
  "transaction",
  "transactiondescription",
  "category",
];
const AMOUNT_ALIASES = [
  "amount",
  "total amount",
  "totalamount",
  "value",
  "price",
  "sum",
  "transaction amount",
  "transactionamount",
];
const DEBIT_ALIASES = [
  "debit",
  "withdrawal",
  "dr",
  "debit amount",
  "debitamount",
  "withdrawal amount",
  "withdrawalamount",
  "paid out",
  "paidout",
  "money out",
  "moneyout",
];
const CREDIT_ALIASES = [
  "credit",
  "deposit",
  "cr",
  "credit amount",
  "creditamount",
  "deposit amount",
  "depositamount",
  "paid in",
  "paidin",
  "money in",
  "moneyin",
];
const MERCHANT_ALIASES = ["merchant", "payee", "party", "vendor", "beneficiary", "counterparty"];
const TYPE_ALIASES = [
  "type",
  "txn type",
  "txntype",
  "transaction type",
  "transactiontype",
  "direction",
  "flow",
  "income expense",
  "incomeexpense",
  "debit/credit",
  "debitcredit",
  "credit/debit",
  "creditdebit",
  "dr/cr",
  "drcr",
];
const METHOD_ALIASES = [
  "mode",
  "payment mode",
  "paymentmode",
  "payment method",
  "paymentmethod",
  "channel",
];

function norm(v: unknown): string {
  return String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && v > 20000 && v < 60000) {
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (dmy) {
      const y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
      return utcDate(y, Number(dmy[2]), Number(dmy[1]));
    }
    const direct = new Date(s);
    if (!isNaN(direct.getTime())) return direct;
  }
  return null;
}

function parseAmount(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[₹,\s]/g, "");
    const neg = cleaned.includes("(") && cleaned.includes(")");
    const num = parseFloat(cleaned.replace(/[()]/g, ""));
    if (isNaN(num)) return 0;
    return neg ? -num : num;
  }
  return 0;
}

interface Columns {
  date: number;
  description: number;
  amount: number;
  debit: number;
  credit: number;
  merchant: number;
  type: number;
  method: number;
}

function detectHeader(rows: unknown[][]): { header: string[]; dataStart: number } {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    const names = row.map(norm);
    const has = (aliases: string[]) => names.some((n) => aliases.includes(n));
    const score =
      (has(DATE_ALIASES) ? 1 : 0) +
      (has(DESC_ALIASES) ? 1 : 0) +
      (has(AMOUNT_ALIASES) || has(DEBIT_ALIASES) || has(CREDIT_ALIASES) ? 1 : 0);
    if (score >= 2) return { header: names, dataStart: i + 1 };
  }
  return { header: rows[0]?.map(String) ?? [], dataStart: 1 };
}

function mapColumns(header: string[]): Columns {
  const find = (aliases: string[]) => header.findIndex((h) => aliases.includes(h));
  const date = find(DATE_ALIASES);
  const debit = find(DEBIT_ALIASES);
  const credit = find(CREDIT_ALIASES);
  return {
    date,
    description: find(DESC_ALIASES),
    amount: find(AMOUNT_ALIASES),
    debit,
    credit,
    merchant: find(MERCHANT_ALIASES),
    type: find(TYPE_ALIASES),
    method: find(METHOD_ALIASES),
  };
}

export function parseSpreadsheet(buffer: Buffer, filename: string): ParseResult {
  const isCsv = /\.csv$/i.test(filename);
  const workbook = XLSX.read(isCsv ? buffer.toString("utf8") : buffer, {
    type: isCsv ? "string" : "buffer",
    cellDates: true,
    sheetRows: MAX_SHEET_ROWS + 2,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { transactions: [], warnings: ["No sheet found"] };

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
  if (rows.length > MAX_SHEET_ROWS + 1) {
    return { transactions: [], warnings: [`Spreadsheet exceeds the ${MAX_SHEET_ROWS.toLocaleString("en-IN")} row limit`] };
  }
  const { header, dataStart } = detectHeader(rows);
  const cols = mapColumns(header);

  if (cols.date === -1) {
    return { transactions: [], warnings: ["Could not detect a date column"] };
  }

  const transactions: RawTransaction[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => String(c).trim() === "")) continue;

    const date = parseDate(row[cols.date]);
    const description = cleanText(row[cols.description] ?? row[cols.merchant] ?? "");
    const type = norm(row[cols.type] ?? "");

    const debitVal = cols.debit >= 0 ? parseAmount(row[cols.debit]) : 0;
    const creditVal = cols.credit >= 0 ? parseAmount(row[cols.credit]) : 0;
    const rawAmount = cols.amount >= 0 ? parseAmount(row[cols.amount]) : 0;
    const signedSignal = cols.debit < 0 && cols.credit < 0 ? rawAmount : 0;

    const direction =
      inferDirection({ description, type, amount: signedSignal, debit: debitVal, credit: creditVal }) ??
      "credit";

    let amount = 0;
    if (debitVal > 0) amount = debitVal;
    else if (creditVal > 0) amount = creditVal;
    else amount = Math.abs(rawAmount);

    amount = cleanAmount(amount);

    if (!date || amount === 0) {
      skipped++;
      continue;
    }

    if (isNoiseRow(description)) {
      skipped++;
      continue;
    }

    transactions.push({
      date,
      amount,
      direction,
      rawType: type || undefined,
      description,
      merchant: cleanText(row[cols.merchant] ?? ""),
      paymentMethod: cleanText(row[cols.method] ?? ""),
    });
  }

  if (skipped > 0) warnings.push(`${skipped} row(s) skipped (missing date or amount)`);
  if (transactions.length === 0) warnings.push("No valid transactions found");

  return { transactions, warnings };
}
