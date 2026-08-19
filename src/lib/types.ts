export interface MonthPoint {
  period: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  netCashflow: number;
  count: number;
}

export interface Metric {
  value: number;
  change: number | null;
}

export interface Overview {
  period: string;
  previousPeriod: string | null;
  dataMonths: number;
  revenue: Metric;
  expenses: Metric;
  profit: Metric;
  margin: { value: number; change: number | null };
  cashflow: Metric;
}

export interface CategorySlice {
  category: string;
  subcategory: string;
  total: number;
  count: number;
}

export interface Evidence {
  label: string;
  value: string;
}

export interface RiskOrOpportunity {
  id: string;
  type: string;
  title: string;
  summary: string;
  severity: "high" | "medium" | "low";
  evidence: Evidence[];
}

export interface BusinessDto {
  _id: string;
  name: string;
  businessType: string;
  industry: string;
  currency: string;
  country: string;
  revenueModel: string;
  startDate?: string;
}

export interface TransactionDto {
  _id: string;
  date: string;
  amount: number;
  direction: "credit" | "debit";
  description: string;
  merchant?: string;
  category: string;
  subcategory: string;
  paymentMethod?: string;
  confidence: number;
}

export interface OverviewResponse {
  business: BusinessDto | null;
  overview: Overview | null;
  risks: RiskOrOpportunity[];
  opportunities: RiskOrOpportunity[];
  insightSource?: "nvidia" | "deterministic";
  total: number;
}

export interface UploadResult {
  file: { id: string; filename: string };
  quality: {
    processed: number;
    imported: number;
    duplicates: number;
    existingDuplicates?: number;
    repaired?: number;
    warnings: string[];
  };
  summary?: {
    totalIncome: number;
    totalExpenses: number;
    incomeCount: number;
    expenseCount: number;
    skipped: number;
  };
  preview: Array<{
    date: string;
    amount: number;
    direction: "credit" | "debit";
    description: string;
    category: string;
  }>;
}

export interface BreakdownSlice {
  key: string;
  total: number;
  count: number;
}

export interface ForecastPoint {
  period: string;
  value: number;
  lower: number;
  upper: number;
}

export interface Anomaly {
  metric: string;
  period: string;
  value: number;
  expected: number;
  zScore: number;
  severity: "high" | "medium";
}

export interface BusinessInputs {
  cash_balance?: number;
  accounts_receivable?: number;
  accounts_payable?: number;
  inventory_value?: number;
  total_debt?: number;
  total_assets?: number;
  total_equity?: number;
  employee_count?: number;
  customer_count?: number;
  monthly_new_customers?: number;
  marketing_spend?: number;
  units_sold?: number;
}

export interface AnalyticsDoc {
  businessId: string;
  computedAt: string;
  currency: string;
  months: number;
  needsData: Record<string, string>;
  financial: {
    revenue: {
      total: number;
      current: number;
      growthMom: number | null;
      avgDaily: number;
      byCategory: BreakdownSlice[];
      byMerchant: BreakdownSlice[];
      byPayment: BreakdownSlice[];
    };
    profitability: {
      netProfit: number;
      netMargin: number;
      operatingProfit: number;
      operatingMargin: number;
    };
    expenses: {
      total: number;
      current: number;
      growthMom: number | null;
      fixed: number;
      variable: number;
      byCategory: BreakdownSlice[];
      expenseRatio: number | null;
    };
    cashflow: { inflow: number; outflow: number; net: number; operatingCashflow: number; burnRate: number; runway: number | null };
    health: Record<string, number | null>;
  };
  sales: Record<string, number | null> & {
    unitsSold: number;
    aov: number;
    byCategory: BreakdownSlice[];
    byMerchant: BreakdownSlice[];
  };
  customer: Record<string, number | null>;
  marketing: Record<string, number | null>;
  operational: Record<string, number | null>;
  growth: { mom: number | null; yoy: number | null; cagr: number | null; byCategory: Array<{ category: string; current: number; growth: number | null }> };
  trends: { monthly: MonthPoint[]; seasonal: Array<{ month: number; average: number }> };
  forecast: { revenue: ForecastPoint[]; expenses: ForecastPoint[]; profit: ForecastPoint[] };
  anomalies: Anomaly[];
  industry: { type: string };
}
