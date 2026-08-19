"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import BrandLogo from "@/components/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" aria-label="Metrivo home" className="flex w-fit items-center gap-3 text-xl font-bold tracking-[-.04em]">
          <BrandLogo size={42} priority /><span>Metrivo</span>
        </Link>
        <div className="relative z-10 max-w-lg">
          <p className="auth-kicker">Welcome back</p>
          <h1 className="mt-6 text-[clamp(44px,5vw,72px)] leading-[.98]">Your business story<br /><span className="text-[#7f9285]">is ready to continue.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-[#8fa195]">Return to the numbers, evidence, and next decisions that keep your business moving forward.</p>
        </div>
        <p className="relative z-10 text-xs text-[#617469]">Private by design · Protected sessions · Evidence-grounded AI</p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="auth-kicker">Secure access</p>
          <h1 className="mt-4">Log in to Metrivo</h1>
          <p className="mb-7 mt-2 text-sm text-[#82958a]">Continue to your financial command center.</p>
          <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="rounded-xl border border-[rgba(255,143,107,.2)] bg-[rgba(255,143,107,.07)] p-3 text-sm text-[#ffc6b4]">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          </form>
          <p className="mt-5 text-center text-sm text-[#7f9287]">
          No account?{" "}
          <Link href="/register" className="font-semibold text-[var(--primary)] hover:text-white">
            Create one
          </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
