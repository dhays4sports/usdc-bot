// web/app/payments/new/NewPaymentIntentClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";
import { resolveNameToAddress } from "@/lib/nameResolve";
import { useRouter, useSearchParams } from "next/navigation";

type PreviewResponse = {
  ok?: boolean;
  payeeInput: string;
  payeeAddress: `0x${string}` | null;
  label?: string;
  amount: string;
  memo?: string;
  asset: "USDC";
  network: "base";
  confidence: number;
  warnings: string[];
};

type AcceptResponse = {
  ok: true;
  intent: string;
  fields: {
    payeeInput: string;
    payeeAddress: `0x${string}`;
    amount: string;
    memo?: string;
    asset: "USDC";
    network: "base";
    label?: string;
  };
  context?: {
    source?: string; // ✅ used for the "Routed from hub.chat" badge
    routedFrom?: string;
    [k: string]: any;
  };
};

function short(addr?: string | null) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function NewPaymentIntentClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ visual confirmation (badge)
  const [handoffSource, setHandoffSource] = useState<string | null>(null);

  // ✅ Command → Preview
  const [command, setCommand] = useState("send $50 usdc to device.eth");
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commandErr, setCommandErr] = useState<string | null>(null);

  // "Applied" means: current form fields were populated from preview OR hub handoff
  const [previewApplied, setPreviewApplied] = useState(false);

  // Manual fields
  const [payeeInput, setPayeeInput] = useState("");
  const [payeeAddress, setPayeeAddress] = useState<`0x${string}` | null>(null);
  const [resolveMsg, setResolveMsg] = useState("Paste 0x, ENS, or Basename.");

  const [amount, setAmount] = useState("10");
  const [memo, setMemo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Snapshot of what was applied so edits invalidate
  const appliedSnapshotRef = useRef<{
    payeeInput: string;
    payeeAddress: string | null;
    amount: string;
    memo: string;
  } | null>(null);

  const canSubmit = useMemo(() => {
    const n = Number(amount);
    return !!payeeAddress && !!amount && !isNaN(n) && n > 0 && memo.length <= 180;
  }, [payeeAddress, amount, memo]);

  function applyFields(args: {
    payeeInput: string;
    payeeAddress: `0x${string}` | null;
    amount: string;
    memo?: string;
    label?: string;
  }) {
    setPayeeInput(args.payeeInput ?? "");
    setPayeeAddress(args.payeeAddress ?? null);
    setAmount(String(args.amount ?? ""));
    setMemo(String(args.memo ?? ""));

    if (args.payeeAddress) {
      const left = (args.label ?? args.payeeInput ?? "").trim();
      const prefix = left ? `${left} → ` : "";
      setResolveMsg(`${prefix}${short(args.payeeAddress)}`);
    } else {
      setResolveMsg("Could not resolve payee address.");
    }

    setPreviewApplied(true);
    appliedSnapshotRef.current = {
      payeeInput: String(args.payeeInput ?? ""),
      payeeAddress: args.payeeAddress ?? null,
      amount: String(args.amount ?? ""),
      memo: String(args.memo ?? ""),
    };
  }

  // ✅ Hub handoff: accept token from ?h=...
  // Use a ref so we don't re-consume on rerenders.
  const consumedTokenRef = useRef<string | null>(null);

  // IMPORTANT: don't put searchParams.get(...) directly in deps; store the value.
  const handoffToken =
    searchParams.get("h") || searchParams.get("handoff") || searchParams.get("token");

  useEffect(() => {
    const token = handoffToken;
    if (!token) return;
    if (consumedTokenRef.current === token) return;

    consumedTokenRef.current = token;

    let cancelled = false;

    (async () => {
      setErr(null);
      setCommandErr(null);

      try {
        const res = await fetch("/api/payments/accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const json = (await res.json().catch(() => ({}))) as any;
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Handoff failed");

        const data = json as AcceptResponse;
        if (cancelled) return;

        // ✅ set badge source from context.source (preferred), fallback to hub.chat if missing
        const src =
          String(data?.context?.source ?? data?.context?.routedFrom ?? "hub.chat").trim() ||
          "hub.chat";
        setHandoffSource(src);

        applyFields({
          payeeInput: data.fields.payeeInput,
          payeeAddress: data.fields.payeeAddress,
          amount: data.fields.amount,
          memo: data.fields.memo,
          label: data.fields.label,
        });

        // Clear token from URL (prevents refresh from re-consuming)
        const host = window.location.host.toLowerCase();
        const prefix = host === "payments.chat" || host === "www.payments.chat" ? "" : "/payments";
        router.replace(`${prefix}/new`);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message || "Failed to accept hub handoff");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, handoffToken]);

  // If user edits fields after apply, invalidate
  useEffect(() => {
    if (!previewApplied) return;
    const snap = appliedSnapshotRef.current;
    if (!snap) return;

    const changed =
      snap.payeeInput !== payeeInput ||
      (snap.payeeAddress ?? null) !== (payeeAddress ?? null) ||
      snap.amount !== amount ||
      snap.memo !== memo;

    if (changed) {
      setPreviewApplied(false);
      appliedSnapshotRef.current = null;
    }
  }, [payeeInput, payeeAddress, amount, memo, previewApplied]);

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
      const res = await fetch("/api/payments/nl/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(json?.error || "Failed to preview command");

      const p = json as PreviewResponse;
      setPreview(p);

      if (!p?.payeeAddress) {
        setPreviewApplied(false);
        appliedSnapshotRef.current = null;
        setCommandErr("Preview failed: could not resolve recipient. Fix the command and try again.");
        return;
      }

      // If user is now using local preview, clear hub badge (optional)
      setHandoffSource(null);

      applyFields({
        payeeInput: p.payeeInput,
        payeeAddress: p.payeeAddress,
        amount: p.amount,
        memo: p.memo,
        label: p.label,
      });
    } catch (e: any) {
      setPreview(null);
      setPreviewApplied(false);
      appliedSnapshotRef.current = null;
      setCommandErr(e?.message || "Failed to preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function onResolve() {
    setErr(null);
    setCommandErr(null);

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
        setResolveMsg(`${r.label ? r.label + " → " : ""}${short(r.address)}`);
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
            // ✅ if we were routed from hub, preserve that as the "source"
            source: handoffSource ? "hub.chat" : "payments.chat",
            routedFrom: handoffSource ? handoffSource : undefined,

            // audit trail for NL preview (payments-side)
            fromCommand: previewApplied ? command.trim() : undefined,
            previewConfidence: previewApplied ? preview?.confidence : undefined,
            previewWarnings: previewApplied ? preview?.warnings : undefined,
          },
        }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Failed to create payment intent");

      const host = window.location.host.toLowerCase();
      const prefix = host === "payments.chat" || host === "www.payments.chat" ? "" : "/payments";
      window.location.href = `${prefix}/p/${json.id}`;
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

            {/* ✅ Visual confirmation badge */}
            {handoffSource ? (
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    opacity: 0.9,
                  }}
                >
                  <span style={{ opacity: 0.75 }}>Routed from</span>
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {handoffSource}
                  </span>
                </span>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {/* Command → Preview */}
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
                  onChange={(e) => {
                    setCommand(e.target.value);
                    setCommandErr(null);
                  }}
                  placeholder='send $50 usdc to device.eth'
                />

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={onPreviewCommand} disabled={previewing}>
                    {previewing ? "Previewing…" : "Preview"}
                  </button>

                  {previewApplied ? (
                    <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
                      ✅ Preview applied to form
                    </div>
                  ) : null}

                  <div style={{ fontSize: 12, opacity: 0.6, alignSelf: "center" }}>
                    Example: <span style={{ opacity: 0.9 }}>send $50 usdc to device.eth</span>
                  </div>
                </div>

                {preview ? (
                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85, lineHeight: 1.35 }}>
                    <div style={{ opacity: 0.7, marginBottom: 6 }}>Preview</div>

                    <div>
                      <span style={{ opacity: 0.75 }}>To:</span>{" "}
                      <span style={{ opacity: 0.9 }}>
                        {(preview.label ?? preview.payeeInput) ? `${preview.label ?? preview.payeeInput} → ` : ""}
                      </span>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {preview.payeeAddress ? short(preview.payeeAddress) : "—"}
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

              {/* TrustRoute UI removed */}

              <div className="divider" style={{ margin: "6px 0" }} />

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
