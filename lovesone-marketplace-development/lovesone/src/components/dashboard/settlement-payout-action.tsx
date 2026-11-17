"use client";

import { useState } from "react";

export function SettlementPayoutAction({ settlementId, status }: { settlementId: string; status: string }) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function confirmPayout() {
    if (reference.trim().length < 3) { setMessage("Enter the verified bank/MFS payout reference."); return; }
    if (!window.confirm("Confirm that this vendor has actually received the payout?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/settlements/${settlementId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", payoutReference: reference.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to record payout.");
      setMessage("Payout recorded. Refresh to update the ledger.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record payout.");
    } finally { setBusy(false); }
  }
  if (status === "paid") return <p className="mt-3 text-sm font-bold text-green-700">Paid</p>;
  return <div className="mt-3 flex flex-wrap items-end gap-2">
    <label className="min-w-0 flex-1 text-xs font-semibold text-[#777487]">External payout reference
      <input value={reference} onChange={event => setReference(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-xl border border-[#f0e9e1] px-3 py-2 text-sm" />
    </label>
    <button type="button" disabled={busy} onClick={confirmPayout} className="btn">{busy ? "Saving…" : "Confirm payout"}</button>
    {message && <p role="status" className="w-full text-xs text-[#777487]">{message}</p>}
  </div>;
}
