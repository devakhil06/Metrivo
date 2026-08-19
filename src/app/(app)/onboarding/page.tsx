"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    businessType: "retail",
    industry: "general",
    currency: "INR",
    country: "India",
    revenueModel: "product_sales",
    startDate: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/businesses")
      .then((r) => r.json())
      .then((d) => {
        if (d.business) {
          setForm((f) => ({ ...f, ...d.business, _id: undefined }));
        }
      });
  }, []);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Could not save business");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <p className="auth-kicker">Step 1 of 1 · Business context</p>
        <h1 className="mt-4 text-[clamp(32px,4vw,48px)]">Set up your business</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-500">
        This helps your analyst interpret your numbers correctly.
        </p>
      </div>
      <form onSubmit={submit} className="card space-y-5 p-7 sm:p-9">
        <div className="mb-2 flex items-center gap-3 border-b border-[var(--border)] pb-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">⌂</span>
          <div><h2>Tell Metrivo what you run</h2><p className="mt-1 text-xs text-neutral-500">You can update these details later.</p></div>
        </div>
        <div>
          <label className="label">Business name</label>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Business type</label>
            <select className="input" value={form.businessType} onChange={(e) => set("businessType", e.target.value)}>
              {["retail", "restaurant", "service", "ecommerce", "freelance", "wholesale", "manufacturing"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Industry</label>
            <input className="input" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Currency</label>
            <input className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
          </div>
          <div>
            <label className="label">Country</label>
            <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Business start date (optional)</label>
          <input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        {error && <p className="rounded-xl border border-[rgba(255,143,107,.2)] bg-[rgba(255,143,107,.07)] p-3 text-sm text-[#ffc6b4]">{error}</p>}
        <button className="btn-primary w-full sm:w-auto sm:min-w-40" disabled={loading}>
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
