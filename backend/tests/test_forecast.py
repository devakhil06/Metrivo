import unittest

from app.forecast import detect_anomalies, linear_forecast


class ForecastTests(unittest.TestCase):
    def test_linear_forecast_starts_at_next_period(self):
        values = linear_forecast([10, 20, 30], 2)
        self.assertAlmostEqual(values[0], 40.0)
        self.assertAlmostEqual(values[1], 50.0)

    def test_anomaly_threshold_ignores_small_series(self):
        series = [
            {"period": "2026-01", "value": 100},
            {"period": "2026-02", "value": 100},
            {"period": "2026-03", "value": 100},
        ]
        self.assertEqual(detect_anomalies(series), [])


if __name__ == "__main__":
    unittest.main()
