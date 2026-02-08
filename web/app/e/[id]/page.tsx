"use client";

import ExperimentalBanner from "@/components/ExperimentalBanner";
import { useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { coordinatorAbi, erc20Abi } from "@/lib/abi";
import { formatUnits } from "viem";
import { useParams } from "next/navigation";
import Header from "@/components/Header";
import Link from "next/link";

const COORD = process.env.NEXT_PUBLIC_COORDINATOR as `0x${string}`;
const USDC = process.env.NEXT_PUBLIC_USDC as `0x${string}`;

// Step 1: Basescan link helpers
const BASESCAN = "https://basescan.org";
const addrUrl = (a?: string) => (a ? `${BASESCAN}/address/${a}` : "#");
const txUrl = (h?: string) => (h ? `${BASESCAN}/tx/${h}` : "#");

// Step 6: Human status labels
function statusLabel(s: number) {
  if (s === 1) return "Created (awaiting funding)";
  if (s === 2) return "Funded (locked in escrow)";
  if (s === 3) return "Released (paid out)";
  if (s === 4) return "Refunded (returned)";
  return "Unknown";
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const escrowId = BigInt(id);

  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [busy, setBusy] = useState<string | null>(null);

  // Step 2: track last tx for link display
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);

  const { data: escrow, refetch } = useReadContract({
    address: COORD,
    abi: coordinatorAbi,
    functionName: "getEscrow",
    args: [escrowId],
    query: { refetchInterval: 4000 },
  });

  const depositor = escrow?.depositor as `0x${string}` | undefined;
  const beneficiary = escrow?.beneficiary as `0x${string}` | undefined;
  const amount = escrow?.amount as bigint | undefined;
  const deadline = escrow?.deadline as bigint | undefined;
  const memoHash = escrow?.memoHash as `0x${string}` | undefined;
  const status = Number(escrow?.status ?? 0);

  const isDepositor = useMemo(() => {
    if (!address || !depositor) return false;
    return address.toLowerCase() === depositor.toLowerCase();
  }, [address, depositor]);

  const now = Math.floor(Date.now() / 1000);
  const deadlineNum = deadline ? Number(deadline) : 0;
  const isExpired = deadlineNum > 0 && now >= deadlineNum;

  const { data: allowance } = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "allowance",
    args: [
      (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
      COORD,
    ],
    query: { enabled: Boolean(address), refetchInterval: 4000 },
  });

  const { data: usdcBal } = useReadContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [
      (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    ],
    query: { enabled: Boolean(address), refetchInterval: 4000 },
  });

  async function wait(txHash: `0x${string}`) {
  if (!publicClient) throw new Error("Client not ready. Refresh and try again.");
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  await refetch();
}

  // Step 3: copy helper + feedback banner via busy
  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setBusy("Copied");
    setTimeout(() => setBusy(null), 900);
  }

  async function onApprove() {
    if (!isConnected) {
      setBusy("Connect wallet.");
      return;
    }
    if (!amount) return;

    setBusy("Approving USDC...");
    try {
      const txHash = await writeContractAsync({
        address: USDC,
        abi: erc20Abi,
        functionName: "approve",
        args: [COORD, amount],
      });
      setLastTx(txHash);
      await wait(txHash);
      setBusy(null);
    } catch (e) {
      setBusy("Approve failed");
    }
  }

  async function onFund() {
    if (!isConnected) {
      setBusy("Connect wallet.");
      return;
    }

    setBusy("Funding escrow...");
    try {
      const txHash = await writeContractAsync({
        address: COORD,
        abi: coordinatorAbi,
        functionName: "fundEscrow",
        args: [escrowId],
      });
      setLastTx(txHash);
      await wait(txHash);
      setBusy(null);
    } catch (e) {
      setBusy("Fund failed");
    }
  }

  async function onRelease() {
    if (!isConnected) {
      setBusy("Connect wallet.");
      return;
    }

    setBusy("Releasing...");
    try {
      const txHash = await writeContractAsync({
        address: COORD,
        abi: coordinatorAbi,
        functionName: "releaseEscrow",
        args: [escrowId],
      });
      setLastTx(txHash);
      await wait(txHash);
      setBusy(null);
    } catch (e) {
      setBusy("Release failed");
    }
  }

  async function onRefund() {
    if (!isConnected) {
      setBusy("Connect wallet.");
      return;
    }

    setBusy("Refunding...");
    try {
      const txHash = await writeContractAsync({
        address: COORD,
        abi: coordinatorAbi,
        functionName: "refundEscrow",
        args: [escrowId],
      });
      setLastTx(txHash);
      await wait(txHash);
      setBusy(null);
    } catch (e) {
      setBusy("Refund failed");
    }
  }

  const allowanceOk = amount ? (allowance ?? BigInt(0)) >= amount : false;

  return (
    <>
      <Header />
      <ExperimentalBanner />
      <main style={{ padding: 32, maxWidth: 860 }}>
        <h1>Escrow #{id}</h1>

        {/* Step 3: copy buttons near top */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button onClick={() => copy(window.location.href)}>Copy receipt link</button>
          <button onClick={() => copy(id)}>Copy escrow id</button>
          {depositor && <button onClick={() => copy(depositor)}>Copy depositor</button>}
          {beneficiary && <button onClick={() => copy(beneficiary)}>Copy beneficiary</button>}
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <div>
            <b>Status:</b> {statusLabel(status)} {isExpired ? "(expired)" : ""}
          </div>

          {/* Step 1: address links */}
          <div>
            <b>Depositor:</b>{" "}
            {depositor ? (
              <a href={addrUrl(depositor)} target="_blank" rel="noreferrer">
                <code>{depositor}</code>
              </a>
            ) : (
              "-"
            )}
          </div>

          <div>
            <b>Beneficiary:</b>{" "}
            {beneficiary ? (
              <a href={addrUrl(beneficiary)} target="_blank" rel="noreferrer">
                <code>{beneficiary}</code>
              </a>
            ) : (
              "-"
            )}
          </div>

          <div>
            <b>Amount:</b> {amount ? `${formatUnits(amount, 6)} USDC` : "-"}
          </div>

          <div>
            <b>Deadline:</b>{" "}
            {deadline ? new Date(Number(deadline) * 1000).toLocaleString() : "-"}
          </div>

          <div>
            <b>Memo hash:</b> <code>{memoHash ?? "-"}</code>
          </div>

          <div style={{ opacity: 0.8, fontSize: 12 }}>
            <b>Your USDC:</b> {usdcBal ? formatUnits(usdcBal, 6) : "-"} •{" "}
            <b>Allowance:</b> {allowance ? formatUnits(allowance, 6) : "-"} (needs ≥ amount)
          </div>
        </div>

        <hr style={{ margin: "18px 0", opacity: 0.2 }} />

        {!isDepositor && (
          <p style={{ opacity: 0.8 }}>
            Actions are depositor-only in v1. Connect the depositor wallet to fund/release/refund.
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {isDepositor && status === 1 && (
            <>
              <button onClick={onApprove} disabled={Boolean(busy) || isPending || allowanceOk}>
                {allowanceOk ? "USDC approved" : "Approve USDC"}
              </button>
              <button onClick={onFund} disabled={Boolean(busy) || isPending || !allowanceOk}>
                Fund escrow
              </button>
            </>
          )}

          {isDepositor && status === 2 && (
            <>
              <button onClick={onRelease} disabled={Boolean(busy) || isPending}>
                Release to beneficiary
              </button>
              <button onClick={onRefund} disabled={Boolean(busy) || isPending || !isExpired}>
                Refund (after deadline)
              </button>
            </>
          )}
        </div>

        {/* Step 2: last tx link */}
        {lastTx && (
          <p style={{ marginTop: 12, fontSize: 12 }}>
            Last tx:{" "}
            <a href={txUrl(lastTx)} target="_blank" rel="noreferrer">
              <code>
                {lastTx.slice(0, 10)}...{lastTx.slice(-8)}
              </code>
            </a>
          </p>
        )}

        {/* Step 4: busy banner (replaces plain <p>) */}
        {busy && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "rgba(0,0,0,0.03)",
              fontSize: 13,
            }}
          >
            {busy}
          </div>
        )}

        {/* Step 6: Create another button */}
        <div style={{ marginTop: 16 }}>
          <Link href="/app">
            <button>Create another escrow</button>
          </Link>
        </div>

        {/* Step 1: coordinator + usdc links */}
        <p style={{ marginTop: 18, opacity: 0.8, fontSize: 12 }}>
          Coordinator:{" "}
          <a href={addrUrl(COORD)} target="_blank" rel="noreferrer">
            <code>{COORD}</code>
          </a>
          <br />
          USDC:{" "}
          <a href={addrUrl(USDC)} target="_blank" rel="noreferrer">
            <code>{USDC}</code>
          </a>
        </p>
      </main>
    </>
  );
}
