from datetime import datetime, timedelta
from bson import ObjectId

from . import forecast as fc


def _oid(bid):
    return ObjectId(bid)


def _pct(cur, prev):
    if not prev:
        return None
    return round((cur - prev) / abs(prev) * 100, 2)


def monthly_totals(db, business_id, start=None, end=None):
    match = {"businessId": _oid(business_id)}
    if start or end:
        match["date"] = {}
        if start:
            match["date"]["$gte"] = start
        if end:
            match["date"]["$lt"] = end
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m", "date": "$date"}},
                "inflow": {"$sum": {"$cond": [{"$eq": ["$direction", "credit"]}, "$amount", 0]}},
                "outflow": {"$sum": {"$cond": [{"$eq": ["$direction", "debit"]}, "$amount", 0]}},
                "creditCount": {"$sum": {"$cond": [{"$eq": ["$direction", "credit"]}, 1, 0]}},
                "debitCount": {"$sum": {"$cond": [{"$eq": ["$direction", "debit"]}, 1, 0]}},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    out = []
    for r in db.transactions.aggregate(pipeline):
        profit = r["inflow"] - r["outflow"]
        out.append(
            {
                "period": r["_id"],
                "revenue": round(r["inflow"], 2),
                "expenses": round(r["outflow"], 2),
                "profit": round(profit, 2),
                "margin": round(profit / r["inflow"] * 100, 2) if r["inflow"] else 0.0,
                "count": r["count"],
                "creditCount": r["creditCount"],
                "debitCount": r["debitCount"],
            }
        )
    return out


