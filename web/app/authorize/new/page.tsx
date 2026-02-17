"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { resolveNameToAddress } from "@/lib/nameResolve";

export default function NewAuthorize() {
  const [spenderInput, setSpenderInput] = useState("");
  const [spenderAddress, setSpenderAddress] = useState<string | null>(null);
  const [resolveMsg, setResolveMsg] = useState("Paste 0x, ENS, or Basename.");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [scope, setScope] = useState("Approve USDC spend");
  const [limit, setLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [memo, setMemo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!spenderAddress && !!scope.trim();
  }, [spenderAddress, scope]);

  async function onResolve() {
    setErr(null);
    const v = spenderInput.trim();

    if (!v) {
      setSpenderAddress(null);
      setAvatarUrl(null);
      setResolveMsg("Paste 0x, ENS, or Basename.");
      return;
    }

    setResolveMsg("Resolving…");
    try {
      const r = await resolveNameToAddress(v);
      if (r.ok) {
        setSpenderAddress(r.address);
        // optional avatarUrl if your resolver returns it
        setAvatarUrl((r as any).avatarUrl ?? null);
        const label = r.label ? `${r.label} → ` : "";
        setResolveMsg(`${label}${r.address.slice(0, 6)}…${r.address.slice(-4)}`);
      } else {
        setSpenderAddress(null);
        setAvatarUrl(null);
        setResolveMsg(r.message || "Could not resolve");
      }
    } catch {
      setSpenderAddress(null);
      setAvatarUrl(null);
      setResolveMsg("Could not resolve. Try a 0x address.");
    }
  }

  async function onCreate() {
    setErr(null);
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/authorize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spenderInput: spenderInput.trim(),
          spenderAddress,
          scope: scope.trim(),
          limit: limit.trim() || undefined,
          expiresAt: expiresAt.trim() || undefined,
          memo: memo.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed");

      window.location.href = `/a/${json.id}`;
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
            <div className="cardTitle">NEW AUTHORIZATION</div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Spender</div>
                <input
                  value={spenderInput}
                  onChange={(e) => setSpenderInput(e.target.value)}
                  onBlur={onResolve}
                  placeholder="0x… or vitalik.eth or name.base"
                />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" width={22} height={22} style={{ borderRadius: 999 }} />
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
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Scope</div>
                <input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="What is being authorized?" />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Limit (optional)</div>
                <input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="e.g. 250 USDC" />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Expires at (optional)</div>
                <input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="ISO or text" />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Memo (optional)</div>
                <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Internal note (optional)" />
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
                {submitting ? "Creating…" : "Create authorization"}
              </button>

              <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center" }}>
                <Link href="/authorize">Back</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
