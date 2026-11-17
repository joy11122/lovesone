"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SettlementCreateAction({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function createLedger() {
    if (!window.confirm("Create and lock the vendor settlement ledger for this delivered, paid order? New refund requests will be blocked once the ledger is created.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/settlements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create settlement ledger.");
      setMessage(`${data.settlements?.length || 0} vendor settlement(s) ready.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create settlement ledger.");
    } finally { setBusy(false); }
  }
  return <div className="mt-3">
    <button type="button" disabled={busy} onClick={createLedger} className="rounded-full border border-[#eadfd5] px-4 py-2 text-sm font-bold disabled:opacity-60">{busy ? "Preparing…" : "Create vendor settlement"}</button>
    {message && <p role="status" className="mt-2 text-xs text-[#777487]">{message}</p>}
  </div>;
}
