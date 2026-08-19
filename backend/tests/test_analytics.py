import unittest
from unittest.mock import patch

from app.analytics import _recurring_fixed_total


class _Transactions:
    def __init__(self, rows):
        self.rows = rows

    def aggregate(self, _pipeline):
        return self.rows


class _Database:
    def __init__(self, rows):
        self.transactions = _Transactions(rows)


class RecurringFixedExpenseTests(unittest.TestCase):
    def test_only_costs_present_in_every_month_are_fixed(self):
        rows = [
            {
                "_id": {"subcategory": "utilities", "identity": "city power"},
                "months": ["2026-01", "2026-02", "2026-03"],
                "average": 100,
                "deviation": 3,
                "scopedTotal": 300,
            },
            {
                "_id": {"subcategory": "inventory", "identity": "stable supplier"},
                "months": ["2026-01", "2026-02", "2026-03", "2026-04"],
                "average": 100,
                "deviation": 10,
                "scopedTotal": 400,
            },
            {
                "_id": {"subcategory": "loan_payment", "identity": "bank emi"},
                "months": ["2026-01", "2026-02", "2026-03", "2026-04"],
                "average": 100,
                "deviation": 0,
                "scopedTotal": 400,
            },
        ]
        months = [{"period": f"2026-0{month}"} for month in range(1, 5)]
        with patch("app.analytics.monthly_totals", return_value=months):
            total = _recurring_fixed_total(_Database(rows), "0123456789abcdef01234567")
        self.assertEqual(total, 400)

    def test_known_fixed_cost_missing_a_month_is_not_fixed(self):
        rows = [
            {
                "_id": {"subcategory": "rent", "identity": "landlord"},
                "months": ["2026-01", "2026-02"],
                "average": 200,
                "deviation": 0,
                "scopedTotal": 400,
            }
        ]
        months = [{"period": f"2026-0{month}"} for month in range(1, 4)]
        with patch("app.analytics.monthly_totals", return_value=months):
            total = _recurring_fixed_total(_Database(rows), "0123456789abcdef01234567")
        self.assertEqual(total, 0)

    def test_one_month_does_not_make_inventory_fixed(self):
        rows = [
            {
                "_id": {"subcategory": "inventory", "identity": "supplier"},
                "months": ["2026-01"],
                "average": 500,
                "deviation": 0,
                "scopedTotal": 500,
            },
            {
                "_id": {"subcategory": "rent", "identity": "landlord"},
                "months": ["2026-01"],
                "average": 200,
                "deviation": 0,
                "scopedTotal": 200,
            },
        ]
        with patch("app.analytics.monthly_totals", return_value=[{"period": "2026-01"}]):
            total = _recurring_fixed_total(_Database(rows), "0123456789abcdef01234567")
        self.assertEqual(total, 200)


if __name__ == "__main__":
    unittest.main()
