import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { rateLimit } from "@/lib/rateLimit";

const KEY = (id: string) => `payment:${id}`;

// TrustRoute v0.1 aggregate stats for this surface
const TR_STATS_KEY = "tr:stats:payments.chat";

async function trIncr(fields: Record<string, number>) {
  try {
    await kv.hincrby(TR_STATS_KEY, fields);
    await kv.hset(TR_STATS_KEY, { lastActivityAt: new Date().toISOString() });
  } catch {
    // Best-effort only
  }
}

function newId() {
  return (
    Math.random().toString(36).slice(2, 12) +
    Math.random().toString(36).slice(2, 6)
  );
}

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

type Settlement =
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: `0x${string}` };

export async function POST(req: Request) {
  try {
    const rl = await rateLimit({
      surface: "payments",
      action: "create",
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

    const body = await req.json();

    const payeeInput = String(body.payeeInput ?? "").trim();
    const payeeAddress = String(body.payeeAddress ?? "").trim();
    const amount = String(body.amount ?? "").trim();
    const memo = String(body.memo ?? "").trim();

    if (!is0x40(payeeAddress)) {
      return NextResponse.json({ error: "Invalid payee address" }, { status: 400 });
    }

    const n = Number(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (memo.length > 180) {
      return NextResponse.json({ error: "Memo too long" }, { status: 400 });
    }

    const id = newId();

    const rec: {
      id: string;
      createdAt: string;
      updatedAt?: string;
      status: "proposed" | "linked" | "settled";
      network: "base";
      asset: "USDC";
      amount: string;
      memo?: string;
      payee: { input: string; address: `0x${string}` };
      settlement?: Settlement;
      context?: any;
      version: string;
    } = {
      id,
      createdAt: new Date().toISOString(),
      status: "proposed",
      network: "base",
      asset: "USDC",
      amount,
      memo: memo || undefined,
      payee: {
        input: payeeInput,
        address: payeeAddress as `0x${string}`,
      },
      settlement: undefined,
      context: body?.context ?? undefined,
      version: "v0.1",
    };

    await kv.set(KEY(id), rec);

    // TrustRoute v0.1: aggregate "created"
    await trIncr({
      totalCreated: 1,
      proposed: 1,
    });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
