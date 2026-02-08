"use client";

import { useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { coordinatorAbi } from "@/lib/abi";
import { isAddress, keccak256, parseEventLogs, parseUnits, toHex } from "viem";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";


const COORD = process.env.NEXT_PUBLIC_COORDINATOR as `0x${string}`;

export default function CreateEscrowPage() {
  const router = useRouter();
  const publicClient = usePublicClient();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("1.00");
  const [deadline, setDeadline] = useState("");
  const [memo, setMemo] = useState("");

  const memoHash = useMemo(() => {
    const m = memo.trim();
    return m.length ? keccak256(toHex(m)) : ("0x" + "0".repeat(64)) as `0x${string}`;
  }, [memo]);

  async function onCreate() {
    if (!isConnected) return alert("Connect your wallet first.");
    if (!isAddress(beneficiary)) return alert("Beneficiary must be a valid 0x address.");
    if (!deadline) return alert("Pick a deadline.");

    const amount6 = parseUnits(amount, 6);
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (!Number.isFinite(deadlineTs) || deadlineTs <= Math.floor(Date.now() / 1000)) {
      return alert("Deadline must be in the future.");
    }

    const txHash = await writeContractAsync({
      address: COORD,
      abi: coordinatorAbi,
      functionName: "createEscrow",
      args: [beneficiary as `0x${string}`, amount6, BigInt(deadlineTs), memoHash],
    });

    if (!publicClient) {
  setNotice({ type: "err", msg: "Client not ready. Refresh the page and try again." });
  return;
}
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });


    // Extract escrow id from EscrowCreated event
    const logs = parseEventLogs({
      abi: coordinatorAbi,
      logs: receipt.logs,
      eventName: "EscrowCreated",
    });

    if (!logs.length) {
      alert(`Created tx confirmed, but no EscrowCreated event found. Tx: ${txHash}`);
      return;
    }

    const id = logs[0].args.id; // bigint
    router.push(`/e/${id.toString()}`);
  }

  return (
    <>
    <Header />
    <main style={{ padding: 32, maxWidth: 680 }}>
      <h1>Create USDC Escrow (Base Sepolia)</h1>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Beneficiary
          <input
            style={{ width: "100%" }}
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="0x..."
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

        <button onClick={onCreate} disabled={isPending}>
          {isPending ? "Submitting..." : "Create escrow"}
        </button>

        <p style={{ fontSize: 12, opacity: 0.75 }}>
          Coordinator: {COORD}
          <br />
          Memo hash: <code>{memoHash}</code>
        </p>
      </div>
    </main>
    </>
  );
}
