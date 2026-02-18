import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

// Read-only TrustRoute surface for Payments.chat
const TR_STATS_KEY = "trustroute:payments:stats";

export async function GET() {
  try {
    const stats = await kv.hgetall<Record<string, string>>(TR_STATS_KEY);

    // Normalize numbers + timestamps
    const normalized = {
      intentsCreated: Number(stats?.intentsCreated ?? 0),
      proofsLinked: Number(stats?.proofsLinked ?? 0),
      settled: Number(stats?.settled ?? 0), // optional / future
      lastActivityAt: stats?.lastActivityAt ?? null,
      version: "trustroute-v0.1",
      surface: "payments",
    };

    return NextResponse.json(
      { ok: true, stats: normalized },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Failed to read TrustRoute stats" },
      { status: 500 }
    );
  }
}
