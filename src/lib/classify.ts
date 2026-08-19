export interface Classified {
  category: string;
  subcategory: string;
  confidence: number;
}

const EXPENSE_RULES: Array<[RegExp, string, string]> = [
  [/rent|lease|property|pg\b/i, "expenses", "rent"],
  [/salar|wage|payroll|stipend/i, "expenses", "salary"],
  [/electric|power|water|utility|broadband|internet|wifi|gas bill|recharge/i, "expenses", "utilities"],
  [/marketing|advert|ads\b|facebook|instagram|google ads|promotion|campaign/i, "expenses", "marketing"],
  [/inventory|stock|purchase|supplier|wholesale|vendor|raw material|goods/i, "expenses", "inventory"],
  [/logistic|transport|freight|shipping|courier|delivery|fuel|petrol|diesel/i, "expenses", "logistics"],
  [/software|saas|subscription|hosting|domain|aws|gcp|cloud|license/i, "expenses", "software"],
  [/loan|emi|interest|finance charge/i, "finance", "loan_payment"],
  [/bank charge|atm|fee|penalty|maintenance charge/i, "finance", "bank_charges"],
  [/transfer|self transfer|fund transfer|neft to|imps to|sweep/i, "transfer", "transfer"],
  [/tax|gst|tds|income tax/i, "expenses", "tax"],
  [/insurance|premium/i, "expenses", "insurance"],
];

const REVENUE_RULES: Array<[RegExp, string]> = [
  [/sale|sales|revenue|invoice|payment received|received from|payout|settlement|credit/i, "sales"],
  [/interest|refund|cashback|rewards|rebate/i, "other_revenue"],
];

function normalize(text: string): string {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractMerchant(description: string): string {
  const d = description || "";
  const m = d.match(/^(?:UPI|NEFT|IMPS|RTGS)\s*[/-]\s*([^/]+)/i);
  if (m) return m[1].trim();
  const p = d.match(/TXN\s+(?:TO|FROM)\s+(.+)/i);
  if (p) return p[1].trim();
  return d.slice(0, 40);
}

export function classifyTransaction(direction: "credit" | "debit", description: string): Classified {
  const text = normalize(description);

  if (direction === "credit") {
    for (const [re, sub] of REVENUE_RULES) {
      if (re.test(text)) return { category: "revenue", subcategory: sub, confidence: 0.9 };
    }
    return { category: "revenue", subcategory: "sales", confidence: 0.6 };
  }

  for (const [re, cat, sub] of EXPENSE_RULES) {
    if (re.test(text)) return { category: cat, subcategory: sub, confidence: 0.9 };
  }
  return { category: "expenses", subcategory: "other_expense", confidence: 0.5 };
}
