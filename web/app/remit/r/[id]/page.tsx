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

function normalizeSettlement(inputRaw: string) {
  const input = inputRaw.trim();

  // usdc.bot receipt link
  if (/^https?:\/\/(www\.)?usdc\.bot\/e\/\d+/.test(input)) {
    return { type: "usdc_bot_receipt", value: input };
  }

  // tx hash
  if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
    return { type: "basescan_tx", value: input };
  }

  return null;
}

export default function RemitReceipt() {
  const params = useParams();
  const id = (params?.id as string | undefined) ?? undefined;

  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // mini-flow state
  const [showEdit, setShowEdit] = useState(false);
  const [proofInput, setProofInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/remit/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setRec(null);
      } else {
        setRec(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const statusSentence =
    rec?.status === "settled" ? "Settled on-chain" :
    rec?.status === "linked" ? "Settlement proof linked" :
    "Proposed (awaiting settlement proof)";

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
      setNotice({ type: "err", msg: "Paste a tx hash (0x…) or a usdc.bot /e/[id] link." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/remit/${id}`, {
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
    } catch (e: any) {
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
              <div className="cardTitle">RECEIPT</div>
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
              <div className="cardTitle">RECEIPT</div>
              <p style={{ opacity: 0.8, marginTop: 10 }}>Not found.</p>
              <div style={{ marginTop: 12 }}>
                <Link href="/remit"><button>Back to remit.bot</button></Link>
              </div>
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
            <div className="cardTitle">REMITTANCE RECEIPT</div>

            <p className="huge" style={{ marginTop: 6 }}>
              {rec.amount}{" "}
              <span style={{ fontSize: 18, opacity: 0.9 }}>{rec.asset}</span>
            </p>

            <div className="divider" />

            <div className="subrow">
              <span>Status</span>
              <span style={{ fontWeight: 650 }}>{statusSentence}</span>
            </div>

            <div className="divider" />

            <div className="subrow">
              <span>Network</span>
              <span>Base Mainnet</span>
            </div>

            <div className="divider" />

            <div className="subrow">
              <span>Recipient</span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.9 }}>
                {short(rec.recipient?.address)}
              </span>
            </div>

            {rec.memo ? (
              <>
                <div className="divider" />
                <div className="subrow" style={{ alignItems: "flex-start" }}>
                  <span>Memo</span>
                  <span style={{ opacity: 0.9, textAlign: "right" }}>{rec.memo}</span>
                </div>
              </>
            ) : null}

            <div className="divider" />

            <div className="subrow" style={{ alignItems: "flex-start" }}>
              <span>Settlement</span>
              <span style={{ textAlign: "right" }}>
                {rec.settlement ? (
                  rec.settlement.type === "usdc_bot_receipt" ? (
                    <a className="underline" href={rec.settlement.value} target="_blank" rel="noreferrer">
                      {settlementLabel}
                    </a>
                  ) : (
                    <a className="underline" href={`${BASESCAN}/tx/${rec.settlement.value}`} target="_blank" rel="noreferrer">
                      {settlementLabel}
                    </a>
                  )
                ) : (
                  <span style={{ opacity: 0.75 }}>Not linked</span>
                )}
                {" "}
                {rec.settlement ? (
                  <button
                    style={{ marginLeft: 10 }}
                    onClick={() => { setShowEdit(true); setNotice(null); }}
                  >
                    Replace proof
                  </button>
                ) : (
                  <button
                    style={{ marginLeft: 10 }}
                    onClick={() => { setShowEdit(true); setNotice(null); }}
                  >
                    Link settlement
                  </button>
                )}
              </span>
            </div>

            {showEdit ? (
              <>
                <div className="divider" />
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                    Paste tx hash or usdc.bot receipt
                  </div>
                  <input
                    value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    placeholder="0x… or https://usdc.bot/e/123"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.06)",
                      color: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={saveProof} disabled={saving}>
                      {saving ? "Saving…" : "Save proof"}
                    </button>
                    <button
                      onClick={() => { setShowEdit(false); setProofInput(""); setNotice(null); }}
                    >
                      Cancel
                    </button>
                  </div>
                  {notice ? (
                    <p style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                      {notice.type === "err" ? "Error: " : "OK: "}
                      {notice.msg}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <Link href="/remit/new"><button>Create another</button></Link>

              {!rec.settlement ? (
                <a
                  href={`https://usdc.bot/app?beneficiary=${rec.recipient.address}&amount=${encodeURIComponent(rec.amount)}&memo=${encodeURIComponent(rec.memo ?? "")}&ref=${rec.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <button>Secure via usdc.bot</button>
                </a>
              ) : null}
            </div>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
              Funds are never held by remit.bot. Settlement occurs directly on-chain.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
