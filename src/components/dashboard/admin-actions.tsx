"use client";

import { useState } from "react";

export function VendorApprovalAction({ vendorId }: { vendorId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function approve() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/vendors/${vendorId}/approve`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to approve vendor");
      setMessage("Vendor approved. Refresh to see updated status.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to approve vendor"); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-3"><button type="button" className="btn" disabled={busy} onClick={approve}>{busy ? "Please wait…" : "Approve vendor"}</button>{message && <span role="status" className="text-xs text-[#777487]">{message}</span>}</div>;
}

export function ReviewAction({ productId, medicine }: { productId: string; medicine: boolean }) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function decide(decision: "approve" | "reject") {
    if (decision === "approve" && medicine && reference.trim().length < 3) { setMessage("A valid compliance reference is required."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${productId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, ...(decision === "approve" && medicine ? { approvalReference: reference.trim() } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to review product");
      setMessage(`Product ${decision === "approve" ? "approved" : "rejected"}. Refresh to see updated status.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to review product"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">{medicine && <label className="block text-xs text-[#777487]">Compliance reference<input value={reference} onChange={event=>setReference(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#f0e9e1] px-3 py-2" placeholder="Verified approval reference" /></label>}<div className="flex flex-wrap items-center gap-2"><button type="button" className="btn" disabled={busy} onClick={()=>decide("approve")}>Approve product</button><button type="button" className="rounded-full border border-[#e8ddd2] px-4 py-3 text-sm font-bold" disabled={busy} onClick={()=>decide("reject")}>Reject</button>{message && <span role="status" className="text-xs text-[#777487]">{message}</span>}</div></div>;
}
