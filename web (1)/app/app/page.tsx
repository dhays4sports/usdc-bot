"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, keccak256, toHex, isAddress } from "viem";
import { coordinatorAbi } from "@/lib/abi";

const COORD = process.env.NEXT_PUBLIC_COORDINATOR as `0x${string}`;

export default function CreateEscrow() {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("1.00");
  const [deadline, setDeadline] = useState("");
  const [memo, setMemo] = useState("");

  async function onCreate() {
    if (!isConnected) return alert("Connect your wallet first.");
    if (!isAddress(beneficiary)) return alert("Beneficiary must be a valid address.");
    if (!deadline) return alert("Pick a deadline.");

    if (!COORD || COORD === ("0x" + "0".repeat(40))) {
      return alert("Coordinator address not set yet. Deploy contract first, then update .env.local");
    }

    const amount6 = parseUnits(amount, 6);
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    const memoHash =
      memo.trim().length > 0
        ? keccak256(toHex(memo))
        : ("0x" + "0".repeat(64)) as `0x${string}`;

    const txHash = await writeContractAsync({
      address: COORD,
      abi: coordinatorAbi,
      functionName: "createEscrow",
      args: [beneficiary as `0x${string}`, amount6, BigInt(deadlineTs), memoHash],
    });

    alert(`Escrow created. Tx: ${txHash}`);
  }

  return (
    <main style={{ padding: 32, maxWidth: 620 }}>
      <h1>Create Escrow</h1>

      <div style={{ display: "grid", gap: 10 }}>
        <label>
          Beneficiary
          <input
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="0x..."
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Amount (USDC)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.00"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Deadline
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Memo (optional)
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="What is this escrow for?"
            style={{ width: "100%" }}
          />
        </label>

        <button onClick={onCreate} disabled={isPending}>
          {isPending ? "Submitting..." : "Create escrow"}
        </button>

        <p style={{ fontSize: 12, opacity: 0.75 }}>
          Network: Base Sepolia • Coordinator: {COORD}
        </p>
      </div>
    </main>
  );
}
