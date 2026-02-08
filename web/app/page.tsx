import Link from "next/link";
import Header from "@/components/Header";

const BASESCAN = "https://sepolia.basescan.org";
const COORD = process.env.NEXT_PUBLIC_COORDINATOR as string;

export default function Home() {
  return (
    <>
      <Header />
      <main style={{ padding: 32, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>usdc.bot</h1>
        <p style={{ fontSize: 18, opacity: 0.8, maxWidth: 720 }}>
          A neutral command surface for USDC escrow receipts on Base.
          Create an escrow, share a receipt link, and settle with on-chain finality.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/app"><button>Create escrow</button></Link>
          <Link href="/docs"><button>Read docs</button></Link>
          <a href={`${BASESCAN}/address/${COORD}`} target="_blank" rel="noreferrer">
            <button>View contract</button>
          </a>
        </div>

        <hr style={{ margin: "26px 0", opacity: 0.2 }} />

        <div style={{ display: "grid", gap: 14, maxWidth: 860 }}>
          <h2 style={{ marginBottom: 0 }}>What it does</h2>
          <ul style={{ marginTop: 0, lineHeight: 1.6 }}>
            <li><b>Create</b> an escrow with beneficiary, amount, and deadline.</li>
            <li><b>Share</b> a verifiable receipt link <code>/e/[id]</code>.</li>
            <li><b>Approve + fund</b> with native USDC.</li>
            <li><b>Release</b> to the beneficiary, or <b>refund</b> after deadline.</li>
          </ul>

          <h2 style={{ marginBottom: 0 }}>Why it matters</h2>
          <ul style={{ marginTop: 0, lineHeight: 1.6 }}>
            <li>Not another wallet. Not a siloed app. It’s a <b>composable primitive</b>.</li>
            <li>Receipts are a trust layer for <b>agent-to-agent</b> and <b>agent-to-human</b> commerce.</li>
            <li>Simple UX, contract-first design, no backend required for the core flow.</li>
          </ul>

          <p style={{ fontSize: 12, opacity: 0.75 }}>
            Current network: Base Mainnet 
          </p>
        </div>
      </main>
    </>
  );
}
