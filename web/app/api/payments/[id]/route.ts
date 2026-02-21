// web/app/api/payments/[id]/route.ts
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { rateLimit } from "@/lib/rateLimit";
import { createPublicClient, http, parseEventLogs, parseUnits } from "viem";
import { base } from "viem/chains";

export const runtime = "nodejs";

const KEY = (id: string) => `payment:${id}`;

// TrustRoute v0.1 aggregate stats for this surface
const TR_STATS_KEY = "tr:stats:payments.chat";

async function trIncr(fields: Record<string, number>) {
  try {
    await Promise.all(
      Object.entries(fields).map(([field, inc]) => kv.hincrby(TR_STATS_KEY, field, inc))
    );
    await kv.hset(TR_STATS_KEY, { lastActivityAt: new Date().toISOString() });
  } catch {
    // best-effort only
  }
}

// -------- Settlement normalization (existing) --------

// Accept either:
// - string: tx hash OR usdc.bot receipt OR basescan tx url
// - object: { type, value }
function normalizeSettlement(
  input: any
):
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: `0x${string}` }
  | null {
  if (!input) return null;

  if (typeof input === "string") {
    const v = input.trim();
    if (!v) return null;

    if (/^https?:\/\/(www\.)?usdc\.bot\/e\/[^/?#]+/i.test(v)) {
      return { type: "usdc_bot_receipt", value: v };
    }

    if (v.includes("basescan.org/tx/")) {
      const parts = v.split("/tx/");
      const hash = parts[1]?.split("?")[0]?.split("#")[0]?.trim();
      if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
        return { type: "tx_hash", value: hash as `0x${string}` };
      }
      return null;
    }

    if (/^0x[a-fA-F0-9]{64}$/.test(v)) {
      return { type: "tx_hash", value: v as `0x${string}` };
    }

    return null;
  }

  if (typeof input !== "object") return null;

  const type = String(input.type ?? "").trim();
  const value = String(input.value ?? "").trim();

  if (type === "usdc_bot_receipt") {
    if (!/^https?:\/\/(www\.)?usdc\.bot\/e\/[^/?#]+/i.test(value)) return null;
    return { type: "usdc_bot_receipt", value };
  }

  if (type === "tx_hash" || type === "basescan_tx") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return null;
    return { type: "tx_hash", value: value as `0x${string}` };
  }

  return null;
}

// -------- Auto-link verification helpers (NEW) --------

const ERC20_TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;

function normalizeTxHash(input: any): `0x${string}` | null {
  const s = String(input ?? "").trim();
  if (!s) return null;

  // allow basescan URL
  if (s.includes("basescan.org/tx/")) {
    const hash = s.split("/tx/")[1]?.split(/[?#]/)[0]?.trim();
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) return hash as `0x${string}`;
    return null;
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(s)) return s as `0x${string}`;
  return null;
}

function getUsdcAddress(): `0x${string}` | null {
  const v =
    process.env.USDC_BASE?.trim() ||
    process.env.NEXT_PUBLIC_USDC_BASE?.trim() || // fallback only
    process.env.NEXT_PUBLIC_USDC_BASE?.trim() ||
    "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return null;
  return v as `0x${string}`;
}

function getBaseRpcUrl(): string | null {
  const v =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || // fallback only
    "";
  return v || null;
}

// -------- Routes --------

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rec = await kv.get(KEY(id));
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rec, { status: 200 });
}

/**
 * ✅ NEW: Auto-link by verifying an onchain USDC transfer.
 * POST /api/payments/:id
 * Body: { txHash: "0x..." } OR { txHash: "https://basescan.org/tx/..." }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    // Rate limit (reuse existing action bucket so you don't have to change rateLimit.ts)
    const rl = await rateLimit({
      surface: "payments",
      action: "link_proof",
      req,
      limit: 30,
      windowSec: 60,
    });

    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again soon." },
        { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const txHash = normalizeTxHash(body?.txHash);
    if (!txHash) return NextResponse.json({ error: "Missing/invalid txHash" }, { status: 400 });

    const existing: any = await kv.get(KEY(id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // If already linked, be idempotent
    if (existing?.status === "linked" || existing?.status === "settled") {
      return NextResponse.json({ ok: true, alreadyLinked: true }, { status: 200 });
    }

    const payeeAddr = String(existing?.payee?.address ?? "").trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(payeeAddr)) {
      return NextResponse.json({ error: "Payment record missing payee.address" }, { status: 400 });
    }

    const amountStr = String(existing?.amount ?? "").trim();
    let expected: bigint;
    try {
      expected = parseUnits(amountStr, 6);
    } catch {
      return NextResponse.json({ error: "Payment record has invalid amount" }, { status: 400 });
    }

    const USDC = getUsdcAddress();
    if (!USDC) {
      return NextResponse.json(
        { error: "Server misconfig: missing USDC_BASE (Base USDC token address)" },
        { status: 500 }
      );
    }

    const rpc = getBaseRpcUrl();
    const client = createPublicClient({
      chain: base,
      transport: rpc ? http(rpc) : http(), // viem will try a default if none; set BASE_RPC_URL for reliability
    });

    const receipt = await client.getTransactionReceipt({ hash: txHash }).catch(() => null);
    if (!receipt) return NextResponse.json({ error: "Transaction not found yet" }, { status: 400 });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction failed" }, { status: 400 });
    }

    // Find a matching USDC Transfer(to=payee, value=expected)
    const usdcLogs = receipt.logs.filter(
      (l) => String(l.address).toLowerCase() === String(USDC).toLowerCase()
    );

    const parsed = parseEventLogs({
      abi: ERC20_TRANSFER_ABI,
      logs: usdcLogs,
      eventName: "Transfer",
    });

    const match = parsed.find((ev: any) => {
      const to = String(ev.args?.to ?? "").toLowerCase();
      const value = BigInt(ev.args?.value ?? 0);
      return to === payeeAddr.toLowerCase() && value === expected;
    });

    if (!match) {
      return NextResponse.json(
        { error: "No matching USDC Transfer found for this payment (to/amount mismatch)" },
        { status: 400 }
      );
    }

    const prevStatus = String(existing?.status ?? "proposed");

    const updated = {
      ...existing,
      settlement: { type: "tx_hash", value: txHash },
      status: "linked",
      updatedAt: new Date().toISOString(),
    };

    await kv.set(KEY(id), updated);

    // Count transition once
    if (prevStatus !== "linked" && prevStatus !== "settled") {
      await trIncr({ proofsLinked: 1 });
    }

    return NextResponse.json({ ok: true, linked: true, txHash }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    const rl = await rateLimit({
      surface: "payments",
      action: "link_proof",
      req,
      limit: 20,
      windowSec: 60,
    });

    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again soon." },
        { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const existing: any = await kv.get(KEY(id));
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const settlement = normalizeSettlement(body?.settlement ?? body?.proof);
    if (!settlement) return NextResponse.json({ error: "Invalid settlement" }, { status: 400 });

    const prevStatus = String(existing?.status ?? "proposed");

    const updated = {
      ...existing,
      settlement,
      status: "linked",
      updatedAt: new Date().toISOString(),
    };

    await kv.set(KEY(id), updated);

    if (prevStatus !== "linked" && prevStatus !== "settled") {
      await trIncr({ proofsLinked: 1 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
