"use client";

import { useEffect } from "react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(1,7,4,.78)] p-5 backdrop-blur-md" onMouseDown={onCancel}>
      <section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[#0b1a12] p-7 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[rgba(255,143,107,.1)] text-lg text-[var(--danger)]">!</span>
        <h2 id="confirm-title" className="mt-5 text-2xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[#879a8e]">{description}</p>
        <div className="mt-7 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
