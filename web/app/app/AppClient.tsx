"use client";

import Header from "@/components/Header";

// If you use useSearchParams in /app, keep it here.
import { useSearchParams } from "next/navigation";

// Paste the rest of your old /app/page.tsx logic here.
// I’m including a safe skeleton you can merge into.

export default function AppClient() {
  const searchParams = useSearchParams();

  // example
  const beneficiary = searchParams.get("beneficiary") ?? "";
  const amount = searchParams.get("amount") ?? "";

  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">CREATE ESCROW</div>
            <p style={{ marginTop: 10, opacity: 0.8 }}>
              beneficiary: {beneficiary || "—"}<br />
              amount: {amount || "—"}
            </p>

            <p style={{ marginTop: 12, opacity: 0.7 }}>
              Replace this skeleton with your actual /app UI.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
