"use client";

import ExperimentalBanner from "@/components/ExperimentalBanner";
import Header from "@/components/Header";
import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { coordinatorAbi } from "@/lib/abi";
import { isAddress, keccak256, parseEventLogs, parseUnits, toHex } from "viem";
import { useRouter, useSearchParams } from "next/navigation";

const COORD = process.env.NEXT_PUBLIC_COORDINATOR as `0x${string}`;

// Base mainnet explorer
const BASESCAN = "https://basescan.org";
const txUrl = (h?: string) => (h ? `${BASESCAN}/tx/${h}` : "#");
const addrUrl = (a?: string) => (a ? `${BASESCAN}/address/${a}` : "#");

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default function CreateEscrowPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const publicClient = usePublicClient();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("1.00");
  const [deadline, setDeadline] = useState("");
  const [memo, setMemo] = useState("");
  const [returnUrl, setReturnUrl] = useState("");

  const [notice, setNotice] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);

  // Prefill from query params once on mount
  useEffect(() => {
    const b = sp.get("beneficiary");
    const a = sp.get("amount");
    const m = sp.get("memo");
    const r = sp.get("return");

    if (b) setBeneficiary(safeDecode(b));
    if (a) setAmount(safeDecode(a));
    if (m) setMemo(safeDecode(m));
    if (r) setReturnUrl(safeDecode(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memoHash = useMemo(() => {
    const mm = memo.trim();
    return mm.length ? keccak256(toHex(mm)) : ("0x" + "0".repeat(64)) as `0x${string}`;
  }, [memo]);

  async function onCreate() {
    setNotice(null);

    if (!isConnected) return setNotice({ type: "err", msg: "Connect your wallet first." });
    if (!publicClient) return setNotice({ type: "err", msg: "Client not ready. Refresh and try again." });
    if (!isAddress(beneficiary)) return setNotice({ type: "err", msg: "Beneficiary must be a valid 0x address." });
    if (!deadline) return setNotice({ type: "err", msg: "Pick a deadline." });

    let amount6: bigint;
    try {
      amount6 = parseUnits(amount, 6);
    } catch {
      return setNotice({ type: "err", msg: "Amount must be a valid number (example: 1.00)." });
    }

    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (!Number.isFinite(deadlineTs) || deadlineTs <= Math.floor(Date.now() / 1000)) {
      return setNotice({ type: "err", msg: "Deadline must be in the future." });
    }

    try {
      const txHash = await writeContractAsync({
        address: COORD,
        abi: coordinatorAbi,
        functionName: "createEscrow",
        args: [beneficiary as `0x${string}`, amount6, BigInt(deadlineTs), memoHash],
      });

      setLastTx(txHash);
      setNotice({ type: "ok", msg: "Escrow submitted. Waiting for confirmation..." });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      const logs = parseEventLogs({
        abi: coordinatorAbi,
        logs: receipt.logs,
        eventName: "EscrowCreated",
      });

      if (!logs.length) {
        setNotice({ type: "err", msg: "Tx confirmed, but EscrowCreated event was not found in logs." });
        return;
      }

      const id = logs[0].args.id;
      setNotice({ type: "ok", msg: `Escrow created (#${id.toString()}). Redirecting...` });

      // Preserve return param for the receipt page to optionally link back to remit.bot
      const qs = returnUrl ? `?return=${encodeURIComponent(returnUrl)}` : "";
      router.push(`/e/${id.toString()}${qs}`);
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || "Transaction failed or was rejected.";
      setNotice({ type: "err", msg });
    }
  }

  return (
    <>
      <Header />
      <ExperimentalBanner />
      <main style={{ padding: 32, maxWidth: 680, margin: "0 auto" }}>
        <h1>Create USDC Escrow (Base Mainnet)</h1>

        {notice && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              marginTop: 12,
              marginBottom: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: notice.type === "ok" ? "rgba(0,255,0,0.06)" : "rgba(255,0,0,0.06)",
              fontSize: 13,
            }}
          >
            {notice.msg}
            {lastTx && (
              <>
                {" "}
                <a className="underline" href={txUrl(lastTx)} target="_blank" rel="noreferrer">
                  View tx
                </a>
              </>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <label>
            Beneficiary
            <input
              style={{ width: "100%" }}
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="0x... or (later) name.eth"
            />
          </label>

          <label>
            Amount (USDC)
            <input
              style={{ width: "100%" }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1.00"
            />
          </label>

          <label>
            Deadline
            <input
              style={{ width: "100%" }}
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>

          <label>
            Memo (optional)
            <input
              style={{ width: "100%" }}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="What is this escrow for?"
            />
          </label>

          {/* optional: show return state so you can verify the handoff */}
          {returnUrl ? (
            <p style={{ fontSize: 12, opacity: 0.75, marginTop: -4 }}>
              Return after escrow:{" "}
              <a className="underline" href={returnUrl} target="_blank" rel="noreferrer">
                {returnUrl}
              </a>
            </p>
          ) : null}

          <button onClick={onCreate} disabled={isPending}>
            {isPending ? "Submitting..." : "Create escrow"}
          </button>

          <p style={{ fontSize: 12, opacity: 0.75 }}>
            Coordinator:{" "}
            <a className="underline" href={addrUrl(COORD)} target="_blank" rel="noreferrer">
              <code>{COORD}</code>
            </a>
            <br />
            Memo hash: <code>{memoHash}</code>
          </p>
        </div>
      </main>
    </>
  );
}
