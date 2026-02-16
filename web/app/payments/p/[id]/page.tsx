"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";

const BASESCAN = "https://basescan.org";

function short(addr?: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

type Settlement =
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: `0x${string}` };

function normalizeSettlement(inputRaw: string): Settlement | null {
  const input = inputRaw.trim();
  if (!input) return null;

  if (/^https?:\/\/(www\.)?usdc\.bot\/e\/[^/?#]+/i.test(input)) {
    return { type: "usdc_bot_receipt", value: input };
  }

  if (input.includes("basescan.org/tx/")) {
    const hash = input.split("/tx/")[1]?.split(/[?#]/)[0];
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { type: "tx_hash", value: hash as `0x${string}` };
    }
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
    return { type: "tx_hash", value: input as `0x${string}` };
  }

  return null;
}

export default function PaymentReceipt() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [proofInput, setProofInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${id}`, { cache: "no-store" });
      if (!res.ok) setRec(null);
      else setRec(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    refresh();
  }, [id]);

  const statusSentence =
    rec?.status === "linked"
      ? "Settlement proof linked"
      : "Proposed (awaiting payment)";

  const settlementLabel = useMemo(() => {
    if (!rec?.settlement) return null;
    return rec.settlement.type === "usdc_bot_receipt"
      ? "Escrow receipt (usdc.bot)"
      : "View transaction (Basescan)";
  }, [rec?.settlement]);

  async function saveProof() {
    if (!id) return;
    setNotice(null);

    const settlement = normalizeSettlement(proofInput);
    if (!settlement) {
      setNotice({ type: "err", msg: "Paste a tx hash, Basescan URL, or usdc.bot receipt link." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settlement }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ type: "err", msg: json?.error ?? "Could not save proof." });
        return;
      }

      setNotice({ type: "ok", msg: "Settlement proof saved." });
      setProofInput("");
      setShowEdit(false);
      await refresh();
    } catch {
      setNotice({ type: "err", msg: "Network error saving proof." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="container">
          <div className="centerStage">
            <div className="glassCard">
              <div className="cardTitle">PAYMENT</div>
              <p style={{ marginTop: 10, opacity: 0.8 }}>Loading…</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!rec) {
    return (
      <>
        <Header />
        <main className="container">
          <div className="centerStage">
            <div className="glassCard">
              <div className="cardTitle">PAYMENT</div>
              <p style={{ opacity: 0.8, marginTop: 10 }}>Not found.</p>
              <Link href="/payments"><button>Back</button></Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">PAYMENT INTENT</div>

            <p className="huge" style={{ marginTop: 6 }}>
              {rec.amount} <span style={{ fontSize: 18 }}>{rec.asset}</span>
            </p>

            <div className="divider" />

            <div className="subrow">
              <span>Status</span>
              <span style={{ fontWeight: 650 }}>{statusSentence}</span>
            </div>

            <div className="divider" />

            <div className="subrow">
              <span>Payee</span>
              <span style={{ fontFamily: "ui-monospace" }}>
                {short(rec.payee?.address)}
              </span>
            </div>

            {rec.memo ? (
              <>
                <div className="divider" />
                <div className="subrow">
                  <span>Memo</span>
                  <span>{rec.memo}</span>
                </div>
              </>
            ) : null}

            <div className="divider" />

            <div className="subrow">
              <span>Settlement</span>
              <span>
                {rec.settlement ? (
                  rec.settlement.type === "usdc_bot_receipt" ? (
                    <a className="underline" href={rec.settlement.value} target="_blank">View receipt</a>
                  ) : (
                    <a className="underline" href={`${BASESCAN}/tx/${rec.settlement.value}`} target="_blank">View tx</a>
                  )
                ) : (
                  <span style={{ opacity: 0.75 }}>Not linked</span>
                )}
                <button style={{ marginLeft: 10 }} onClick={() => setShowEdit(true)}>
                  {rec.settlement ? "Replace proof" : "Link settlement"}
                </button>
              </span>
            </div>

            {showEdit ? (
              <>
                <div className="divider" />
                <input
                  value={proofInput}
                  onChange={(e) => setProofInput(e.target.value)}
                  placeholder="0x… or https://basescan.org/tx/… or https://usdc.bot/e/…"
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={saveProof} disabled={saving}>
                    {saving ? "Saving…" : "Save proof"}
                  </button>
                  <button onClick={() => setShowEdit(false)}>Cancel</button>
                </div>
                {notice && <p>{notice.type === "err" ? "Error: " : "OK: "}{notice.msg}</p>}
              </>
            ) : null}

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              {!rec.settlement && (
                <a
                  href={`https://usdc.bot/app?beneficiary=${rec.payee.address}&amount=${encodeURIComponent(
                    rec.amount
                  )}&memo=${encodeURIComponent(rec.memo ?? "")}&ref=${rec.id}`}
                  target="_blank"
                >
                  <button>Pay via usdc.bot</button>
                </a>
              )}
              <Link href="/payments/new"><button>Create another</button></Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
