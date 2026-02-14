import Link from "next/link";
import Header from "@/components/Header";

export default function AuthorizeHome() {
  return (
    <>
      <Header />
      <main style={{ padding: 32, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 44, marginBottom: 8 }}>authorize.bot</h1>
        <p style={{ opacity: 0.8, maxWidth: 720 }}>
          A neutral authorization + proof receipt layer for on-chain approvals.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
          <Link href="/authorize/new"><button>Create authorization record</button></Link>
        </div>

        <p style={{ marginTop: 18, fontSize: 12, opacity: 0.65 }}>
          authorize.bot does not custody funds, execute approvals, or guarantee outcomes. It records intent + proof.
        </p>
      </main>
    </>
  );
}
