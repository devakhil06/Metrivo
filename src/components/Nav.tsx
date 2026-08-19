"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client-fetch";
import BrandLogo from "@/components/BrandLogo";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/metrics", label: "Metrics", icon: "⌁" },
  { href: "/upload", label: "Upload", icon: "⇧" },
  { href: "/transactions", label: "Transactions", icon: "▤" },
  { href: "/chat", label: "Analyst", icon: "✦" },
];

interface Profile {
  name: string;
  email: string;
  business: { _id: string; name: string } | null;
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ name: "", email: "", business: null });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bizName, setBizName] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    const res = await apiFetch("/api/auth/me", { cache: "no-store" });
    const d = await res.json();
    if (d.user) {
      setProfile({ name: d.user.name, email: d.user.email, business: d.business || null });
      setBizName(d.business?.name || "");
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function saveName() {
    setSaving(true);
    await apiFetch("/api/businesses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bizName.trim() }),
    });
    setSaving(false);
    setEditing(false);
    await loadProfile();
    router.refresh();
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const renderLinks = (mobile: boolean) =>
    links.map((l) => (
      <Link
        key={l.href}
        href={l.href}
        className={`app-nav-link ${pathname.startsWith(l.href) ? "active" : ""} ${mobile ? "whitespace-nowrap" : ""}`}
      >
        <span aria-hidden="true">{l.icon}</span>{l.label}
      </Link>
    ));

  return (
    <header className="app-header">
      <div className="app-nav-shell mx-auto flex max-w-[1440px] items-center justify-between px-4 sm:px-5">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white">
            <BrandLogo size={34} priority />
            <span>Metrivo</span>
          </Link>
          <nav className="ml-3 hidden items-center gap-1 md:flex">{renderLinks(false)}</nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label="Open profile settings"
              className="profile-button"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-[#07100c]">
                {(profile.name || "?").charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[140px] truncate text-neutral-700 sm:inline">
                {profile.name || "Profile"}
              </span>
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                <div className="profile-menu absolute right-0 top-full z-50 mt-2 w-72 p-4">
                <div className="mb-3">
                  <div className="text-sm font-semibold">{profile.name}</div>
                  <div className="text-xs text-neutral-500">{profile.email}</div>
                </div>

                <div className="mb-3 border-t border-neutral-100 pt-3">
                  <div className="text-[10px] font-bold uppercase tracking-[.1em] text-neutral-500">Business</div>
                  {editing ? (
                    <div className="mt-1 flex gap-1">
                      <input
                        className="input flex-1"
                        value={bizName}
                        onChange={(e) => setBizName(e.target.value)}
                        autoFocus
                      />
                      <button className="btn-primary px-2 py-1 text-xs" onClick={saveName} disabled={saving || !bizName.trim()}>
                        Save
                      </button>
                      <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditing(false)}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{profile.business?.name || "No business yet"}</span>
                      <button className="text-xs text-[var(--primary)] hover:text-white" onClick={() => setEditing(true)}>
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            className="btn-secondary min-h-9 px-3 py-1.5 text-xs"
          >
            Log out
          </button>
        </div>
      </div>

      <nav className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-1 pb-2 pt-2 md:hidden">{renderLinks(true)}</nav>
    </header>
  );
}
