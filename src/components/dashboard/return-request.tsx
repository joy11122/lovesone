"use client";

import { useState } from "react";

export function ReturnRequest({ orderId, status }: { orderId: string; status?: string | null }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (reason.trim().length < 5) { setMessage("Please enter a reason (at least 5 characters)."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/orders/${orderId}/return`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const data = await response.json();
      setMessage(response.ok ? "Return request submitted." : data.error || "Unable to submit request.");
    } catch { setMessage("Network error. Please try again."); }
    finally { setBusy(false); }
  }
  if (status) return <p className="mt-4 text-xs text-[#777487]">Return request: <span className="font-bold capitalize">{status}</span></p>;
  return <div className="mt-4 flex flex-wrap gap-2"><input aria-label="Return reason" value={reason} onChange={event=>setReason(event.target.value)} placeholder="Reason for return" className="min-w-0 flex-1 rounded-xl border border-[#f0e9e1] px-3 py-2 text-sm" /><button type="button" className="btn" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Request return"}</button>{message && <p role="status" className="w-full text-xs text-[#777487]">{message}</p>}</div>;
}
