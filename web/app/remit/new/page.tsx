"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { resolveNameToAddress } from "@/lib/nameResolve";

// Settlement parsing: supports
// - usdc.bot receipt URL: https://usdc.bot/e/<id>
// - basescan tx URL: https://basescan.org/tx/<hash>
// - raw tx hash: 0x...
function parseSettlement(
  inputRaw: string
):
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "basescan_tx"; value: `0x${string}` }
  | undefined {
  const input = inputRaw.trim();
  if (!input) return undefined;

  // usdc.bot receipt link (IDs are NOT necessarily numeric)
  const mReceipt = input.match(/^https?:\/\/(www\.)?usdc\.bot\/e\/([^/?#]+)/i);
  if (mReceipt) {
    // store the full URL (easy + verifiable)
    return { type: "usdc_bot_receipt", value: input };
  }

  // basescan tx url -> extract hash
  if (input.includes("basescan.org/tx/")) {
    const parts = input.split("/tx/");
    const hash = parts[1]?.split("?")[0]?.split("#")[0]?.trim();
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { type: "basescan_tx", value: hash as `0x${string}` };
    }
  }

  // raw tx hash
  if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
    return { type: "basescan_tx", value: input as `0x${string}` };
  }

  return undefined;
}

export default function NewRemit() {
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientAddress, setRecipientAddress] = useState<`0x${string}` | null>(
    null
  );

  const [resolveMsg, setResolveMsg] = useState(
    "Paste 0x, ENS (vitalik.eth), or Basename (name.base)."
  );

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [amount, setAmount] = useState("10");
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");

  const [settlement, setSettlement] = useState(""); // optional proof
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const n = Number(amount);
    return !!recipientAddress && !!amount && !isNaN(n) && n > 0 && memo.length <= 180;
  }, [recipientAddress, amount, memo]);

  async function onResolve() {
    setErr(null);
    const v = recipientInput.trim();

    if (!v) {
      setRecipientAddress(null);
      setAvatarUrl(null);
      setResolveMsg("Enter a wallet address or name.");
      return;
    }

    setResolveMsg("Resolving…");
    try {
      const r = await resolveNameToAddress(v);

      if (r.ok) {
        // r.address should already be 0x…; cast keeps TS happy
        setRecipientAddress(r.address as `0x${string}`);

        // optional field; safe even if not present
        setAvatarUrl((r as any).avatarUrl ?? null);

        const label = r.label ? `${r.label} → ` : "";
        setResolveMsg(`${label}${r.address.slice(0, 6)}…${r.address.slice(-4)}`);
      } else {
        setRecipientAddress(null);
        setAvatarUrl(null);
        setResolveMsg(r.message);
      }
    } catch {
      setRecipientAddress(null);
      setAvatarUrl(null);
      setResolveMsg(`Could not resolve ${v}. Try a 0x address.`);
    }
  }

  async function onCreate() {
    setErr(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const settlementObj = parseSettlement(settlement);

      // ✅ IMPORTANT: remit creation should call /api/remit
      // ❌ Do NOT call /api/authorize here (that endpoint is for creating authorization records)
      const res = await fetch("/api/remit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientInput: recipientInput.trim(),
          recipientAddress, // already 0x typed
          amount: amount.trim(),
          memo: memo.trim(),
          reference: reference.trim() || undefined,
          settlement: settlementObj, // undefined OK
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Failed");

      window.location.href = `/r/${json.id}`;
    } catch (e: any) {
      setErr(e?.message || "Failed to create record");
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
            <div className="cardTitle">NEW REMITTANCE RECORD</div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Recipient</div>

                <input
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onBlur={onResolve}
                  placeholder="0x… or vitalik.eth or name.base"
                />

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      width={22}
                      height={22}
                      style={{ borderRadius: 999, opacity: 0.95 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }}
                    />
                  )}

                  <div style={{ fontSize: 12, opacity: 0.75 }}>{resolveMsg}</div>
                </div>

                {recipientAddress ? (
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    Using:{" "}
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {recipientAddress}
                    </span>
                  </div>
                ) : null}
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Amount (USDC)</div>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Memo (optional)</div>
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Purpose or note (max 180 chars)"
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Reference (optional)</div>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Invoice #, job ID, etc"
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Settlement proof (optional)</div>
                <input
                  value={settlement}
                  onChange={(e) => setSettlement(e.target.value)}
                  placeholder="Paste tx hash or usdc.bot receipt"
                />
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  If blank, status stays “Proposed” and you can link proof later.
                </div>
              </label>

              {err ? <div style={{ fontSize: 12, opacity: 0.85 }}>Error: {err}</div> : null}

              <button
                onClick={onCreate}
                disabled={!canSubmit || submitting}
                style={{
                  opacity: canSubmit && !submitting ? 1 : 0.55,
                  cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
                }}
              >
                {submitting ? "Creating…" : "Create record"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center" }}>
                <Link href="/remit">Back</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
