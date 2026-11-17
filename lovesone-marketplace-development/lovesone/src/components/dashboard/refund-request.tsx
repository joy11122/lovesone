"use client";

import { useState } from "react";

export function RefundRequest({ orderId, total, returnStatus }: { orderId: string; total: number; returnStatus?: string | null }) {
  const [amount, setAmount] = useState(String(total));
  const [method, setMethod] = useState<"bank_transfer" | "mobile_financial_service" | "cod_cash">("mobile_financial_service");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (returnStatus !== "approved") return null;

  async function submit() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > total) {
      setMessage("Enter an amount within the order total.");
      return;
    }
    if (reason.trim().length < 5) {
      setMessage("Please enter a refund reason (at least 5 characters).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ amount: parsedAmount, method, reason: reason.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit refund request.");
      setMessage("Refund request submitted for administrator review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit refund request.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 rounded-2xl border border-[#eadfd5] bg-[#fffaf5] p-4">
    <h3 className="font-bold">Request a refund</h3>
    <p className="mt-1 text-xs leading-5 text-[#777487]">Your return is approved. Refunds are reviewed by the marketplace team; this form does not initiate an automatic gateway payout.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold text-[#777487]">Amount (BDT)
        <input type="number" min="0.01" max={total} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#eadfd5] bg-white px-3 py-2 text-sm text-[#27232b]" />
      </label>
      <label className="text-xs font-semibold text-[#777487]">Payout method
        <select value={method} onChange={event => setMethod(event.target.value as typeof method)} className="mt-1 block w-full rounded-xl border border-[#eadfd5] bg-white px-3 py-2 text-sm text-[#27232b]">
          <option value="mobile_financial_service">Mobile financial service</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cod_cash">Cash (COD settlement)</option>
        </select>
      </label>
    </div>
    <label className="mt-3 block text-xs font-semibold text-[#777487]">Refund details
      <input value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Add details for the refund reviewer" className="mt-1 block w-full rounded-xl border border-[#eadfd5] bg-white px-3 py-2 text-sm text-[#27232b]" />
    </label>
    <button type="button" className="btn mt-3" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit refund request"}</button>
    {message && <p role="status" className="mt-2 text-xs text-[#777487]">{message}</p>}
  </div>;
}
