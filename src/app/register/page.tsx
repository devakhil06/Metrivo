"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import BrandLogo from "@/components/BrandLogo";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/onboarding");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Registration failed");
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" aria-label="Metrivo home" className="flex w-fit items-center gap-3 text-xl font-bold tracking-[-.04em]">
          <BrandLogo size={42} priority /><span>Metrivo</span>
        </Link>
        <div className="relative z-10 max-w-lg">
          <p className="auth-kicker">Start with clarity</p>
          <h1 className="mt-6 text-[clamp(44px,5vw,72px)] leading-[.98]">Turn transactions<br /><span className="text-[#7f9285]">into your next move.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#8fa195]">Create your secure workspace, add a business, and let Metrivo assemble the financial picture.</p>
        </div>
        <p className="relative z-10 text-xs text-[#617469]">Clear in minutes · No finance degree required</p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="auth-kicker">Your Metrivo account</p>
          <h1 className="mt-4">Create account</h1>
          <p className="mb-7 mt-2 text-sm text-[#82958a]">Build a financial picture grounded in your own data.</p>
          <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={15} autoComplete="new-password" />
            <p className="mt-1.5 text-xs text-[#64776b]">Use at least 15 characters. Passphrases work well.</p>
          </div>
          {error && <p className="rounded-xl border border-[rgba(255,143,107,.2)] bg-[rgba(255,143,107,.07)] p-3 text-sm text-[#ffc6b4]">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
          </form>
          <p className="mt-5 text-center text-sm text-[#7f9287]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--primary)] hover:text-white">
            Sign in
          </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
