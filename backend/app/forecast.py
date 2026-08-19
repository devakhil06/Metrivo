import numpy as np


def _arr(values):
    return np.asarray([float(v) if v is not None else 0.0 for v in values], dtype=float)


def linear_forecast(values, horizon):
    s = _arr(values)
    n = len(s)
    if n == 0:
        return [0.0] * horizon
    if n == 1:
        return [float(s[0])] * horizon
    x = np.arange(n)
    coef = np.polyfit(x, s, 1)
    return [float(coef[0] * (n + i) + coef[1]) for i in range(horizon)]


def holt_forecast(values, horizon, alpha=0.5, beta=0.3):
    s = _arr(values)
    n = len(s)
    if n == 0:
        return [0.0] * horizon
    level = float(s[0])
    trend = float(s[1] - s[0]) if n > 1 else 0.0
    for v in s[1:]:
        prev = level
        level = alpha * v + (1 - alpha) * (level + trend)
        trend = beta * (level - prev) + (1 - beta) * trend
    return [float(level + trend * (i + 1)) for i in range(horizon)]


def holt_winters_forecast(values, horizon, seasonal=12, alpha=0.4, beta=0.2, gamma=0.2):
    s = _arr(values)
    n = len(s)
    if n < seasonal * 2:
        return holt_forecast(values, horizon)
    level = float(np.mean(s[:seasonal]))
    trend = float((np.mean(s[seasonal : 2 * seasonal]) - np.mean(s[:seasonal])) / seasonal)
    season = [s[i] - level for i in range(seasonal)]
    for i in range(n):
        prev = level
        si = season[i % seasonal]
        level = alpha * (s[i] - si) + (1 - alpha) * (level + trend)
        trend = beta * (level - prev) + (1 - beta) * trend
        season[i % seasonal] = gamma * (s[i] - level) + (1 - gamma) * season[i % seasonal]
    return [float(level + trend * h + season[(n + h - 1) % seasonal]) for h in range(1, horizon + 1)]


def forecast(values, horizon=3):
    """Return (forecast_values, lower_bounds, upper_bounds)."""
    s = _arr(values)
    n = len(s)
    if n == 0:
        return [], [], []
    if n >= 24:
        fc = holt_winters_forecast(s, horizon)
    elif n >= 4:
        fc = holt_forecast(s, horizon)
    else:
        fc = linear_forecast(s, horizon)

    residuals = np.abs(s[1:] - s[:-1]) if n > 1 else np.array([0.0])
    sigma = float(np.std(residuals))
    lower = [max(0.0, round(v - 1.96 * sigma, 2)) for v in fc]
    upper = [round(v + 1.96 * sigma, 2) for v in fc]
    return [round(v, 2) for v in fc], lower, upper


def detect_anomalies(series):
    """series: list of dicts with 'period' and a numeric 'value' key."""
    if len(series) < 4:
        return []
    values = np.asarray([float(s["value"]) for s in series], dtype=float)
    mean = float(values.mean())
    std = float(values.std())
    if std <= 0:
        return []
    anomalies = []
    for s, v in zip(series, values):
        z = (v - mean) / std
        if abs(z) > 2.5:
            anomalies.append(
                {
                    "metric": s.get("metric", "value"),
                    "period": s["period"],
                    "value": round(float(v), 2),
                    "expected": round(mean, 2),
                    "zScore": round(z, 2),
                    "severity": "high" if abs(z) > 3 else "medium",
                }
            )
    return anomalies
