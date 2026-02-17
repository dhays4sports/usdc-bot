// web/app/invoice/new/page.tsx
"use client";

import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";
import { resolveNameToAddress } from "@/lib/nameResolve";

export default function NewInvoice() {
  const [payeeInput, setPayeeInput] = useState("");
  const [payeeAddress, setPayeeAddress] = useState<`0x${string}` | null>(null);
  const [payeeMsg, setPayeeMsg] = useState("Paste 0x, ENS, or Basename.");

  const [payerInput, setPayerInput] = useState("");
  const [payerAddress, setPayerAddress] = useState<`0x${string}` | null>(null);
  const [payerMsg, setPayerMsg] = useState("Optional. Paste 0x, ENS, or Basename.");

  const [amount, setAmount] = useState("10");
  const [memo, setMemo] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueAt, setDueAt] = useState(""); // ISO or yyyy-mm-dd

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const n = Number(amount);
    return !!payeeAddress && !!amount && !isNaN(n) && n > 0 && memo.length <= 180;
  }, [payeeAddress, amount, memo]);

  async function resolvePayee() {
    setErr(null);
    const v = payeeInput.trim();
    if (!v) {
      setPayeeAddress(null);
      setPayeeMsg("Enter a wallet address or name.");
      return;
    }
    setPayeeMsg("Resolving…");
    try {
      const r = await resolveNameToAddress(v);
      if (r.ok) {
        setPayeeAddress(r.address);
        setPayeeMsg(`${r.label ? r.label + " → " : ""}${r.address.slice(0, 6)}…${r.address.slice(-4)}`);
      } else {
        setPayeeAddress(null);
        setPayeeMsg(r.message);
      }
    } catch {
      setPayeeAddress(null);
      setPayeeMsg("Could not resolve. Try a 0x address.");
    }
  }

  async function resolvePayer() {
    setErr(null);
    const v = payerInput.trim();
    if (!v) {
      setPayerAddress(null);
      setPayerMsg("Optional. Paste 0x, ENS, or Basename.");
      return;
    }
    setPayerMsg("Resolving…");
    try {
      const r = await resolveNameToAddress(v);
      if (r.ok) {
        setPayerAddress(r.address);
        setPayerMsg(`${r.label ? r.label + " → " : ""}${r.address.slice(0, 6)}…${r.address.slice(-4)}`);
      } else {
        setPayerAddress(null);
        setPayerMsg(r.message);
      }
    } catch {
      setPayerAddress(null);
      setPayerMsg("Could not resolve. Try a 0x address.");
    }
  }

  async function onCreate() {
    setErr(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payeeInput: payeeInput.trim(),
          payeeAddress,
          payerInput: payerInput.trim() || undefined,
          payerAddress: payerAddress || undefined,
          amount: amount.trim(),
          memo: memo.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          dueAt: dueAt.trim() || undefined,
          context: { source: "invoice.chat" },
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Failed to create invoice");

      window.location.href = `/invoice/i/${json.id}`;
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">NEW INVOICE</div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Payee (who receives)</div>
                <input
                  value={payeeInput}
                  onChange={(e) => setPayeeInput(e.target.value)}
                  onBlur={resolvePayee}
                  placeholder="0x… or vitalik.eth or name.base"
                />
                <div style={{ fontSize: 12, opacity: 0.75 }}>{payeeMsg}</div>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Payer (optional)</div>
                <input
                  value={payerInput}
                  onChange={(e) => setPayerInput(e.target.value)}
                  onBlur={resolvePayer}
                  placeholder="0x… or vitalik.eth or name.base"
                />
                <div style={{ fontSize: 12, opacity: 0.75 }}>{payerMsg}</div>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Amount (USDC)</div>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Invoice # (optional)</div>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-1024" />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Due date (optional)</div>
                <input value={dueAt} onChange={(e) => setDueAt(e.target.value)} placeholder="2026-02-28 or ISO" />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Memo (optional)</div>
                <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Max 180 chars" />
              </label>

              {err ? <div style={{ fontSize: 12, opacity: 0.9 }}>Error: {err}</div> : null}

              <button onClick={onCreate} disabled={!canSubmit || submitting}>
                {submitting ? "Creating…" : "Create invoice"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center" }}>
                <Link href="/invoice">Back</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
