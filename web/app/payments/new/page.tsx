"use client";

import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";
import { resolveNameToAddress } from "@/lib/nameResolve";

type PreviewResponse = {
  payeeInput: string;
  payeeAddress: `0x${string}` | null;
  amount: string; // keep as string to match your form + API
  memo?: string;
  asset: "USDC";
  network: "base";
  confidence: number; // 0..1
  warnings: string[];
};

export default function NewPaymentIntent() {
  // ✅ Command → Preview
  const [command, setCommand] = useState("send $50 usdc to device.eth");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commandErr, setCommandErr] = useState<string | null>(null);

  // Existing manual fields
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

  function applyPreview(p: PreviewResponse) {
    // Populate your existing fields (this is the whole point of the UX)
    setPayeeInput(p.payeeInput ?? "");
    setPayeeAddress(p.payeeAddress ?? null);
    setAmount(String(p.amount ?? ""));
    setMemo(String(p.memo ?? ""));

    // Update resolveMsg to reflect the resolved address
    if (p.payeeAddress) {
      const label = p.payeeInput ? `${p.payeeInput} → ` : "";
      setResolveMsg(`${label}${p.payeeAddress.slice(0, 6)}…${p.payeeAddress.slice(-4)}`);
    } else {
      setResolveMsg("Could not resolve payee address.");
    }
  }

  async function onPreviewCommand() {
    setCommandErr(null);
    setErr(null);

    const prompt = command.trim();
    if (!prompt) {
      setCommandErr('Type something like: "send $50 usdc to device.eth"');
      return;
    }

    setPreviewing(true);
    try {
      // ✅ Parse-only endpoint: does NOT write to KV
      const res = await fetch("/api/payments/nl/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(json?.error || "Failed to preview command");

      const p = json as PreviewResponse;

      // Basic guardrails
      if (!p?.payeeAddress) {
        setPreview(p);
        setCommandErr("Preview failed: could not resolve recipient. Fix the command and try again.");
        return;
      }

      setPreview(p);
      applyPreview(p);
    } catch (e: any) {
      setPreview(null);
      setCommandErr(e?.message || "Failed to preview");
    } finally {
      setPreviewing(false);
    }
  }

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
        setResolveMsg(
          `${r.label ? r.label + " → " : ""}${r.address.slice(0, 6)}…${r.address.slice(-4)}`
        );
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
          context: {
            source: "payments.chat",
            // optional: keep an audit trail of how the form was populated
            fromCommand: preview ? command.trim() : undefined,
            previewConfidence: preview?.confidence,
            previewWarnings: preview?.warnings,
          },
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Failed to create payment intent");

      window.location.href = `/p/${json.id}`;
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
              {/* ✅ Command → Preview */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Command</div>

                <input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder='send $50 usdc to device.eth'
                />

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={onPreviewCommand} disabled={previewing}>
                    {previewing ? "Previewing…" : "Preview"}
                  </button>

                  <div style={{ fontSize: 12, opacity: 0.6, alignSelf: "center" }}>
                    Example: <span style={{ opacity: 0.9 }}>send $50 usdc to device.eth</span>
                  </div>
                </div>

                {preview ? (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
                    <div style={{ opacity: 0.7, marginBottom: 6 }}>Preview</div>

                    <div>
                      <span style={{ opacity: 0.75 }}>To:</span>{" "}
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {preview.payeeAddress ?? "—"}
                      </span>
                    </div>

                    <div>
                      <span style={{ opacity: 0.75 }}>Amount:</span> {preview.amount} {preview.asset}
                    </div>

                    {preview.memo ? (
                      <div>
                        <span style={{ opacity: 0.75 }}>Memo:</span> {preview.memo}
                      </div>
                    ) : null}

                    <div>
                      <span style={{ opacity: 0.75 }}>Confidence:</span>{" "}
                      {Math.round((preview.confidence ?? 0) * 100)}%
                    </div>

                    {preview.warnings?.length ? (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ opacity: 0.75, marginBottom: 4 }}>Warnings</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {preview.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {commandErr ? (
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 8 }}>
                    Error: {commandErr}
                  </div>
                ) : null}
              </div>

              <div className="divider" style={{ margin: "6px 0" }} />

              {/* Existing manual form (now acts as the "Preview result editor") */}
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
                <input
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Max 180 chars"
                />
              </label>

              {err ? <div style={{ fontSize: 12, opacity: 0.9 }}>Error: {err}</div> : null}

              {/* ✅ Create is still the only KV-write step */}
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
