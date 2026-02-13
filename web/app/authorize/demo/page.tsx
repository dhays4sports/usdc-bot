"use client";

import { useMemo, useState } from "react";
import Header from "@/components/Header";

type Decision = {
  allow: boolean;
  reason: string;
  policyId: string;
  constraints?: Record<string, any>;
};

export default function AuthorizeDemo() {
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
  const [action, setAction] = useState("remit.create");
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const valid = useMemo(() => {
    return !!amount && !isNaN(Number(amount)) && Number(amount) > 0 && /^0x[a-fA-F0-9]{40}$/.test(recipient);
  }, [amount, recipient]);

  async function run() {
    setErr(null);
    setDecision(null);
    if (!valid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          amount: amount.trim(),
          asset: "USDC",
          recipient,
          context: { source: "authorize.demo" },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Authorize failed");
      setDecision(json);
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">AUTHORIZE DEMO</div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Action</div>
                <select value={action} onChange={(e) => setAction(e.target.value)}>
                  <option value="remit.create">remit.create</option>
                  <option value="escrow.create">escrow.create</option>
                  <option value="settlement.link">settlement.link</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Amount (USDC)</div>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Recipient (0x…)</div>
                <input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </label>

              {err ? <div style={{ fontSize: 12, opacity: 0.85 }}>Error: {err}</div> : null}

              <button disabled={!valid || loading} onClick={run} style={{ opacity: valid && !loading ? 1 : 0.55 }}>
                {loading ? "Checking…" : "Run authorize"}
              </button>

              {decision ? (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
                  <div><b>allow:</b> {String(decision.allow)}</div>
                  <div><b>policyId:</b> {decision.policyId}</div>
                  <div><b>reason:</b> {decision.reason}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
