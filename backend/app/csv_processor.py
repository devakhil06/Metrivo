import io
import re
from datetime import datetime

import pandas as pd

CHUNK_SIZE = 5000
MAX_TRANSACTIONS = 100_000

DATE_ALIASES = {"date", "transactiondate", "txndate", "valuedate", "postingdate", "day", "dt"}
DESC_ALIASES = {
    "description", "narration", "particulars", "details", "memo", "remarks",
    "transactiondetails", "name", "category", "item", "label", "transaction",
    "party", "payee", "vendor", "beneficiary", "merchant",
}
AMOUNT_ALIASES = {"amount", "total", "totalamount", "value", "price", "sum"}
DEBIT_ALIASES = {"debit", "withdrawal", "dr", "debitamount", "withdrawalamount", "moneyout", "paidout", "expense", "expenses"}
CREDIT_ALIASES = {"credit", "deposit", "cr", "creditamount", "depositamount", "moneyin", "paidin", "income", "revenue"}
TYPE_ALIASES = {"type", "txntype", "transactiontype", "direction", "flow", "incomeexpense", "mode", "debitcredit", "creditdebit", "drcr", "crdr"}
PAYMENT_ALIASES = {"paymentmethod", "paymentmode", "channel", "method", "paymode"}

INCOME_PATTERNS = [
    r"\bsales?\b", r"\brevenue\b", r"\bincome\b", r"\breceived\b", r"\bdeposit\b",
    r"\brefund\b", r"\bcashback\b", r"\bpayout\b", r"\bcredited\b", r"\bcustomer\b",
]
EXPENSE_PATTERNS = [
    r"\bsupplier\b", r"\bpayroll\b", r"\bsalary\b", r"\bwages?\b", r"\brent\b", r"\blease\b",
    r"\binternet\b", r"\bbroadband\b", r"\bpower\b", r"\belectric\b", r"\bwater\b", r"\bwaste\b",
    r"\butilit", r"\bmaintenance\b", r"\brepair\b", r"\bplumber\b", r"\belectrician\b", r"\bhvac\b",
    r"\bsupplies\b", r"\bmarketing\b", r"\badvertising\b", r"\bpermit\b", r"\bfee\b", r"\btax\b",
    r"\binsurance\b", r"\bsubscription\b", r"\bservice\b", r"\bcleaning\b", r"\bpest\b",
    r"\bcontractor\b", r"\bpurchase\b", r"\bpaid\b", r"\bpayment\b", r"\bbill\b", r"\bexpense\b",
]


def _norm(value) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def find_header_row(rows) -> int:
    best_idx, best_score = 0, 0
    for i, row in enumerate(rows):
        names = [_norm(c) for c in row]
        score = 0
        if any(n in DATE_ALIASES for n in names):
            score += 1
        if any(n in DESC_ALIASES for n in names):
            score += 1
        if any(n in AMOUNT_ALIASES | DEBIT_ALIASES | CREDIT_ALIASES for n in names):
            score += 1
        if score > best_score:
            best_idx, best_score = i, score
    return best_idx if best_score >= 2 else 0


def detect_roles(columns: list[str]) -> dict:
    roles = {}
    for i, name in enumerate(columns):
        n = _norm(name)
        if "date" not in roles and n in DATE_ALIASES:
            roles["date"] = i
        elif "debit" not in roles and n in DEBIT_ALIASES:
            roles["debit"] = i
        elif "credit" not in roles and n in CREDIT_ALIASES:
            roles["credit"] = i
        elif "amount" not in roles and n in AMOUNT_ALIASES:
            roles["amount"] = i
        elif "type" not in roles and (n in TYPE_ALIASES or ("debit" in n and "credit" in n)):
            roles["type"] = i
        elif "payment" not in roles and n in PAYMENT_ALIASES:
            roles["payment"] = i
        elif "description" not in roles and n in DESC_ALIASES:
            roles["description"] = i
    return roles


def parse_date(value) -> datetime | None:
    s = str(value or "").strip()
    if not s:
        return None
    if re.fullmatch(r"\d{4,5}", s):
        serial = int(s)
        try:
            return datetime(1899, 12, 30) + pd.Timedelta(days=serial)
        except Exception:
            pass
    iso = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if iso:
        try:
            return datetime(int(iso.group(1)), int(iso.group(2)), int(iso.group(3)))
        except ValueError:
            return None
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", s)
    if m:
        y = int(m.group(3))
        y = 2000 + y if y < 100 else y
        try:
            return datetime(y, int(m.group(2)), int(m.group(1)))
        except ValueError:
            return None
    try:
        parsed = pd.to_datetime(s, errors="raise")
        if not pd.isna(parsed):
            return parsed.to_pydatetime()
    except Exception:
        pass
    return None


