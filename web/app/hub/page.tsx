// web/app/hub/page.tsx
"use client";

import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";

type HubPreview = {
  ok: true;
  intent: "pay" | "invoice" | "refund";
  route: { kind: "surface"; target: "payments.chat" | "invoice.chat" | "refund.chat"; path: string };
  fields: Record<string, any>;
  confidence: number;
  warnings: string[];
};

export default function HubHome() {
  // SmartCommand input
  const [command, setCommand] = useState("send $50 usdc to device.eth");
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [preview, setPreview] = useState<HubPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canCommit = useMemo(() => {
    const aud = (preview?.route as any)?.surface ?? preview?.route?.target;
    return !!preview?.ok && !!preview?.route?.target && !!preview?.route?.path;
  }, [preview]);

  async function onPreview() {
    setErr(null);
    setPreview(null);

    const prompt = command.trim();
    if (!prompt) {
      setErr('Type something like: "send $50 usdc to device.eth"');
      return;
    }

    setPreviewing(true);
    try {
      const res = await fetch("/api/hub/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(json?.error || "Preview failed");

      // Expect { ok:true, intent, route, fields, confidence, warnings }
      setPreview(json as HubPreview);
    } catch (e: any) {
      setErr(e?.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function onCommit() {
    setErr(null);
    if (!preview) return;

    setCommitting(true);
    try {
      const res = await fetch("/api/hub/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
  intent: preview.intent,
  route: {
    aud: (preview as any).route?.surface ?? (preview as any).route?.target
    path: preview.route?.path,  // "/new"
  },
  fields: preview.fields,
}),
      });

      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(json?.error || "Commit failed");
      if (!json?.redirect) throw new Error("Commit failed: missing redirect");

      window.location.href = String(json.redirect);
    } catch (e: any) {
      setErr(e?.message || "Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  // Pretty helpers (safe)
  const prettyTarget = (t?: string) => {
    if (!t) return "—";
    if (t === "payments.chat") return "payments.chat";
    if (t === "invoice.chat") return "invoice.chat";
    if (t === "refund.chat") return "refund.chat";
    return t;
  };

  const short = (addr?: string | null) => {
    if (!addr) return "—";
    if (addr.length < 12) return addr;
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  };

  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">HUB</div>

            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {/* SmartCommand */}
              <div
                style={{
                  padding: 12,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>SmartCommand</div>

                <input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder='send $50 usdc to device.eth'
                />

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={onPreview} disabled={previewing || committing}>
                    {previewing ? "Previewing…" : "Preview"}
                  </button>

                  <button onClick={onCommit} disabled={!canCommit || previewing || committing}>
                    {committing ? "Routing…" : "Continue"}
                  </button>

                  <div style={{ fontSize: 12, opacity: 0.6, alignSelf: "center" }}>
                    Examples:{" "}
                    <span style={{ opacity: 0.9 }}>
                      send $50 usdc to device.eth · invoice 120 usdc to vitalik.eth for design · refund $15 to 0x… for
                      double charge
                    </span>
                  </div>
                </div>

                {/* Preview Card */}
                {preview ? (
                  <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                    <div style={{ opacity: 0.7, marginBottom: 6 }}>Preview</div>

                    <div style={{ display: "grid", gap: 4 }}>
                      <div>
                        <span style={{ opacity: 0.75 }}>Intent:</span> {preview.intent}
                      </div>

                      <div>
                        <span style={{ opacity: 0.75 }}>Route:</span>{" "}
                        {prettyTarget(preview.route?.target)}
                        <span style={{ opacity: 0.65 }}> {preview.route?.path ? `(${preview.route.path})` : ""}</span>
                      </div>

                      <div>
                        <span style={{ opacity: 0.75 }}>To:</span>{" "}
                        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                          {short(preview.fields?.payeeAddress)}
                        </span>
                        {preview.fields?.payeeInput ? (
                          <span style={{ opacity: 0.7 }}> ({String(preview.fields.payeeInput)})</span>
                        ) : null}
                      </div>

                      <div>
                        <span style={{ opacity: 0.75 }}>Amount:</span>{" "}
                        {String(preview.fields?.amount ?? "—")}{" "}
                        {String(preview.fields?.asset ?? "USDC")}
                      </div>

                      {preview.fields?.memo ? (
                        <div>
                          <span style={{ opacity: 0.75 }}>Memo:</span> {String(preview.fields.memo)}
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

                    <div style={{ marginTop: 10, opacity: 0.7 }}>
                      Continue will mint a short-lived handoff token and route you to the right surface.
                    </div>
                  </div>
                ) : null}

                {err ? (
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 10 }}>
                    Error: {err}
                  </div>
                ) : null}
              </div>

              <div style={{ fontSize: 12, opacity: 0.65, textAlign: "center" }}>
                <Link href="/payments">Payments</Link> · <Link href="/invoice">Invoice</Link> ·{" "}
                <Link href="/refund">Refund</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
