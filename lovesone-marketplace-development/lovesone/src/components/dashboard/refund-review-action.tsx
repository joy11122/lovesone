"use client";

import { useState } from "react";

export function RefundReviewAction({ refundId, status }: { refundId: string; status: string }) {
  const [payoutReference, setPayoutReference] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function update(nextStatus: "approved" | "rejected" | "processing" | "paid") {
    if (nextStatus === "paid" && payoutReference.trim().length < 3) {
      setMessage("Enter the verified bank/MFS/cash payout reference first.");
      return;
    }
    if (nextStatus === "rejected" && !window.confirm("Reject this refund and release its reserved amount?")) return;
    if (nextStatus === "paid" && !window.confirm("Confirm the external refund has actually been paid? This action is final.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/refunds/${refundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          ...(adminNote.trim() ? { adminNote: adminNote.trim() } : {}),
          ...(nextStatus === "paid" ? { payoutReference: payoutReference.trim() } : {})
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update refund.");
      setMessage(`Refund marked ${nextStatus}. Refresh to update the queue.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update refund.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-4 space-y-3">
    <label className="block text-xs font-semibold text-[#777487]">Admin note
      <input value={adminNote} onChange={event => setAdminNote(event.target.value)} maxLength={500} className="mt-1 block w-full rounded-xl border border-[#f0e9e1] px-3 py-2 text-sm" />
    </label>
    {(status === "approved" || status === "processing") && <label className="block text-xs font-semibold text-[#777487]">External payout reference (required to mark paid)
      <input value={payoutReference} onChange={event => setPayoutReference(event.target.value)} maxLength={120} className="mt-1 block w-full rounded-xl border border-[#f0e9e1] px-3 py-2 text-sm" />
    </label>}
    <div className="flex flex-wrap gap-2">
      {status === "requested" && <>
        <button type="button" className="btn" disabled={busy} onClick={() => update("approved")}>Approve</button>
        <button type="button" className="rounded-full border border-[#e8ddd2] px-4 py-3 text-sm font-bold" disabled={busy} onClick={() => update("rejected")}>Reject</button>
      </>}
      {status === "approved" && <button type="button" className="btn" disabled={busy} onClick={() => update("processing")}>Mark processing</button>}
      {(status === "approved" || status === "processing") && <button type="button" className="rounded-full border border-[#e8ddd2] px-4 py-3 text-sm font-bold" disabled={busy} onClick={() => update("paid")}>Confirm payout completed</button>}
    </div>
    {message && <p role="status" className="text-xs text-[#777487]">{message}</p>}
  </div>;
}
