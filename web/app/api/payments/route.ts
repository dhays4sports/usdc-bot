// web/app/api/payments/route.ts
import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { rateLimit } from "@/lib/rateLimit";
import crypto from "crypto";

export const runtime = "nodejs";

const KEY = (id: string) => `payment:${id}`;

// TrustRoute v0.1 aggregate stats for this surface
const TR_STATS_KEY = "tr:stats:payments.chat";

async function trIncr(fields: Record<string, number>) {
  try {
    await Promise.all(Object.entries(fields).map(([field, inc]) => kv.hincrby(TR_STATS_KEY, field, inc)));
    await kv.hset(TR_STATS_KEY, { lastActivityAt: new Date().toISOString() });
  } catch {
    // best-effort only
  }
}

// Stronger id than Math.random
function newId() {
  return crypto.randomBytes(10).toString("hex"); // 20 chars
}

function is0x40(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

type Settlement =
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: `0x${string}` };

type PaymentIntentRecord = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  status: "proposed" | "linked" | "settled";
  network: "base";
  asset: "USDC";
  amount: string;
  memo?: string;
  payee: {
    input: string;
    address: `0x${string}`;
    label?: string; // optional (nice for display, not required)
  };
  settlement?: Settlement;
  context?: any;
  version: "v0.1";
};

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

    const body = (await req.json().catch(() => ({}))) as any;

    // Inputs
    const payeeInput = String(body.payeeInput ?? "").trim();
    const payeeAddress = String(body.payeeAddress ?? "").trim();
    const amount = String(body.amount ?? "").trim();
    const memoRaw = typeof body.memo === "string" ? body.memo : "";
    const memo = memoRaw.trim();
    const label = typeof body.label === "string" ? body.label.trim() : "";

    // Enforce fixed surface
    const network = "base" as const;
    const asset = "USDC" as const;

    if (!payeeInput) {
      // You *can* loosen this if you want, but it's good hygiene.
      return NextResponse.json({ error: "Missing payee input" }, { status: 400 });
    }

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

    const rec: PaymentIntentRecord = {
      id,
      createdAt: new Date().toISOString(),
      status: "proposed",
      network,
      asset,
      amount,
      memo: memo ? memo : undefined,
      payee: {
        input: payeeInput,
        address: payeeAddress as `0x${string}`,
        label: label ? label : undefined,
      },
      settlement: undefined,
      context: body?.context ?? undefined,
      version: "v0.1",
    };

    await kv.set(KEY(id), rec);

    // TrustRoute v0.1: aggregate "created"
    await trIncr({ intentsCreated: 1 });

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
