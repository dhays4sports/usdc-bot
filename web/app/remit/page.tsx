import Link from "next/link";
import Header from "@/components/Header";

export default function RemitHome() {
  return (
    <>
      <Header />
      <main style={{ padding: 32, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>remit.bot</h1>
        <p style={{ opacity: 0.8, maxWidth: 720 }}>
          A neutral coordination and receipt layer for on-chain remittances.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/remit/new"><button>Create remittance record</button></Link>
          <Link href="/remit/example"><button>View example receipt</button></Link>
        </div>

        <p style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
          remit.bot does not transmit money, custody funds, provide payout services, set exchange rates, or guarantee delivery.
        </p>
      </main>
    </>
  );
}
