"use client";

import ExperimentalBanner from "@/components/ExperimentalBanner";
import Header from "@/components/Header";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { coordinatorAbi } from "@/lib/abi";
import { isAddress, keccak256, parseEventLogs, parseUnits, toHex } from "viem";
import { useRouter, useSearchParams } from "next/navigation";
import { resolveNameToAddress } from "@/lib/nameResolve";

const COORD = process.env.NEXT_PUBLIC_COORDINATOR as `0x${string}`;

// ✅ Base USDC token (set in env)
const USDC = (process.env.NEXT_PUBLIC_USDC_BASE || "") as `0x${string}`;

// Minimal ERC20 transfer ABI
const erc20Abi = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

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

function short(addr?: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

type UsdcAcceptResponse = {
  ok: true;
  intent: string;
  fields: {
    beneficiaryInput: string;
    amount: string;
    memo?: string;
    returnUrl?: string;
  };
  context?: any;
};

type Mode = "direct" | "escrow";

export default function CreateEscrowPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const publicClient = usePublicClient();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  // ✅ Default to direct pay
  const [mode, setMode] = useState<Mode>("direct");

  // Beneficiary input (can be ENS / basename / 0x)
  const [beneficiaryInput, setBeneficiaryInput] = useState("");
  // Resolved beneficiary address (always 0x… when valid)
  const [beneficiaryAddress, setBeneficiaryAddress] = useState<`0x${string}` | null>(null);

  const [resolveMsg, setResolveMsg] = useState<string>(
    "Paste 0x, ENS (vitalik.eth), or Basename (name.base)."
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const [amount, setAmount] = useState("1.00");
  const [deadline, setDeadline] = useState("");
  const [memo, setMemo] = useState("");
  const [returnUrl, setReturnUrl] = useState("");

  const [notice, setNotice] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);

  // Routed-from badge (handoff context)
  const [routedFrom, setRoutedFrom] = useState<string | null>(null);

  // Track whether beneficiary was prefilled by query param
  const [beneficiaryPrefilled, setBeneficiaryPrefilled] = useState(false);
  const [prefillResolved, setPrefillResolved] = useState(false);

  // ✅ Hub/Payments handoff: accept token ?h=...
  const consumedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const token = sp.get("h") || sp.get("handoff") || sp.get("token");
    if (!token) return;
    if (consumedTokenRef.current === token) return;

    consumedTokenRef.current = token;

    let cancelled = false;

    (async () => {
      setNotice(null);

      try {
        const res = await fetch("/api/usdc/accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const json = (await res.json().catch(() => ({}))) as any;
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Handoff failed");

        const data = json as UsdcAcceptResponse;
        if (cancelled) return;

        // Apply fields
        setBeneficiaryInput(String(data.fields.beneficiaryInput ?? ""));
        setBeneficiaryPrefilled(true);
        setPrefillResolved(false);

        if (data.fields.amount) setAmount(String(data.fields.amount));
        if (typeof data.fields.memo === "string") setMemo(String(data.fields.memo));
        if (typeof data.fields.returnUrl === "string") setReturnUrl(String(data.fields.returnUrl));

        // Badge
        const src =
          (data.context?.source as string | undefined) ||
          (data.context?.upstream?.source as string | undefined) ||
          "payments.chat";
        setRoutedFrom(src);

        // Strip token from URL (prevents refresh from re-consuming)
        router.replace("/app");
      } catch (e: any) {
        if (cancelled) return;
        setNotice({ type: "err", msg: e?.message || "Failed to accept handoff" });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, sp.get("h")]);

  async function onResolveBeneficiary() {
    const v = beneficiaryInput.trim();

    setNotice(null);

    if (!v) {
      setBeneficiaryAddress(null);
      setAvatarUrl(null);
      setResolveMsg("Paste 0x, ENS (vitalik.eth), or Basename (name.base).");
      return;
    }

    if (isAddress(v)) {
      setBeneficiaryAddress(v as `0x${string}`);
      setAvatarUrl(null);
      setResolveMsg(`Address: ${short(v)}`);
      return;
    }

    setResolving(true);
    setResolveMsg("Resolving name…");

    try {
      const r = await resolveNameToAddress(v);

      if (r.ok) {
        setBeneficiaryAddress(r.address);
        setAvatarUrl((r as any).avatarUrl ?? null);

        const label = r.label ? `${r.label} → ` : "";
        setResolveMsg(`${label}${short(r.address)}`);
      } else {
        setBeneficiaryAddress(null);
        setAvatarUrl(null);
        setResolveMsg(r.message || `Could not resolve ${v}`);
      }
    } catch (e: any) {
      setBeneficiaryAddress(null);
      setAvatarUrl(null);
      setResolveMsg(`Could not resolve ${v}. Try a 0x address.`);
    } finally {
      setResolving(false);
    }
  }

  // Prefill from query params once on mount (fallback path if no token)
  useEffect(() => {
    if (consumedTokenRef.current) return;

    const b = sp.get("beneficiary");
    const a = sp.get("amount");
    const m = sp.get("memo");
    const r = sp.get("return");

    if (b) {
      setBeneficiaryInput(safeDecode(b));
      setBeneficiaryPrefilled(true);
    }
    if (a) setAmount(safeDecode(a));
    if (m) setMemo(safeDecode(m));
    if (r) setReturnUrl(safeDecode(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If beneficiary was prefilled, resolve it exactly once
  useEffect(() => {
    if (!beneficiaryPrefilled) return;
    if (prefillResolved) return;

    const v = beneficiaryInput.trim();
    if (!v) return;

    setPrefillResolved(true);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    onResolveBeneficiary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beneficiaryPrefilled, prefillResolved, beneficiaryInput]);

  const memoHash = useMemo(() => {
    const mm = memo.trim();
    return mm.length ? keccak256(toHex(mm)) : ("0x" + "0".repeat(64)) as `0x${string}`;
  }, [memo]);

  const beneficiaryReady =
    isAddress(beneficiaryInput.trim()) || (beneficiaryAddress && isAddress(beneficiaryAddress));

  function getBeneficiary0x(): `0x${string}` | null {
    const b = beneficiaryInput.trim();
    if (isAddress(b)) return b as `0x${string}`;
    if (beneficiaryAddress && isAddress(beneficiaryAddress)) return beneficiaryAddress;
    return null;
  }

  async function onSubmit() {
    setNotice(null);

    if (!isConnected) return setNotice({ type: "err", msg: "Connect your wallet first." });
    if (!publicClient) return setNotice({ type: "err", msg: "Client not ready. Refresh and try again." });

    const beneficiary0x = getBeneficiary0x();
    if (!beneficiary0x) {
      return setNotice({
        type: "err",
        msg: "Enter a valid beneficiary (0x… / ENS / name.base) and wait for it to resolve.",
      });
    }

    let amount6: bigint;
    try {
      amount6 = parseUnits(amount, 6);
    } catch {
      return setNotice({ type: "err", msg: "Amount must be a valid number (example: 1.00)." });
    }

    // ✅ DIRECT PAY
    if (mode === "direct") {
      if (!USDC || !isAddress(USDC)) {
        return setNotice({
          type: "err",
          msg: "Missing NEXT_PUBLIC_USDC_BASE (Base USDC token address).",
        });
      }

      try {
        const txHash = await writeContractAsync({
          address: USDC,
          abi: erc20Abi,
          functionName: "transfer",
          args: [beneficiary0x, amount6],
        });

        setLastTx(txHash);
        setNotice({ type: "ok", msg: "Transfer submitted. Waiting for confirmation..." });

        await publicClient.waitForTransactionReceipt({ hash: txHash });

        setNotice({ type: "ok", msg: "Paid. Redirecting..." });

        // If we have a returnUrl, go there; otherwise show tx
        if (returnUrl) {
          window.location.href = returnUrl;
        } else {
          router.push(`/tx/${txHash}`);
        }
      } catch (e: any) {
        const msg = e?.shortMessage || e?.message || "Transaction failed or was rejected.";
        setNotice({ type: "err", msg });
      }
      return;
    }

    // ✅ ESCROW (existing)
    if (!deadline) return setNotice({ type: "err", msg: "Pick a deadline." });

    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (!Number.isFinite(deadlineTs) || deadlineTs <= Math.floor(Date.now() / 1000)) {
      return setNotice({ type: "err", msg: "Deadline must be in the future." });
    }

    try {
      const txHash = await writeContractAsync({
        address: COORD,
        abi: coordinatorAbi,
        functionName: "createEscrow",
        args: [beneficiary0x, amount6, BigInt(deadlineTs), memoHash],
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
        <h1>USDC (Base Mainnet)</h1>

        {routedFrom ? (
          <div
            style={{
              marginTop: 8,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 12,
              opacity: 0.85,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            Routed from <span style={{ fontWeight: 650 }}>{routedFrom}</span>
          </div>
        ) : null}

        {/* Mode toggle */}
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setMode("direct")}
            style={{
              opacity: mode === "direct" ? 1 : 0.75,
              border: mode === "direct" ? "1px solid rgba(255,255,255,0.22)" : undefined,
            }}
          >
            Direct Pay
          </button>
          <button
            onClick={() => setMode("escrow")}
            style={{
              opacity: mode === "escrow" ? 1 : 0.75,
              border: mode === "escrow" ? "1px solid rgba(255,255,255,0.22)" : undefined,
            }}
          >
            Escrow (advanced)
          </button>

          <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
            {mode === "direct"
              ? "Sends USDC directly to the beneficiary."
              : "Creates an escrow you can release later."}
          </div>
        </div>

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
              value={beneficiaryInput}
              onChange={(e) => {
                setBeneficiaryInput(e.target.value);
                setBeneficiaryAddress(null);
                setAvatarUrl(null);
                setResolveMsg("Paste 0x, ENS (vitalik.eth), or Basename (name.base).");
              }}
              onBlur={onResolveBeneficiary}
              placeholder="0x… or vitalik.eth or name.base"
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  width={22}
                  height={22}
                  style={{ borderRadius: 999, opacity: 0.95 }}
                />
              ) : (
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                />
              )}
              <div style={{ fontSize: 12, opacity: 0.75 }}>{resolving ? "Resolving…" : resolveMsg}</div>
            </div>
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

          {mode === "escrow" ? (
            <label>
              Deadline
              <input
                style={{ width: "100%" }}
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
          ) : null}

          <label>
            Memo (optional)
            <input
              style={{ width: "100%" }}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={mode === "direct" ? "Optional note" : "What is this escrow for?"}
            />
          </label>

          {returnUrl ? (
            <p style={{ fontSize: 12, opacity: 0.75, marginTop: -4 }}>
              Return after:{" "}
              <a className="underline" href={returnUrl} target="_blank" rel="noreferrer">
                {returnUrl}
              </a>
            </p>
          ) : null}

          <button onClick={onSubmit} disabled={isPending || resolving || !beneficiaryReady}>
            {isPending ? "Submitting..." : resolving ? "Resolving..." : mode === "direct" ? "Pay USDC" : "Create escrow"}
          </button>

          <p style={{ fontSize: 12, opacity: 0.75 }}>
            {mode === "direct" ? (
              <>
                Token:{" "}
                {USDC ? (
                  <a className="underline" href={addrUrl(USDC)} target="_blank" rel="noreferrer">
                    <code>{USDC}</code>
                  </a>
                ) : (
                  <span style={{ opacity: 0.8 }}>Missing NEXT_PUBLIC_USDC_BASE</span>
                )}
              </>
            ) : (
              <>
                Coordinator:{" "}
                <a className="underline" href={addrUrl(COORD)} target="_blank" rel="noreferrer">
                  <code>{COORD}</code>
                </a>
                <br />
                Memo hash: <code>{memoHash}</code>
              </>
            )}
          </p>
        </div>
      </main>
    </>
  );
}
