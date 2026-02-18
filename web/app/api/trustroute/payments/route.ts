import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

const TR_STATS_KEY = "tr:stats:payments.chat";

export async function GET() {
  try {
    const stats = await kv.hgetall<Record<string, string>>(TR_STATS_KEY);

    return NextResponse.json(
      {
        ok: true,
        stats: {
          intentsCreated: Number(stats?.intentsCreated ?? 0),
          proofsLinked: Number(stats?.proofsLinked ?? 0),
          settled: Number(stats?.settled ?? 0),
          lastActivityAt: stats?.lastActivityAt ?? null,
          surface: "payments.chat",
          version: "trustroute-v0.1",
        },
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to read TrustRoute stats" },
      { status: 500 }
    );
  }
}