def to_amount(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    s = str(value).replace(",", "").replace("₹", "").replace("$", "").strip()
    if not s or s.lower() in {"nan", "none", ""}:
        return 0.0
    neg = ("(" in s and ")" in s) or s.startswith("-")
    s = s.replace("(", "").replace(")", "").replace("-", "")
    try:
        return round(-float(s) if neg else float(s), 2)
    except ValueError:
        return 0.0


def infer_direction(description, type_val, amount, debit_val, credit_val) -> str:
    if debit_val and debit_val > 0:
        return "debit"
    if credit_val and credit_val > 0:
        return "credit"

    t = _norm(type_val)
    if t in {"debit", "dr", "withdrawal", "expense", "expenses", "payment", "paid", "out"}:
        return "debit"
    if t in {"credit", "cr", "deposit", "income", "revenue", "received", "in", "sales"}:
        return "credit"

    if amount is not None and amount < 0:
        return "debit"

    text = str(description or "").lower()
    for pat in EXPENSE_PATTERNS:
        if re.search(pat, text):
            return "debit"
    for pat in INCOME_PATTERNS:
        if re.search(pat, text):
            return "credit"

    return "credit"


def process_csv(buffer: bytes) -> dict:
    raw = io.BytesIO(buffer)

    sample = pd.read_csv(raw, nrows=30, header=None, dtype=str, keep_default_na=False)
    header_idx = find_header_row(sample.values.tolist())
    header = [str(c) for c in sample.values.tolist()[header_idx]]

    raw.seek(0)
    reader = pd.read_csv(raw, skiprows=header_idx, chunksize=CHUNK_SIZE, dtype=str, keep_default_na=False)

    roles: dict = {}
    transactions: list[dict] = []
    total_income = 0.0
    total_expenses = 0.0
    income_count = 0
    expense_count = 0
    unclassified = 0
    skipped = 0
    sample_rows: list[dict] = []

    for chunk in reader:
        if not roles:
            roles = detect_roles(list(chunk.columns))

        di = roles.get("date")
        de = roles.get("debit")
        cr = roles.get("credit")
        am = roles.get("amount")
        ty = roles.get("type")
        desc = roles.get("description")
        pay = roles.get("payment")

        for row in chunk.itertuples(index=False, name=None):
            date_val = row[di] if di is not None else ""
            desc_val = row[desc] if desc is not None else ""
            debit_val = to_amount(row[de]) if de is not None else 0.0
            credit_val = to_amount(row[cr]) if cr is not None else 0.0
            amount = to_amount(row[am]) if am is not None else (debit_val or credit_val)
            type_val = row[ty] if ty is not None else ""

            date = parse_date(date_val)
            if date is None:
                skipped += 1
                continue

            direction = infer_direction(desc_val, type_val, amount, debit_val, credit_val)
            if amount == 0:
                amount = debit_val or credit_val or abs(amount)
            amount = round(abs(amount), 2)
            if amount == 0:
                skipped += 1
                continue

            payment = str(row[pay]).strip() if pay is not None else ""

            tx = {
                "date": date.strftime("%Y-%m-%d"),
                "amount": amount,
                "direction": direction,
                "rawType": str(type_val).strip() or None,
                "description": str(desc_val).strip(),
                "paymentMethod": payment or None,
            }
            transactions.append(tx)
            if len(transactions) > MAX_TRANSACTIONS:
                raise ValueError(f"CSV exceeds the {MAX_TRANSACTIONS:,} transaction limit")

            if direction == "credit":
                total_income += amount
                income_count += 1
            else:
                total_expenses += amount
                expense_count += 1

            if len(sample_rows) < 5:
                sample_rows.append(tx)

    return {
        "structure": {
            "columns": header,
            "roles": {k: header[v] if v < len(header) else "" for k, v in roles.items()},
            "headerRow": header_idx,
            "sample": sample_rows,
        },
        "transactions": transactions,
        "summary": {
            "totalIncome": round(total_income, 2),
            "totalExpenses": round(total_expenses, 2),
            "incomeCount": income_count,
            "expenseCount": expense_count,
            "unclassified": unclassified,
            "skipped": skipped,
        },
    }
