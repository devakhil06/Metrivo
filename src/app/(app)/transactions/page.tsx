"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import type { TransactionDto } from "@/lib/types";
import { apiFetch } from "@/lib/client-fetch";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function TransactionsPage() {
  const [rows, setRows] = useState<TransactionDto[]>([]);
  const [total, setTotal] = useState(0);
  const [direction, setDirection] = useState("");
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [reclassifying, setReclassifying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");
  const limit = 100;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    if (direction) params.set("direction", direction);
    if (search) params.set("search", search);
    apiFetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.transactions || []);
        setTotal(d.total || 0);
        setLoading(false);
      });
  }, [direction, search, skip, refreshKey]);

  async function deleteAll() {
    setDeleting(true);
    await apiFetch("/api/transactions", { method: "DELETE" });
    setDeleting(false);
    setConfirmDelete(false);
    setSkip(0);
    setRefreshKey((k) => k + 1);
  }

  async function reclassify() {
    setReclassifying(true);
    const res = await apiFetch("/api/transactions/reclassify", { method: "POST" });
    const d = await res.json();
    setReclassifying(false);
    setNotice(`Re-analyzed ${d.reclassified ?? 0} transaction(s).`);
    setSkip(0);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row">
        <div>
          <p className="auth-kicker mb-3">Your financial ledger</p>
          <h1 className="text-[clamp(32px,4vw,48px)]">Transactions</h1>
          <p className="mt-1 text-sm text-neutral-500">{total} records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={reclassify}
            disabled={reclassifying || total === 0}
            className="btn-secondary"
          >
            {reclassifying ? "Analyzing…" : "Re-analyze directions"}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deleting || total === 0}
            className="btn-danger"
          >
            {deleting ? "Deleting…" : "Delete all data"}
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          className="input max-w-xs"
          placeholder="Search by description…"
          value={search}
          onChange={(e) => {
            setSkip(0);
            setSearch(e.target.value);
          }}
        />
        <select
          className="input max-w-[10rem]"
          value={direction}
          onChange={(e) => {
            setSkip(0);
            setDirection(e.target.value);
          }}
        >
          <option value="">All</option>
          <option value="credit">Money in</option>
          <option value="debit">Money out</option>
        </select>
        {notice && <span className="status-success ml-auto">{notice}</span>}
      </div>

      <div className="table-shell overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Description</th>
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-10 text-center text-neutral-400">Loading transactions…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="py-10 text-center text-neutral-400">No transactions match these filters.</td></tr>
            ) : (
              rows.map((t) => (
                <tr key={t._id}>
                  <td className="py-2 pr-4">{new Date(t.date).toLocaleDateString("en-IN")}</td>
                  <td className="py-2 pr-4 text-neutral-600">{t.description}</td>
                  <td className="py-2 pr-4 text-neutral-600">
                    {t.category} <span className="text-neutral-400">· {t.subcategory}</span>
                  </td>
                  <td className={`py-2 text-right font-semibold tabular-nums ${t.direction === "debit" ? "text-red-600" : "text-emerald-600"}`}>
                    {t.direction === "debit" ? "-" : "+"}
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-[var(--border)] p-4">
          <button className="btn-secondary" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - limit))}>
            Previous
          </button>
          <button className="btn-secondary" disabled={skip + limit >= total} onClick={() => setSkip(skip + limit)}>
            Next
          </button>
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} title="Delete all transaction data?" description="This permanently removes every transaction in this business. This action cannot be undone." confirmLabel="Delete all data" busy={deleting} onCancel={() => setConfirmDelete(false)} onConfirm={deleteAll} />
    </div>
  );
}
