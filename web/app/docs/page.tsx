import Header from "@/components/Header";

export default function Docs() {
  return (
    <>
      <Header />
      <main style={{ padding: 32, maxWidth: 980, margin: "0 auto", lineHeight: 1.6 }}>
        <h1>Docs</h1>
        <p style={{ opacity: 0.8 }}>
          usdc.bot is a minimal escrow receipt layer for native USDC on Base.
          It’s built as a contract-first primitive with a clean, shareable receipt URL.
        </p>

<p style={{ fontSize: 13, opacity: 0.75 }}>
  <b>Note:</b> usdc.bot v1 is experimental infrastructure. Always verify state
  and transactions on Base mainnet.
</p>
 
        <h2>Core flow</h2>
        <ol>
          <li>Create an escrow at <code>/app</code> (beneficiary, amount, deadline, optional memo).</li>
          <li>You’ll be redirected to the receipt at <code>/e/[id]</code>.</li>
          <li>Approve USDC for the coordinator contract.</li>
          <li>Fund escrow (USDC is held by the contract).</li>
          <li>Release to beneficiary, or refund after deadline.</li>
        </ol>

        <h2>Who it’s for</h2>
        <ul>
          <li><b>Agents</b> that need a simple, verifiable escrow primitive.</li>
          <li><b>Developers</b> integrating USDC settlement into automated flows.</li>
          <li><b>Humans</b> who want receipts that can be shared and audited on-chain.</li>
        </ul>

        <h2>Design goals</h2>
        <ul>
          <li><b>Neutral surface:</b> a canonical entry point and receipt format.</li>
          <li><b>Contract enforced:</b> custody + state transitions are on-chain.</li>
          <li><b>Composable:</b> works as a building block for larger agent commerce systems.</li>
        </ul>

        <h2>Notes</h2>
        <ul>
          <li>v1 actions are depositor-only for safety and simplicity.</li>
          <li>v2 can add EIP-712 “agent signed release” and policy modules.</li>
        </ul>
      </main>
    </>
  );
}
