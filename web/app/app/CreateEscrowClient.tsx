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

type HandoffAcceptResponse =
  | {
      ok: true;
      intent: string;
      fields: {
        beneficiaryInput: string;
        beneficiaryAddress?: `0x${string}` | null;
        amount: string;
        memo?: string;
        returnUrl?: string;
        // optional passthrough
        deadline?: string;
      };
      context?: any;
    }
  | { ok: false; error: string; detail?: string };

export default function CreateEscrowPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const publicClient = usePublicClient();
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

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

  // Track whether beneficiary was prefilled by query param or handoff
  const [beneficiaryPrefilled, setBeneficiaryPrefilled] = useState(false);
  const [prefillResolved, setPrefillResolved] = useState(false);

  async function onResolveBeneficiary() {
    const v = beneficiaryInput.trim();

    // reset prior status
    setNotice(null);

    if (!v) {
      setBeneficiaryAddress(null);
      setAvatarUrl(null);
      setResolveMsg("Paste 0x, ENS (vitalik.eth), or Basename (name.base).");
      return;
    }

    // Fast path: direct address
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
        // optional avatarUrl support (if your resolver returns it)
        setAvatarUrl((r as any).avatarUrl ?? null);

        const label = r.label ? `${r.label} → ` : "";
        setResolveMsg(`${label}${short(r.address)}`);
      } else {
        setBeneficiaryAddress(null);
        setAvatarUrl(null);
        setResolveMsg(r.message || `Could not resolve ${v}`);
      }
    } catch {
      setBeneficiaryAddress(null);
      setAvatarUrl(null);
      setResolveMsg(`Could not resolve ${v}. Try a 0x address.`);
    } finally {
      setResolving(false);
    }
  }

  // ✅ Handoff: consume ?h=... (signed token) once
  const consumedHandoffRef = useRef<string | null>(null);

  useEffect(() => {
    const token = sp.get("h") || sp.get("handoff") || sp.get("token");
    if (!token) return;
    if (consumedHandoffRef.current === token) return;

    consumedHandoffRef.current = token;

    let cancelled = false;

    (async () => {
      setNotice(null);

      try {
        // IMPORTANT: you need an accept endpoint on usdc.bot that verifies the token
        // Example path: /api/usdc/accept
        const res = await fetch("/api/usdc/accept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const json = (await res.json().catch(() => ({}))) as HandoffAcceptResponse;
        if (!res.ok || !(json as any)?.ok) {
          throw new Error((json as any)?.error || "Handoff failed");
        }

        const data = json as Extract<HandoffAcceptResponse, { ok: true }>;
        if (cancelled) return;

        // Apply fields
        const bInput = String(data.fields.beneficiaryInput ?? "").trim();
        if (bInput) {
          setBeneficiaryInput(bInput);
          setBeneficiaryPrefilled(true);
          setPrefillResolved(false); // allow the resolve effect to run once
        }

        if (data.fields.beneficiaryAddress && isAddress(data.fields.beneficiaryAddress)) {
          setBeneficiaryAddress(data.fields.beneficiaryAddress);
          setResolveMsg(`Prefilled → ${short(data.fields.beneficiaryAddress)}`);
          setPrefillResolved(true); // no need to resolve if we already have 0x
        }

        if (typeof data.fields.amount === "string" && data.fields.amount.trim()) {
          setAmount(String(data.fields.amount));
        }

        if (typeof data.fields.memo === "string") {
          setMemo(String(data.fields.memo));
        }

        if (typeof data.fields.returnUrl === "string") {
          setReturnUrl(String(data.fields.returnUrl));
        }

        if (typeof (data.fields as any).deadline === "string") {
          setDeadline(String((data.fields as any).deadline));
        }

        // Optional: show a tiny confirmation
        setNotice({ type: "ok", msg: "Routed via handoff token." });

        // Clear token from URL so refresh doesn't re-consume it
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
  }, [router, sp.get("h"), sp.get("handoff"), sp.get("token")]);

  // Prefill from query params once on mount (legacy non-token prefill)
  useEffect(() => {
    const b = sp.get("beneficiary");
    const a = sp.get("amount");
    const m = sp.get("memo");
    const r = sp.get("return");

    if (b) {
      setBeneficiaryInput(safeDecode(b));
      setBeneficiaryPrefilled(true);
      setPrefillResolved(false);
    }
    if (a) setAmount(safeDecode(a));
    if (m) setMemo(safeDecode(m));
    if (r) setReturnUrl(safeDecode(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If beneficiary was prefilled, resolve it exactly once (no keystroke spam)
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

  async function onCreate() {
    setNotice(null);

    if (!isConnected) return setNotice({ type: "err", msg: "Connect your wallet first." });
    if (!publicClient) return setNotice({ type: "err", msg: "Client not ready. Refresh and try again." });

    const b = beneficiaryInput.trim();
    let beneficiary0x: `0x${string}` | null = null;

    if (isAddress(b)) {
      beneficiary0x = b as `0x${string}`;
    } else if (beneficiaryAddress) {
      beneficiary0x = beneficiaryAddress;
    }

    if (!beneficiary0x) {
      return setNotice({
        type: "err",
        msg: "Enter a valid beneficiary (0x… / ENS / name.base) and wait for it to resolve.",
      });
    }

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
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {resolving ? "Resolving…" : resolveMsg}
              </div>
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

          {returnUrl ? (
            <p style={{ fontSize: 12, opacity: 0.75, marginTop: -4 }}>
              Return after escrow:{" "}
              <a className="underline" href={returnUrl} target="_blank" rel="noreferrer">
                {returnUrl}
              </a>
            </p>
          ) : null}

          <button onClick={onCreate} disabled={isPending || resolving || !beneficiaryReady}>
            {isPending ? "Submitting..." : resolving ? "Resolving..." : "Create escrow"}
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
