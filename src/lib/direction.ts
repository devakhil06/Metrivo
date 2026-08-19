const INCOME_PATTERNS = [
  /\bsales?\b/,
  /\brevenue\b/,
  /\bincome\b/,
  /\breceived\b/,
  /\bdeposit\b/,
  /\brefund\b/,
  /\bcashback\b/,
  /\bpayout\b/,
  /\bcredited\b/,
  /\bcustomer\b/,
];

const EXPENSE_PATTERNS = [
  /\bsupplier\b/,
  /\bpayroll\b/,
  /\bsalary\b/,
  /\bwages?\b/,
  /\brent\b/,
  /\blease\b/,
  /\binternet\b/,
  /\bbroadband\b/,
  /\bpower\b/,
  /\belectric\b/,
  /\bwater\b/,
  /\bwaste\b/,
  /\butilit/,
  /\bmaintenance\b/,
  /\brepair\b/,
  /\bplumber\b/,
  /\belectrician\b/,
  /\bhvac\b/,
  /\bsupplies\b/,
  /\bmarketing\b/,
  /\badvertising\b/,
  /\bpermit\b/,
  /\bfee\b/,
  /\btax\b/,
  /\binsurance\b/,
  /\bsubscription\b/,
  /\bservice\b/,
  /\bcleaning\b/,
  /\bpest\b/,
  /\bcontractor\b/,
  /\bpurchase\b/,
  /\bpaid\b/,
  /\bpayment\b/,
  /\bbill\b/,
  /\bexpense\b/,
];

const DEBIT_TYPE = new Set(["debit", "dr", "withdrawal", "expense", "expenses", "payment", "paid", "out"]);
const CREDIT_TYPE = new Set(["credit", "cr", "deposit", "income", "revenue", "received", "in", "sales"]);

export interface DirectionInput {
  description?: string;
  type?: string;
  amount?: number;
  debit?: number;
  credit?: number;
}

export function inferDirection(input: DirectionInput): "credit" | "debit" | null {
  if (input.debit && input.debit > 0) return "debit";
  if (input.credit && input.credit > 0) return "credit";

  const type = (input.type || "").toLowerCase().trim();
  if (DEBIT_TYPE.has(type)) return "debit";
  if (CREDIT_TYPE.has(type)) return "credit";

  if (input.amount != null && input.amount < 0) return "debit";

  const text = (input.description || "").toLowerCase();
  if (EXPENSE_PATTERNS.some((re) => re.test(text))) return "debit";
  if (INCOME_PATTERNS.some((re) => re.test(text))) return "credit";

  return null;
}
