import Link from "next/link";
import Header from "@/components/Header";

export default function PaymentsHome() {
  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage" style={{ flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0 }}>payments.chat</h1>
          <p style={{ opacity: 0.8, maxWidth: 720 }}>
            Payment intent routing surface (authorize → execute on usdc.bot → receipt on remit.bot).
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/payments/new"><button>Create payment intent</button></Link>
          </div>
        </div>
      </main>
    </>
  );
}