def _breakdown(db, business_id, direction, group_key, limit=None, start=None, end=None):
    match = {"businessId": _oid(business_id), "direction": direction}
    if start or end:
        match["date"] = {}
        if start:
            match["date"]["$gte"] = start
        if end:
            match["date"]["$lt"] = end
    pipeline = [
        {"$match": match},
        {"$group": {"_id": f"${group_key}", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    if limit:
        pipeline.append({"$limit": limit})
    rows = []
    for r in db.transactions.aggregate(pipeline):
        rows.append(
            {"key": r["_id"] or "unknown", "total": round(r["total"], 2), "count": r["count"]}
        )
    return rows


FIXED = {"rent", "salary", "software", "insurance", "tax", "utilities"}
FINANCE_TRANSFER = {"loan_payment", "bank_charges", "transfer"}


def _sum_by(rows):
    return sum(r["total"] for r in rows)


def _recurring_fixed_total(db, business_id, start=None, end=None):
    """Return scoped debit spend whose payee appears in every available month.

    Recurrence is detected from the complete transaction history even when the
    requested analytics document is filtered to one month. With only one month
    of history, only explicitly fixed subcategories are included because there
    is not enough evidence to establish recurrence.
    """
    history_months = monthly_totals(db, business_id)
    month_count = len(history_months)
    if month_count == 0:
        return 0.0

    scope_conditions = []
    if start:
        scope_conditions.append({"$gte": ["$date", start]})
    if end:
        scope_conditions.append({"$lt": ["$date", end]})
    in_scope = {"$and": scope_conditions} if scope_conditions else True

    pipeline = [
        {"$match": {"businessId": _oid(business_id), "direction": "debit"}},
        {
            "$project": {
                "date": 1,
                "amount": 1,
                "subcategory": {"$ifNull": ["$subcategory", "other_expense"]},
                "identity": {
                    "$toLower": {
                        "$trim": {
                            "input": {
                                "$ifNull": [
                                    "$merchant",
                                    {"$ifNull": ["$description", ""]},
                                ]
                            }
                        }
                    }
                },
            }
        },
        {"$match": {"identity": {"$ne": ""}}},
        {
            "$group": {
                "_id": {"subcategory": "$subcategory", "identity": "$identity"},
                "months": {"$addToSet": {"$dateToString": {"format": "%Y-%m", "date": "$date"}}},
                "scopedTotal": {"$sum": {"$cond": [in_scope, "$amount", 0]}},
            }
        },
    ]

    total = 0.0
    for row in db.transactions.aggregate(pipeline):
        subcategory = row["_id"]["subcategory"]
        if subcategory in FINANCE_TRANSFER:
            continue
        appears_every_month = len(row.get("months", [])) == month_count
        known_fixed_with_limited_history = month_count == 1 and subcategory in FIXED
        if (month_count >= 2 and appears_every_month) or known_fixed_with_limited_history:
            total += row.get("scopedTotal") or 0
    return round(total, 2)


def next_periods(last_period, horizon):
    y, m = map(int, last_period.split("-"))
    out = []
    for i in range(1, horizon + 1):
        m += 1
        if m > 12:
            m = 1
            y += 1
        out.append(f"{y}-{m:02d}")
    return out


def month_range(month):
    start = datetime.strptime(month + "-01", "%Y-%m-%d")
    if start.month == 12:
        end = datetime(start.year + 1, 1, 1)
    else:
        end = datetime(start.year, start.month + 1, 1)
    return start, end


def compute_analytics(db, business_id, business, month=None):
    start = end = None
    if month:
        start, end = month_range(month)
    months = monthly_totals(db, business_id, start, end)
    currency = (business or {}).get("currency", "INR")
    inputs = (business or {}).get("inputs") or {}

    result = {
        "businessId": business_id,
        "computedAt": datetime.utcnow().isoformat() + "Z",
        "currency": currency,
        "months": len(months),
        "needsData": {},
        "financial": {},
        "sales": {},
        "customer": {},
        "marketing": {},
        "operational": {},
        "growth": {},
        "trends": {},
        "forecast": {},
        "anomalies": [],
        "industry": {"type": (business or {}).get("businessType", "general")},
    }

    if not months:
        return result

    cur = months[-1]
    prev = months[-2] if len(months) > 1 else None
    oldest = months[0]

    rev_cat = _breakdown(db, business_id, "credit", "subcategory", start=start, end=end)
    rev_merchant = _breakdown(db, business_id, "credit", "merchant", limit=10, start=start, end=end)
    rev_payment = _breakdown(db, business_id, "credit", "paymentMethod", start=start, end=end)
    exp_cat = _breakdown(db, business_id, "debit", "subcategory", start=start, end=end)
    exp_merchant = _breakdown(db, business_id, "debit", "merchant", limit=10, start=start, end=end)

    # Financial
    total_revenue = sum(m["revenue"] for m in months)
    total_expenses = sum(m["expenses"] for m in months)
    avg_daily_revenue = round(cur["revenue"] / 30, 2)
    fixed = _recurring_fixed_total(db, business_id, start, end)
    operating_expenses = sum(r["total"] for r in exp_cat if r["key"] not in FINANCE_TRANSFER)
    variable = max(0.0, operating_expenses - fixed)

    operating_inflow = sum(
        m["revenue"] for m in months
    )  # operating cash flow = inflow/outflow excluding finance/transfer
    finance_out = sum(r["total"] for r in exp_cat if r["key"] in FINANCE_TRANSFER)

    burn = 0.0
    avg_net = sum(m["profit"] for m in months) / len(months)
    if avg_net < 0:
        burn = round(abs(avg_net), 2)
    cash_balance = inputs.get("cash_balance")
    runway = round(cash_balance / burn, 2) if burn and cash_balance is not None else None
    if burn and cash_balance is None:
        result["needsData"]["financial.cashflow.runway"] = "Enter cash balance"

    revenue_series = [m["revenue"] for m in months]
    expense_series = [m["expenses"] for m in months]
    profit_series = [m["profit"] for m in months]
    horizon = 3
    periods_fc = next_periods(cur["period"], horizon)

    result["financial"] = {
        "revenue": {
            "total": round(total_revenue, 2),
            "current": round(cur["revenue"], 2),
            "growthMom": _pct(cur["revenue"], prev["revenue"]) if prev else None,
            "avgDaily": avg_daily_revenue,
            "byCategory": rev_cat,
            "byMerchant": rev_merchant,
            "byPayment": rev_payment,
        },
        "profitability": {
            "netProfit": round(cur["profit"], 2),
            "netMargin": cur["margin"],
            "operatingProfit": round(cur["profit"] + finance_out, 2),
            "operatingMargin": round((cur["profit"] + finance_out) / cur["revenue"] * 100, 2)
            if cur["revenue"]
            else 0.0,
        },
        "expenses": {
            "total": round(total_expenses, 2),
            "current": round(cur["expenses"], 2),
            "growthMom": _pct(cur["expenses"], prev["expenses"]) if prev else None,
            "fixed": round(fixed, 2),
            "variable": round(variable, 2),
            "byCategory": exp_cat,
            "expenseRatio": round(cur["expenses"] / cur["revenue"] * 100, 2) if cur["revenue"] else None,
        },
        "cashflow": {
            "inflow": round(cur["revenue"], 2),
            "outflow": round(cur["expenses"], 2),
            "net": round(cur["profit"], 2),
            "operatingCashflow": round(cur["profit"] + finance_out, 2),
            "burnRate": burn,
            "runway": runway,
        },
        "health": _health_ratios(cur["profit"], total_revenue, inputs, result["needsData"]),
    }

    # Sales
    unit_count = sum(m["creditCount"] for m in months)
    result["sales"] = {
        "unitsSold": unit_count,
        "aov": round(total_revenue / unit_count, 2) if unit_count else 0.0,
        "growthMom": _pct(cur["revenue"], prev["revenue"]) if prev else None,
        "byCategory": rev_cat,
        "byMerchant": rev_merchant,
        "perEmployee": _needs_or_ratio(
            total_revenue, inputs.get("employee_count"), result["needsData"], "sales.perEmployee", "Enter employee count"
        ),
    }

    # Customer
    result["customer"] = {
        "distinctMerchants": _distinct_merchants(db, business_id, start, end),
        "repeatRateProxy": _repeat_proxy(db, business_id, start, end),
        "ltv": _needs_data(result["needsData"], "customer.ltv", "Enter avg customer value & churn"),
        "cac": _cac(inputs, total_revenue, result["needsData"]),
        "retention": _needs_data(result["needsData"], "customer.retention", "Enter repeat customers"),
        "churn": _needs_data(result["needsData"], "customer.churn", "Enter churned customers"),
    }

    # Marketing
    classified_marketing_spend = sum(r["total"] for r in exp_cat if r["key"] == "marketing")
    marketing_spend = inputs.get("marketing_spend", classified_marketing_spend)
    result["marketing"] = {
        "spend": round(marketing_spend, 2),
        "roas": round(total_revenue / marketing_spend, 2) if marketing_spend else None,
        "roi": _needs_data(result["needsData"], "marketing.roi", "Enter campaign revenue attribution"),
        "cpc": _needs_data(result["needsData"], "marketing.cpc", "Enter clicks"),
        "ctr": _needs_data(result["needsData"], "marketing.ctr", "Enter impressions"),
    }

    # Operational
    inventory_expense = sum(r["total"] for r in exp_cat if r["key"] == "inventory")
    result["operational"] = {
        "inventoryExpense": round(inventory_expense, 2),
        "inventoryTurnover": _inventory_turnover(inventory_expense, inputs, result["needsData"]),
    }

    # Growth
    result["growth"] = {
        "mom": _pct(cur["revenue"], prev["revenue"]) if prev else None,
        "yoy": _yoy(months),
        "cagr": _cagr(oldest["revenue"], cur["revenue"], len(months)),
        "byCategory": _category_growth(months, db, business_id),
    }

    # Trends
    result["trends"] = {
        "monthly": months,
        "seasonal": _seasonal(months),
    }

    # Forecast
    rev_fc = fc.forecast(revenue_series, horizon)
    exp_fc = fc.forecast(expense_series, horizon)
    prof_fc = fc.forecast(profit_series, horizon)
    result["forecast"] = {
        "revenue": _forecast_rows(periods_fc, rev_fc),
        "expenses": _forecast_rows(periods_fc, exp_fc),
        "profit": _forecast_rows(periods_fc, prof_fc),
    }

    # Anomalies
    anomalies = []
    for metric, series in [
        ("revenue", [{"period": m["period"], "value": m["revenue"], "metric": "revenue"} for m in months]),
        ("expenses", [{"period": m["period"], "value": m["expenses"], "metric": "expenses"} for m in months]),
        ("profit", [{"period": m["period"], "value": m["profit"], "metric": "profit"} for m in months]),
    ]:
        anomalies.extend(fc.detect_anomalies(series))
    result["anomalies"] = anomalies

    return result


def _health_ratios(profit, revenue, inputs, needs_data):
    cash = inputs.get("cash_balance")
    ar = inputs.get("accounts_receivable")
    ap = inputs.get("accounts_payable")
    inventory = inputs.get("inventory_value")
    debt = inputs.get("total_debt")
    equity = inputs.get("total_equity")
    assets = inputs.get("total_assets")

    out = {}

    if all(v is not None for v in (cash, ar, inventory, ap)):
        ca = cash + ar + inventory
        cl = ap
        out["currentRatio"] = round(ca / cl, 2) if cl else None
        out["quickRatio"] = round((cash + ar) / cl, 2) if cl else None
        out["workingCapital"] = round(ca - cl, 2)
    else:
        for k in ("currentRatio", "quickRatio", "workingCapital"):
            needs_data[f"financial.health.{k}"] = "Enter cash balance, receivables, payables and inventory"

    if debt is not None and equity is not None:
        out["debtToEquity"] = round(debt / equity, 2) if equity else None
    else:
        needs_data["financial.health.debtToEquity"] = "Enter total debt and equity"

    if assets is not None:
        out["returnOnAssets"] = round(profit / assets * 100, 2) if assets else None
    else:
        needs_data["financial.health.returnOnAssets"] = "Enter total assets"

    return out


def _needs_or_ratio(numerator, denominator, needs_data, key, note):
    if denominator:
        return round(numerator / denominator, 2)
    needs_data[key] = note
    return None


def _needs_data(needs_data, key, note):
    needs_data[key] = note
    return None


def _cac(inputs, revenue, needs_data):
    spend = inputs.get("marketing_spend")
    new_customers = inputs.get("monthly_new_customers")
    if spend is not None and new_customers:
        return round(spend / new_customers, 2)
    needs_data["customer.cac"] = "Enter monthly marketing spend & new customers"
    return None


def _inventory_turnover(inventory_expense, inputs, needs_data):
    inv = inputs.get("inventory_value")
    if inv:
        annual = inventory_expense * 12
        return round(annual / inv, 2)
    needs_data["operational.inventoryTurnover"] = "Enter current inventory value"
    return None


def _repeat_proxy(db, business_id, start=None, end=None):
    match = {"businessId": _oid(business_id), "direction": "credit"}
    if start or end:
        match["date"] = {}
        if start:
            match["date"]["$gte"] = start
        if end:
            match["date"]["$lt"] = end
    pipeline = [
        {"$match": match},
        {"$group": {"_id": "$merchant", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
    ]
    repeat = sum(1 for _ in db.transactions.aggregate(pipeline))
    return repeat


def _distinct_merchants(db, business_id, start=None, end=None):
    match = {"businessId": _oid(business_id), "direction": "credit"}
    if start or end:
        match["date"] = {}
        if start:
            match["date"]["$gte"] = start
        if end:
            match["date"]["$lt"] = end
    return len([merchant for merchant in db.transactions.distinct("merchant", match) if merchant])


def _yoy(months):
    if len(months) < 13:
        return None
    cur = months[-1]["revenue"]
    prev = months[-13]["revenue"]
    return _pct(cur, prev)


def _cagr(first, last, n_months):
    if first <= 0 or last <= 0 or n_months < 2:
        return None
    years = (n_months - 1) / 12
    return round(((last / first) ** (1 / years) - 1) * 100, 2)


def _category_growth(months, db, business_id):
    if len(months) < 2:
        return []
    cur_period = months[-1]["period"]
    prev_period = months[-2]["period"]
    cur = _breakdown_for_period(db, business_id, "credit", "subcategory", cur_period)
    prev_rows = _breakdown_for_period(db, business_id, "credit", "subcategory", prev_period)
    prev_map = {r["key"]: r["total"] for r in prev_rows}
    out = []
    for r in cur:
        before = prev_map.get(r["key"], 0)
        out.append(
            {"category": r["key"], "current": r["total"], "growth": _pct(r["total"], before)}
        )
    out.sort(key=lambda x: (x["growth"] is None, -(x["growth"] or 0)))
    return out


def _breakdown_for_period(db, business_id, direction, group_key, period):
    start = datetime.strptime(period + "-01", "%Y-%m-%d")
    if start.month == 12:
        end = datetime(start.year + 1, 1, 1)
    else:
        end = datetime(start.year, start.month + 1, 1)
    pipeline = [
        {"$match": {"businessId": _oid(business_id), "direction": direction, "date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": f"${group_key}", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]
    return [{"key": r["_id"] or "unknown", "total": round(r["total"], 2), "count": r["count"]} for r in db.transactions.aggregate(pipeline)]


def _seasonal(months):
    buckets = {}
    for m in months:
        month = int(m["period"].split("-")[1])
        buckets.setdefault(month, []).append(m["revenue"])
    return [
        {"month": k, "average": round(sum(v) / len(v), 2)} for k, v in sorted(buckets.items())
    ]


def _forecast_rows(periods, f):
    fc, lower, upper = f
    return [
        {"period": periods[i], "value": fc[i], "lower": lower[i], "upper": upper[i]}
        for i in range(len(fc))
    ]
