// web/components/SmartCommand.tsx
"use client";

import { useState } from "react";

type HubPreview = {
  ok: true;
  intent: "payment" | "invoice" | "refund" | "unknown";
  route: { surface: "payments" | "invoice" | "refund"; url: string };
  fields: Record<string, any>;
  confidence: number;
  warnings: string[];
};

export default function SmartCommand() {
  const [command, setCommand] = useState("send $50 usdc to device.eth");
  const [previewing, setPreviewing] = useState(false);
  const [p, setP] = useState<HubPreview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onPreview() {
    setErr(null);
    setP(null);

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

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || "Preview failed");

      setP(json as HubPreview);
    } catch (e: any) {
      setErr(e?.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  function go() {
    if (!p?.route?.url) return;
    window.location.href = p.route.url;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Command</div>

      <input
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder='send $50 usdc to device.eth'
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={onPreview} disabled={previewing}>
          {previewing ? "Previewing…" : "Preview"}
        </button>

        <button onClick={go} disabled={!p || p.intent === "unknown"}>
          Continue
        </button>

        <div style={{ fontSize: 12, opacity: 0.6, alignSelf: "center" }}>
          Preview fills + routes. No state is written on preview.
        </div>
      </div>

      {err ? <div style={{ fontSize: 12, opacity: 0.9 }}>Error: {err}</div> : null}

      {p ? (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
          <div style={{ opacity: 0.7, marginBottom: 6 }}>Preview</div>

          <div>
            <span style={{ opacity: 0.75 }}>Intent:</span> {p.intent}
          </div>

          <div>
            <span style={{ opacity: 0.75 }}>Route:</span> {p.route.surface}
          </div>

          <div>
            <span style={{ opacity: 0.75 }}>Confidence:</span> {Math.round((p.confidence ?? 0) * 100)}%
          </div>

          {p.warnings?.length ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ opacity: 0.75, marginBottom: 4 }}>Warnings</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {p.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
