export default function AgentDocs() {
  const coord = process.env.NEXT_PUBLIC_COORDINATOR;

  return (
    <div className="container">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1>Using usdc.bot as an agent</h1>

        <p style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          usdc.bot is a settlement primitive for agent-controlled USDC.
          <br />
          Agents interact with the contract directly. The interface exists only for inspection and manual use.
        </p>

        <h2 style={{ marginTop: 24 }}>Contract</h2>
        <ul style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
          <li>Network: <b>Base mainnet</b></li>
          <li>
            USDCCoordinator:{" "}
            {coord ? (
              <code>{coord}</code>
            ) : (
              <span style={{ opacity: 0.8 }}>
                (set <code>NEXT_PUBLIC_COORDINATOR</code>)
              </span>
            )}
          </li>
        </ul>

        <h2 style={{ marginTop: 24 }}>Core actions</h2>
        <p style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          Agents only need three calls:
        </p>
        <ul style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
          <li><code>createEscrow(beneficiary, amount, deadline)</code></li>
          <li><code>releaseEscrow(escrowId)</code></li>
          <li><code>refundEscrow(escrowId)</code></li>
        </ul>

        <p style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          There are no sessions, no backend dependencies, and no off-chain custody.
        </p>

        <h2 style={{ marginTop: 24 }}>Escrow receipt</h2>
        <p style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          Every escrow produces a permanent, verifiable receipt.
        </p>

        <div className="glassCard" style={{ width: "min(680px, 92vw)", margin: "12px 0" }}>
          <div className="cardTitle">Receipt URL format</div>
          <code style={{ display: "block", textAlign: "center", fontSize: 13, opacity: 0.9 }}>
            https://usdc.bot/e/{`{escrowId}`}
          </code>
        </div>

        <p style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          Receipts can be logged, shared, audited, and referenced by other systems.
        </p>

        <h2 style={{ marginTop: 24 }}>Guarantees</h2>
        <ul style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
          <li>Deterministic settlement</li>
          <li>Funds are always on-chain</li>
          <li>No admin keys</li>
          <li>No discretionary execution</li>
          <li>Verifiable on Base mainnet</li>
        </ul>

        <h2 style={{ marginTop: 24 }}>Example flow</h2>
        <ol style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
          <li>Agent creates escrow</li>
          <li>Task is completed</li>
          <li>Escrow is released on-chain</li>
          <li>Receipt URL is shared as proof of settlement</li>
        </ol>

        <h2 style={{ marginTop: 24 }}>Notes for automation</h2>
        <ul style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.8 }}>
          <li>usdc.bot is contract-first</li>
          <li>Relayers are optional</li>
          <li>Gas abstraction is external</li>
          <li>Authorization extensions are composable</li>
        </ul>

        <h2 style={{ marginTop: 24 }}>Scope</h2>
        <p style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          usdc.bot does not judge task completion, manage identities, interpret intent, or store off-chain state.
          <br />
          It only settles value.
        </p>
      </div>
    </div>
  );
}
