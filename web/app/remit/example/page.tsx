import Header from "@/components/Header";
import Link from "next/link";

export default function Example() {
  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">EXAMPLE</div>
            <p className="huge" style={{ marginTop: 6 }}>
              25 <span style={{ fontSize: 18, opacity: 0.9 }}>USDC</span>
            </p>

            <div className="divider" />

            <div className="subrow">
              <span>Status</span>
              <span style={{ fontWeight: 650 }}>Settlement proof linked</span>
            </div>

            <div className="divider" />

            <div className="subrow">
              <span>Network</span>
              <span>Base Mainnet</span>
            </div>

            <div className="divider" />

            <div className="subrow">
              <span>Recipient</span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", opacity: 0.9 }}>
                0x1234…abcd
              </span>
            </div>

            <div className="divider" />

            <div className="subrow" style={{ alignItems: "flex-start" }}>
              <span>Memo</span>
              <span style={{ opacity: 0.9, textAlign: "right" }}>Design milestone payment</span>
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/remit/new"><button>Create a real record</button></Link>
              <Link href="/remit"><button>Back</button></Link>
            </div>

            <p style={{ fontSize: 12, opacity: 0.6, marginTop: 14 }}>
              This is a static example to show the receipt format.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
