"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";

const FIELDS: Array<{ key: string; label: string }> = [
  { key: "cash_balance", label: "Cash balance" },
  { key: "accounts_receivable", label: "Accounts receivable" },
  { key: "accounts_payable", label: "Accounts payable" },
  { key: "inventory_value", label: "Inventory value" },
  { key: "total_debt", label: "Total debt" },
  { key: "total_assets", label: "Total assets" },
  { key: "total_equity", label: "Total equity" },
  { key: "employee_count", label: "Employees" },
  { key: "customer_count", label: "Total customers" },
  { key: "monthly_new_customers", label: "New customers / month" },
  { key: "marketing_spend", label: "Monthly marketing spend" },
  { key: "units_sold", label: "Units sold / month" },
];

export default function BusinessDataForm({ onSaved }: { onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/businesses")
      .then((r) => r.json())
      .then((d) => {
        const inputs = d.business?.inputs || {};
        const init: Record<string, string> = {};
        for (const f of FIELDS) init[f.key] = inputs[f.key] != null ? String(inputs[f.key]) : "";
        setValues(init);
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    const res = await apiFetch("/api/businesses/inputs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      onSaved();
    }
  }

  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-medium">Enter business data (for ratios, LTV, CAC, etc.)</summary>
      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label">{f.label}</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              placeholder="—"
              value={values[f.key] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="col-span-2 flex items-end md:col-span-4">
          <button className="btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Save & recalculate"}
          </button>
          {saved && <span className="ml-3 text-sm text-neutral-500">Saved.</span>}
        </div>
      </form>
    </details>
  );
}
