import ConnectButton from "@/components/ConnectButton";

export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <h1>usdc.bot</h1>
      <p>The command interface for USDC on Base.</p>

      <div style={{ margin: "12px 0" }}>
        <ConnectButton />
      </div>

      <a href="/app">
        <button>Create escrow</button>
      </a>

      <br /><br />

      <a href="/docs">Docs</a>
    </main>
  );
}
