"use client";

import { useEffect, useState } from "react";

type TRStatsResp = {
  surface: string;
  stats: Record<string, any>;
  message?: string;
};

function asNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function TrustRoutePanel({
  surface,
  compact = false,
}: {
  surface: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<TRStatsResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tr/stats?surface=${encodeURIComponent(surface)}`, {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as TRStatsResp | null;
      if (!res.ok || !json) throw new Error((json as any)?.error || "Failed to load TrustRoute stats");
      setData(json);
    } catch (e: any) {
      setErr(e?.message || "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface]);

  const stats = data?.stats ?? {};
  const created = asNum(stats.totalCreated ?? stats.intentsCreated ?? stats.created);
  const linked = asNum(stats.totalLinked ?? stats.proofsLinked ?? stats.linked);
  const revoked = asNum(stats.totalRevoked ?? stats.revoked);
  const last = String(stats.lastActivityAt ?? "");

  return (
    <div
      style={{
        padding: compact ? 10 : 12,
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>TrustRoute</div>
        <button onClick={load} disabled={loading} style={{ fontSize: 12, padding: "6px 10px" }}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {err ? (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9 }}>Error: {err}</div>
      ) : null}

      {!err ? (
        <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12, opacity: 0.9 }}>
          <div>
            <span style={{ opacity: 0.7 }}>Surface:</span> {surface}
          </div>
          <div>
            <span style={{ opacity: 0.7 }}>Created:</span> {created}
          </div>
          <div>
            <span style={{ opacity: 0.7 }}>Linked:</span> {linked}
          </div>
          <div>
            <span style={{ opacity: 0.7 }}>Revoked:</span> {revoked}
          </div>
          <div style={{ opacity: 0.75 }}>
            <span style={{ opacity: 0.7 }}>Last:</span> {last ? new Date(last).toLocaleString() : "—"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
