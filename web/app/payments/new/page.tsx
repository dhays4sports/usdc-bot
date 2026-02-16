"use client";

import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";
import { resolveNameToAddress } from "@/lib/nameResolve";

export default function NewPaymentIntent() {
  const [payeeInput, setPayeeInput] = useState("");
  const [payeeAddress, setPayeeAddress] = useState<`0x${string}` | null>(null);
  const [resolveMsg, setResolveMsg] = useState("Paste 0x, ENS, or Basename.");

  const [amount, setAmount] = useState("10");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const n = Number(amount);
    return !!payeeAddress && !!amount && !isNaN(n) && n > 0 && memo.length <= 180;
  }, [payeeAddress, amount, memo]);

  async function onResolve() {
    setErr(null);
    const v = payeeInput.trim();
    if (!v) {
      setPayeeAddress(null);
      setResolveMsg("Enter a wallet address or name.");
      return;
    }
    setResolveMsg("Resolving…");
    try {
      const r = await resolveNameToAddress(v);
      if (r.ok) {
        setPayeeAddress(r.address);
        setResolveMsg(`${r.label ? r.label + " → " : ""}${r.address.slice(0, 6)}…${r.address.slice(-4)}`);
      } else {
        setPayeeAddress(null);
        setResolveMsg(r.message);
      }
    } catch {
      setPayeeAddress(null);
      setResolveMsg("Could not resolve. Try a 0x address.");
    }
  }

  async function onCreate() {
    setErr(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payeeInput: payeeInput.trim(),
          payeeAddress,
          amount: amount.trim(),
          memo: memo.trim() || undefined,
          asset: "USDC",
          network: "base",
          context: { source: "payments.chat" },
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Failed to create payment intent");

      window.location.href = `/payments/p/${json.id}`;
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
            <div className="cardTitle">NEW PAYMENT INTENT</div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Payee</div>
                <input
                  value={payeeInput}
                  onChange={(e) => setPayeeInput(e.target.value)}
                  onBlur={onResolve}
                  placeholder="0x… or vitalik.eth or name.base"
                />
                <div style={{ fontSize: 12, opacity: 0.75 }}>{resolveMsg}</div>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Amount (USDC)</div>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Memo (optional)</div>
                <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Max 180 chars" />
              </label>

              {err ? <div style={{ fontSize: 12, opacity: 0.9 }}>Error: {err}</div> : null}

              <button onClick={onCreate} disabled={!canSubmit || submitting}>
                {submitting ? "Creating…" : "Create intent"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center" }}>
                <Link href="/payments">Back</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
