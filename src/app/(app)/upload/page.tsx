"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { UploadResult } from "@/lib/types";
import { apiFetch } from "@/lib/client-fetch";
import ConfirmDialog from "@/components/ConfirmDialog";

interface FileDto {
  _id: string;
  filename: string;
  transactionCount: number;
  createdAt: string;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [files, setFiles] = useState<FileDto[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function loadFiles() {
    const res = await apiFetch("/api/files");
    const d = await res.json();
    setFiles(d.files || []);
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setNotice("");
    setResult(null);
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await apiFetch("/api/upload", { method: "POST", body: fd });
    setLoading(false);
    const data = await res.json();
    if (res.ok) {
      setResult(data);
      setFile(null);
      loadFiles();
    } else if (res.status === 409) {
      setNotice(data.error || "This file is redundant and was not imported.");
    } else {
      setError(data.error || "Upload failed");
    }
  }

  async function removeFile(id: string) {
    await apiFetch(`/api/files/${id}`, { method: "DELETE" });
    setPendingDelete(null);
    loadFiles();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
        <p className="auth-kicker mb-3">Data foundation</p>
        <h1 className="text-[clamp(32px,4vw,48px)]">Upload statement</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          XLSX, XLS or CSV. Columns for date, description and debit/credit or amount are auto-detected.
          Duplicate rows and already-imported data are removed automatically.
        </p>
        </div>
        <span className="status-success w-fit">Private processing</span>
      </div>

      <form onSubmit={submit} className="card space-y-5 p-7 sm:p-9">
        <label className="group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(155,255,118,.24)] bg-[rgba(155,255,118,.035)] p-8 text-center transition hover:bg-[rgba(155,255,118,.065)]">
          <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-[#07100c]">⇧</span>
          <strong className="text-base">{file ? file.name : "Choose a financial statement"}</strong>
          <span className="mt-2 text-xs text-neutral-500">CSV, XLS, or XLSX · processed securely in memory</span>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="sr-only" />
        </label>
        {error && <p className="text-sm text-neutral-600">{error}</p>}
        {notice && <p className="text-sm font-medium text-neutral-600">{notice}</p>}
        <button className="btn-primary w-full sm:w-auto" disabled={!file || loading}>
          {loading ? "Processing…" : "Upload & import"}
        </button>
      </form>

      {result && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <h2>Import complete</h2>
            <Link href="/dashboard" className="btn-primary">View dashboard</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div className="rounded-xl border border-neutral-200 bg-[rgba(255,255,255,.025)] p-4">
              <div className="text-2xl font-semibold">{result.quality.imported}</div>
              <div className="text-xs text-neutral-500">Imported</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-[rgba(255,255,255,.025)] p-4">
              <div className="text-2xl font-semibold">{result.quality.duplicates}</div>
              <div className="text-xs text-neutral-500">In-file dupes</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-[rgba(255,255,255,.025)] p-4">
              <div className="text-2xl font-semibold">{result.quality.existingDuplicates ?? 0}</div>
              <div className="text-xs text-neutral-500">Already imported</div>
            </div>
            <div className="rounded-xl border border-neutral-200 bg-[rgba(255,255,255,.025)] p-4">
              <div className="text-2xl font-semibold">{(result.quality.warnings || []).length}</div>
              <div className="text-xs text-neutral-500">Warnings</div>
            </div>
          </div>
          {(result.quality.warnings || []).length > 0 && (
            <ul className="list-inside list-disc text-sm text-neutral-600">
              {result.quality.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          {result.summary && (
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="rounded-md border border-neutral-200 p-3">
                <div className="text-xl font-semibold text-emerald-600 tabular-nums">{formatCurrency(result.summary.totalIncome)}</div>
                <div className="text-xs text-neutral-500">Income detected ({result.summary.incomeCount})</div>
              </div>
              <div className="rounded-md border border-neutral-200 p-3">
                <div className="text-xl font-semibold text-red-600 tabular-nums">{formatCurrency(result.summary.totalExpenses)}</div>
                <div className="text-xs text-neutral-500">Expenses detected ({result.summary.expenseCount})</div>
              </div>
            </div>
          )}
          {result.preview?.length > 0 && (
            <div className="table-shell overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-500">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Description</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((t, i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td className="py-2 pr-4">{new Date(t.date).toLocaleDateString("en-IN")}</td>
                      <td className="py-2 pr-4 text-neutral-600">{t.description}</td>
                      <td className="py-2 pr-4 text-neutral-600">{t.category}</td>
                      <td className={`py-2 text-right font-semibold tabular-nums ${t.direction === "debit" ? "text-red-600" : "text-emerald-600"}`}>
                        {t.direction === "debit" ? "-" : "+"}
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="mb-3">Recent uploads</h2>
        {files.length === 0 ? (
          <p className="text-sm text-neutral-400">No uploads yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {files.map((f) => (
              <li key={f._id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{f.filename}</span>
                  <span className="ml-2 text-neutral-500">{f.transactionCount} transactions</span>
                </div>
                <button
                  onClick={() => setPendingDelete(f._id)}
                  className="btn-danger min-h-8 px-2.5 py-1 text-xs"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog open={pendingDelete !== null} title="Delete this upload?" description="The uploaded file record and every transaction imported from it will be permanently removed." confirmLabel="Delete upload" onCancel={() => setPendingDelete(null)} onConfirm={() => pendingDelete && removeFile(pendingDelete)} />
    </div>
  );
}
