"use client";

import { useState } from "react";

export function ReturnReview({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function decide(status: "approved" | "rejected") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/return`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to review request");
      setMessage(`Request ${status}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to review request"); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" className="btn" disabled={busy} onClick={()=>decide("approved")}>Approve</button><button type="button" className="rounded-full border border-[#e8ddd2] px-4 py-3 text-sm font-bold" disabled={busy} onClick={()=>decide("rejected")}>Reject</button>{message && <span role="status" className="text-xs text-[#777487]">{message}</span>}</div>;
}
