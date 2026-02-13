import Link from "next/link";
import Header from "@/components/Header";

export default function AuthorizeHome() {
  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">AUTHORIZE.BOT</div>

            <p style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.5 }}>
              A neutral policy gate for actions across Mesh nodes.
              <br />
              Returns <b>allow/deny</b> with a stable <b>policyId</b>.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <Link href="/authorize/demo"><button>Try demo</button></Link>
              <a href="/api/authorize" target="_blank" rel="noreferrer">
                <button>API</button>
              </a>
            </div>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>
              No custody. This is decision-only. Execution remains on-chain in usdc.bot / remit.bot.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
