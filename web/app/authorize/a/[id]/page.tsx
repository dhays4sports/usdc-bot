"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import StatusTimeline from "@/components/StatusTimeline";
import Link from "next/link";

const BASESCAN = "https://basescan.org";

function short(addr?: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function normalizeProof(inputRaw: string) {
  const input = inputRaw.trim();
  if (!input) return null;

  if (/^https?:\/\/(www\.)?usdc\.bot\/e\/\d+/.test(input)) {
    return { type: "usdc_bot_receipt", value: input };
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
    return { type: "basescan_tx", value: input };
  }

  if (input.includes("basescan.org/tx/")) {
    const parts = input.split("/tx/");
    const hash = parts[1]?.split("?")[0]?.trim();
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) return { type: "basescan_tx", value: hash };
  }

  return null;
}

export default function AuthorizeReceipt() {
  const params = useParams();
  const id = (params?.id as string | undefined) ?? undefined;

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
      const res = await fetch(`/api/authorize/${id}`, { cache: "no-store" });
      if (!res.ok) setRec(null);
      else setRec(await res.json());
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
    rec?.status === "revoked" ? "Revoked" :
    rec?.status === "linked" ? "Proof linked" :
    "Proposed (awaiting proof)";

  const proofLabel = useMemo(() => {
    if (!rec?.proof) return null;
    return rec.proof.type === "usdc_bot_receipt" ? "Receipt (usdc.bot)" : "View tx (Basescan)";
  }, [rec?.proof]);

  async function saveProof() {
    if (!id) return;
    setNotice(null);

    const proof = normalizeProof(proofInput);
    if (!proof) return setNotice({ type: "err", msg: "Paste tx hash or a usdc.bot receipt URL." });

    setSaving(true);
    try {
      const res = await fetch(`/api/authorize/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proof }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setNotice({ type: "err", msg: json?.error ?? "Could not save proof." });

      setNotice({ type: "ok", msg: "Proof saved." });
      setProofInput("");
      setShowEdit(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    if (!id) return;
    setNotice(null);

    setSaving(true);
    try {
      const res = await fetch(`/api/authorize/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setNotice({ type: "err", msg: json?.error ?? "Could not revoke." });

      setNotice({ type: "ok", msg: "Authorization revoked." });
      await refresh();
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
              <div className="cardTitle">AUTHORIZATION</div>
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
              <div className="cardTitle">AUTHORIZATION</div>
              <p style={{ opacity: 0.8, marginTop: 10 }}>Not found.</p>
              <div style={{ marginTop: 12 }}>
                <Link href="/authorize"><button>Back</button></Link>
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
            <StatusTimeline
  steps={[
    { key: "created", label: "Created", ts: rec?.createdAt, done: true },
    { key: "linked", label: "Linked (proof)", ts: rec?.updatedAt, done: rec?.status === "linked" || rec?.status === "revoked" },
    { key: "revoked", label: "Revoked", ts: rec?.updatedAt, done: rec?.status === "revoked" },
  ]}
/>
            <div className="cardTitle">AUTHORIZATION RECEIPT</div>

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
              <span>Spender</span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.9 }}>
                {short(rec.spender?.address)}
              </span>
            </div>

            <div className="divider" />

            <div className="subrow" style={{ alignItems: "flex-start" }}>
              <span>Scope</span>
              <span style={{ textAlign: "right", opacity: 0.9 }}>{rec.scope}</span>
            </div>

            {rec.limit ? (
              <>
                <div className="divider" />
                <div className="subrow">
                  <span>Limit</span>
                  <span style={{ opacity: 0.9 }}>{rec.limit}</span>
                </div>
              </>
            ) : null}

            {rec.expiresAt ? (
              <>
                <div className="divider" />
                <div className="subrow">
                  <span>Expires</span>
                  <span style={{ opacity: 0.9 }}>{rec.expiresAt}</span>
                </div>
              </>
            ) : null}

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
              <span>Proof</span>
              <span style={{ textAlign: "right" }}>
                {rec.proof ? (
                  rec.proof.type === "usdc_bot_receipt" ? (
                    <a className="underline" href={rec.proof.value} target="_blank" rel="noreferrer">{proofLabel}</a>
                  ) : (
                    <a className="underline" href={`${BASESCAN}/tx/${rec.proof.value}`} target="_blank" rel="noreferrer">{proofLabel}</a>
                  )
                ) : (
                  <span style={{ opacity: 0.75 }}>Not linked</span>
                )}
                {" "}
                <button style={{ marginLeft: 10 }} onClick={() => { setShowEdit(true); setNotice(null); }}>
                  {rec.proof ? "Replace proof" : "Link proof"}
                </button>
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
                    <button onClick={saveProof} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                    <button onClick={() => { setShowEdit(false); setProofInput(""); setNotice(null); }}>Cancel</button>
                    <button onClick={revoke} disabled={saving} style={{ opacity: 0.9 }}>Revoke</button>
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
              <Link href="/authorize/new"><button>Create another</button></Link>

              {/* Simple future hook: open usdc.bot with prefill */}
              <a
                href={`https://usdc.bot/app?beneficiary=${rec.spender.address}&amount=1.00&memo=${encodeURIComponent(rec.scope)}&ref=${rec.id}`}
                target="_blank"
                rel="noreferrer"
              >
                <button>Open in usdc.bot</button>
              </a>
            </div>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
              authorize.bot records intent + proof. It does not execute approvals or custody funds.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
