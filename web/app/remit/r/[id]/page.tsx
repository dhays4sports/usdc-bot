"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";
import StatusTimeline from "@/components/StatusTimeline";

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

  // usdc.bot receipt link (ID is not necessarily numeric)
  const mReceipt = input.match(/^https?:\/\/(www\.)?usdc\.bot\/e\/([^/?#]+)/i);
  if (mReceipt) {
    return { type: "usdc_bot_receipt", value: input };
  }

  // basescan tx url -> extract hash
  if (input.includes("basescan.org/tx/")) {
    const parts = input.split("/tx/");
    const hash = parts[1]?.split("?")[0]?.split("#")[0]?.trim();
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { type: "tx_hash", value: hash as `0x${string}` };
    }
  }

  // raw tx hash
  if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
    return { type: "tx_hash", value: input as `0x${string}` };
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
    rec?.status === "settled"
      ? "Settled on-chain"
      : rec?.status === "linked"
      ? "Settlement proof linked"
      : "Proposed (awaiting settlement proof)";

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
      setNotice({ type: "err", msg: "Paste a tx hash (0x…), a Basescan tx URL, or a usdc.bot /e/[id] link." });
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
                <Link href="/remit">
                  <button>Back to remit.bot</button>
                </Link>
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
            <StatusTimeline
  steps={[
    { key: "created", label: "Created", ts: rec?.createdAt, done: true },
    { key: "linked", label: "Linked (proof)", ts: rec?.updatedAt, done: rec?.status === "linked" || rec?.status === "settled" },
    { key: "settled", label: "Settled (optional)", ts: rec?.settledAt, done: rec?.status === "settled" },
  ]}
/>

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
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  opacity: 0.9,
                }}
              >
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
                    <a
                      className="underline"
                      href={`${BASESCAN}/tx/${rec.settlement.value}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {settlementLabel}
                    </a>
                  )
                ) : (
                  <span style={{ opacity: 0.75 }}>Not linked</span>
                )}{" "}
                <button
                  style={{ marginLeft: 10 }}
                  onClick={() => {
                    setShowEdit(true);
                    setNotice(null);
                  }}
                >
                  {rec.settlement ? "Replace proof" : "Link settlement"}
                </button>
              </span>
            </div>

            {showEdit ? (
              <>
                <div className="divider" />
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                    Paste tx hash, Basescan tx URL, or usdc.bot receipt
                  </div>

                  <input
                    value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    placeholder="0x… or https://basescan.org/tx/0x… or https://usdc.bot/e/…"
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
                      onClick={() => {
                        setShowEdit(false);
                        setProofInput("");
                        setNotice(null);
                      }}
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
              <Link href="/remit/new">
                <button>Create another</button>
              </Link>

              {!rec.settlement ? (
                <a
                  href={`https://usdc.bot/app?beneficiary=${rec.recipient.address}&amount=${encodeURIComponent(
                    rec.amount
                  )}&memo=${encodeURIComponent(rec.memo ?? "")}&ref=${rec.id}`}
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
