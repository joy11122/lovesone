"use client";

import { useState } from "react";

export function PaymentReconcileAction({ transactionId }: { transactionId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reconcile() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/payments/${encodeURIComponent(transactionId)}/reconcile`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to reconcile payment.");
      setMessage(`Provider status: ${data.status}. Refresh to update the queue.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reconcile payment.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3">
    <button type="button" className="rounded-full border border-[#eadfd5] px-4 py-2 text-sm font-bold" disabled={busy} onClick={reconcile}>
      {busy ? "Checking provider…" : "Reconcile with SSLCommerz"}
    </button>
    {message && <p role="status" className="mt-2 text-xs text-[#777487]">{message}</p>}
  </div>;
}
