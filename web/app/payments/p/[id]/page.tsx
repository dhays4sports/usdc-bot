"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/Header";
import StatusTimeline from "@/components/StatusTimeline";
import Link from "next/link";

const BASESCAN = "https://basescan.org";

function short(addr?: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

type Settlement =
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: `0x${string}` };

function normalizeSettlement(inputRaw: string): Settlement | null {
  const input = inputRaw.trim();
  if (!input) return null;

  if (/^https?:\/\/(www\.)?usdc\.bot\/e\/[^/?#]+/i.test(input)) {
    return { type: "usdc_bot_receipt", value: input };
  }

  if (input.includes("basescan.org/tx/")) {
    const hash = input.split("/tx/")[1]?.split(/[?#]/)[0];
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { type: "tx_hash", value: hash as `0x${string}` };
    }
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(input)) {
    return { type: "tx_hash", value: input as `0x${string}` };
  }

  return null;
}

function normalizeTxHashFromQuery(v: string | null): `0x${string}` | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // allow basescan URL too (just in case)
  if (s.includes("basescan.org/tx/")) {
    const hash = s.split("/tx/")[1]?.split(/[?#]/)[0]?.trim();
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) return hash as `0x${string}`;
    return null;
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(s)) return s as `0x${string}`;
  return null;
}

function stripAutoLinkParams(router: ReturnType<typeof useRouter>) {
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete("txHash");
    u.searchParams.delete("paymentId");
    u.searchParams.delete("from");

    const qs = u.searchParams.toString();
    router.replace(qs ? `${u.pathname}?${qs}` : u.pathname);
  } catch {
    // ignore
  }
}

export default function PaymentReceipt() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const router = useRouter();

  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [proofInput, setProofInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // ✅ usdc.bot handoff state
  const [handoffing, setHandoffing] = useState(false);

  // ✅ auto-link-on-return state
  const [autoLinking, setAutoLinking] = useState(false);
  const autoLinkedOnceRef = useRef(false);

  async function refresh() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payments/${id}`, { cache: "no-store" });
      if (!res.ok) setRec(null);
      else setRec(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    refresh();
  }, [id]);

  const statusSentence =
    rec?.status === "linked" ? "Settlement proof linked" : "Proposed (awaiting payment)";

  async function saveProof() {
    if (!id) return;
    setNotice(null);

    const settlement = normalizeSettlement(proofInput);
    if (!settlement) {
      setNotice({ type: "err", msg: "Paste a tx hash, Basescan URL, or usdc.bot receipt link." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settlement }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ type: "err", msg: json?.error ?? "Could not save proof." });
        return;
      }

      setNotice({ type: "ok", msg: "Settlement proof saved." });
      setProofInput("");
      setShowEdit(false);
      await refresh();
    } catch {
      setNotice({ type: "err", msg: "Network error saving proof." });
    } finally {
      setSaving(false);
    }
  }

  // ✅ Cleanest schema alignment for usdc.bot prefill
  // Priority: original input -> label -> address
  function getBeneficiaryInputFromRec(r: any): string {
    const payee = r?.payee ?? {};
    const input =
      (typeof payee.input === "string" && payee.input.trim()) ||
      (typeof payee.label === "string" && payee.label.trim()) ||
      (typeof payee.address === "string" && payee.address.trim()) ||
      "";
    return input;
  }

  // ✅ Call /api/usdc/commit to route to usdc.bot with a signed handoff
  async function goToUsdcBot() {
    if (!rec?.id) return;
    if (handoffing) return;

    setNotice(null);
    setHandoffing(true);

    try {
      const payeeAddrRaw = typeof rec?.payee?.address === "string" ? rec.payee.address.trim() : "";
      const beneficiaryAddress = is0x40(payeeAddrRaw) ? (payeeAddrRaw as `0x${string}`) : undefined;

      // Always provide a non-empty beneficiaryInput (fallback to address if needed)
      const beneficiaryInput =
        getBeneficiaryInputFromRec(rec) || (beneficiaryAddress ? beneficiaryAddress : "");

      const amount = String(rec.amount ?? "").trim();
      if (!amount) throw new Error("Missing amount on receipt");

      const memo =
        typeof rec.memo === "string" && rec.memo.trim().length ? rec.memo.trim() : undefined;

      const res = await fetch("/api/usdc/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          paymentId: rec.id,
          fields: {
            beneficiaryInput,
            beneficiaryAddress,
            amount,
            memo,
          },
          context: rec.context ?? undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Could not route to usdc.bot");
      if (!json?.redirect) throw new Error("Commit failed: missing redirect");

      window.location.href = String(json.redirect);
    } catch (e: any) {
      setNotice({ type: "err", msg: e?.message || "Could not route to usdc.bot" });
    } finally {
      setHandoffing(false);
    }
  }

  // ✅ Auto-link if we were redirected back with ?txHash=...
  useEffect(() => {
    if (!id) return;
    if (!rec) return;

    // only run once per mount
    if (autoLinkedOnceRef.current) return;

    // already linked? nothing to do (but clean URL)
    if (rec?.status === "linked" || rec?.status === "settled" || rec?.settlement) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("txHash") || params.get("paymentId") || params.get("from")) {
        stripAutoLinkParams(router);
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const txHash = normalizeTxHashFromQuery(params.get("txHash"));
    if (!txHash) return;

    autoLinkedOnceRef.current = true;

    let cancelled = false;

    (async () => {
      setAutoLinking(true);
      setNotice({ type: "ok", msg: "Linking transaction proof…" });

      try {
        const res = await fetch(`/api/payments/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ txHash }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          if (cancelled) return;
          setNotice({
            type: "err",
            msg:
              json?.error ||
              "Could not auto-link proof. You can still paste the tx hash manually.",
          });
          return;
        }

        if (cancelled) return;

        setNotice({ type: "ok", msg: "Transaction proof linked." });

        // refresh record to show settlement/status
        await refresh();

        // strip txHash param so refresh doesn't re-run
        stripAutoLinkParams(router);
      } catch {
        if (cancelled) return;
        setNotice({
          type: "err",
          msg:
            "Network error auto-linking proof. You can still paste the tx hash manually.",
        });
      } finally {
        if (!cancelled) setAutoLinking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rec, router]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="container">
          <div className="centerStage">
            <div className="glassCard">
              <div className="cardTitle">PAYMENT</div>
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
              <div className="cardTitle">PAYMENT</div>
              <p style={{ opacity: 0.8, marginTop: 10 }}>Not found.</p>
              <Link href="/payments">
                <button>Back</button>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="container">
        <div className="centerStage">
          <div className="glassCard">
            <div className="cardTitle">PAYMENT INTENT</div>

            <StatusTimeline
              steps={[
                { key: "created", label: "Created", ts: rec?.createdAt, done: true },
                {
                  key: "linked",
                  label: autoLinking ? "Linking (proof)..." : "Linked (proof)",
                  ts: rec?.updatedAt,
                  done: rec?.status === "linked",
                },
              ]}
            />

            <p className="huge" style={{ marginTop: 6 }}>
              {rec.amount} <span style={{ fontSize: 18 }}>{rec.asset}</span>
            </p>

            <div className="divider" />

            <div className="subrow">
              <span>Status</span>
              <span style={{ fontWeight: 650 }}>{statusSentence}</span>
            </div>

            <div className="divider" />

            <div className="subrow">
              <span>Payee</span>
              <span style={{ fontFamily: "ui-monospace" }}>{short(rec.payee?.address)}</span>
            </div>

            {rec.memo ? (
              <>
                <div className="divider" />
                <div className="subrow">
                  <span>Memo</span>
                  <span>{rec.memo}</span>
                </div>
              </>
            ) : null}

            <div className="divider" />

            <div className="subrow">
              <span>Settlement</span>
              <span>
                {rec.settlement ? (
                  rec.settlement.type === "usdc_bot_receipt" ? (
                    <a
                      className="underline"
                      href={rec.settlement.value}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View receipt
                    </a>
                  ) : (
                    <a
                      className="underline"
                      href={`${BASESCAN}/tx/${rec.settlement.value}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View tx
                    </a>
                  )
                ) : (
                  <span style={{ opacity: 0.75 }}>Not linked</span>
                )}
                <button style={{ marginLeft: 10 }} onClick={() => setShowEdit(true)}>
                  {rec.settlement ? "Replace proof" : "Link settlement"}
                </button>
              </span>
            </div>

            {showEdit ? (
              <>
                <div className="divider" />
                <input
                  value={proofInput}
                  onChange={(e) => setProofInput(e.target.value)}
                  placeholder="0x… or https://basescan.org/tx/… or https://usdc.bot/e/…"
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={saveProof} disabled={saving}>
                    {saving ? "Saving…" : "Save proof"}
                  </button>
                  <button onClick={() => setShowEdit(false)}>Cancel</button>
                </div>
                {notice && (
                  <p style={{ marginTop: 10 }}>
                    {notice.type === "err" ? "Error: " : "OK: "}
                    {notice.msg}
                  </p>
                )}
              </>
            ) : null}

            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              {!rec.settlement && (
                <button onClick={goToUsdcBot} disabled={handoffing}>
                  {handoffing ? "Routing…" : "Pay via usdc.bot"}
                </button>
              )}
              <Link href="/payments/new">
                <button>Create another</button>
              </Link>
            </div>

            {notice && !showEdit ? (
              <p style={{ marginTop: 10 }}>
                {notice.type === "err" ? "Error: " : "OK: "}
                {notice.msg}
              </p>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
