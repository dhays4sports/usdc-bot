import Link from "next/link";
import Header from "@/components/Header";

const BASESCAN = "https://basescan.org";
const COORD = process.env.NEXT_PUBLIC_COORDINATOR as string;

export default function Home() {
  return (
    <>
      <Header />

      <main className="container">
        <div className="centerStage" style={{ flexDirection: "column", gap: 16 }}>

          {/* Glass receipt hero */}
          <div className="glassCard">
            <div className="cardTitle">ESCROW RECEIPT</div>

            <p className="huge">
              $100 <span style={{ fontSize: 18, opacity: 0.9 }}>USDC</span>
            </p>

            <div className="divider" />

            <div className="subrow">
              <span>Status</span>
              <span className="pillOk">Released</span>
            </div>

            <div className="divider" />

            <div className="subrow">
              <span>Network</span>
              <span>Base Mainnet</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
  <div className="brand" style={{ marginTop: 0 }}>usdc.bot</div>

  <span
    style={{
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,.06)",
      border: "1px solid rgba(255,255,255,.10)",
      opacity: 0.9,
    }}
  >
    v1 / experimental
  </span>

  <span
    style={{
      fontSize: 12,
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,.06)",
      border: "1px solid rgba(255,255,255,.10)",
      opacity: 0.9,
    }}
  >
    Base Mainnet
  </span>
</div>

          <div className="tagline" style={{ maxWidth: 640, textAlign: "center" }}>
            A neutral command surface for USDC escrow receipts on Base.
            Create an escrow, share a receipt link, and settle with on-chain finality.
          </div>

          {/* Primary actions */}
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 10,
              justifyContent: "center",
            }}
          >
            <Link href="/app" className="underline">
              Create escrow
            </Link>

            <Link href="/docs" className="underline">
              Read docs
            </Link>

            <a
              href={`${BASESCAN}/address/${COORD}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              View contract
            </a>
          </div>

          {/* Trust signal */}
          <p style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            <a
              href={`${BASESCAN}/address/${COORD}#code`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Verified on Basescan
            </a>
          </p>

          {/* Divider */}
          <div className="divider" style={{ width: "100%", maxWidth: 860 }} />

          {/* Content sections */}
          <div
            style={{
              display: "grid",
              gap: 18,
              maxWidth: 860,
              fontSize: 15,
              lineHeight: 1.65,
            }}
          >
            <div>
              <h2 style={{ marginBottom: 6 }}>What it does</h2>
              <ul style={{ marginTop: 0 }}>
                <li><b>Create</b> an escrow with beneficiary, amount, and deadline.</li>
                <li><b>Share</b> a verifiable receipt link <code>/e/[id]</code>.</li>
                <li><b>Approve + fund</b> with native USDC.</li>
                <li><b>Release</b> to the beneficiary, or <b>refund</b> after deadline.</li>
              </ul>
            </div>

            <div>
              <h2 style={{ marginBottom: 6 }}>Why it matters</h2>
              <ul style={{ marginTop: 0 }}>
                <li>
                  Not another wallet. Not a siloed app. It’s a <b>composable primitive</b>.
                </li>
                <li>
                  Receipts are a trust layer for <b>agent-to-agent</b> and{" "}
                  <b>agent-to-human</b> commerce.
                </li>
                <li>
                  Simple UX, contract-first design, no backend required for the core flow.
                </li>
              </ul>
            </div>

            <p style={{ fontSize: 12, opacity: 0.7 }}>
              Current network: <b>Base Mainnet</b>
            </p>

            <p style={{ fontSize: 12, opacity: 0.55 }}>
              usdc.bot is an independent project and is not affiliated with Circle,
              USDC, or Coinbase.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
