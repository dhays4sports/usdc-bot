type Step = {
  key: string;
  label: string;
  ts?: string;         // ISO timestamp
  done: boolean;
};

function fmt(ts?: string) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export default function StatusTimeline({ steps }: { steps: Step[] }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>Status timeline</div>

      <div style={{ display: "grid", gap: 10 }}>
        {steps.map((s) => (
          <div
            key={s.key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: s.done ? "rgba(0,255,136,0.07)" : "rgba(255,255,255,0.04)",
              opacity: s.done ? 1 : 0.7,
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: s.done ? "rgba(0,255,136,0.95)" : "rgba(255,255,255,0.35)",
                }}
              />
              <div style={{ fontSize: 13, fontWeight: 650 }}>{s.label}</div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>{s.ts ? fmt(s.ts) : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
