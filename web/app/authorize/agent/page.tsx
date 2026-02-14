import Header from "@/components/Header";
import fs from "node:fs";
import path from "node:path";

export default function AgentContractPage() {
  const p = path.join(process.cwd(), "app", "authorize", "agent.md");
  const md = fs.readFileSync(p, "utf8");

  return (
    <>
      <Header />
      <main style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34, marginBottom: 10 }}>authorize.bot — Agent Contract</h1>
        <pre style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.5,
          padding: 16,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.05)"
        }}>
          {md}
        </pre>
      </main>
    </>
  );
}
