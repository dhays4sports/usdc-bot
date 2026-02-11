"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";

const BASESCAN = "https://basescan.org";

function short(addr?: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function RemitReceipt() {

  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const id = params?.id as string | undefined;

    useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const res = await fetch(`/api/remit/${id}`, { cache: "no-store" });

        if (!res.ok) {
          setRec(null);
          setLoading(false);
          return;
        }

        const json = await res.json();
        setRec(json);
      } catch (e) {
        setRec(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="container">
          <div className="centerStage">
            <div className="glassCard">
              <div className="cardTitle">RECEIPT</div>
              <p style={{ marginTop: 10, opacity: 0.8 }}>Loading…</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!rec) {
    return (
      <>
        <Header />
        <main className="container">
          <div className="centerStage">
            <div className="glassCard">
              <div className="cardTitle">RECEIPT</div>
              <p style={{ opacity: 0.8, marginTop: 10 }}>Not found.</p>
              <div style={{ marginTop: 12 }}>
                <Link href="/remit"><button>Back to remit.bot</button></Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const statusSentence =
    rec.status === "settled" ? "Settled on-chain" :
    rec.status === "linked" ? "Settlement proof linked" :
    "Proposed (awaiting settlement link)";

  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">REMITTANCE RECEIPT</div>

            <p className="huge" style={{ marginTop: 6 }}>
              {rec.amount} <span style={{ fontSize: 18, opacity: 0.9 }}>{rec.asset}</span>
            </p>

            <div className="divider" />

            <div className="subrow">
              <span>Status</span>
              <span style={{ fontWeight: 650 }}>{statusSentence}</span>
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
                {short(rec.recipient?.address)}
              </span>
            </div>

            {rec.memo ? (
              <>
                <div className="divider" />
                <div className="subrow" style={{ alignItems: "flex-start" }}>
                  <span>Memo</span>
                  <span style={{ opacity: 0.9, textAlign: "right" }}>{rec.memo}</span>
                </div>
              </>
            ) : null}

            {rec.settlement ? (
              <>
                <div className="divider" />
                <div className="subrow" style={{ alignItems: "flex-start" }}>
                  <span>Settlement</span>
                  <span style={{ textAlign: "right" }}>
                    {rec.settlement.type === "usdc_bot_receipt" ? (
                      <a className="underline" href={rec.settlement.value} target="_blank" rel="noreferrer">
                        Escrow receipt (usdc.bot)
                      </a>
                    ) : (
                      <a className="underline" href={`${BASESCAN}/tx/${rec.settlement.value}`} target="_blank" rel="noreferrer">
                        View transaction (Basescan)
                      </a>
                    )}
                  </span>
                </div>
              </>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <Link href="/remit/new"><button>Create another</button></Link>

              {!rec.settlement ? (
                <a
                  href={`https://usdc.bot/app?beneficiary=${rec.recipient.address}&amount=${encodeURIComponent(rec.amount)}&memo=${encodeURIComponent(rec.memo ?? "")}&ref=${rec.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <button>Secure via usdc.bot</button>
                </a>
              ) : null}
            </div>
<p style={{ marginTop: 12, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
  Funds are never held by remit.bot. Settlement occurs directly on-chain.
</p>
          </div>
        </div>
      </main>
    </>
  );
}
