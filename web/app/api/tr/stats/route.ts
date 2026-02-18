import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";

/**
 * GET /api/tr/stats?surface=payments.chat
 *
 * Returns aggregate TrustRoute stats for a surface.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const surface = String(searchParams.get("surface") || "").trim();

  if (!surface) {
    return NextResponse.json(
      { error: "Missing surface param (e.g. ?surface=payments.chat)" },
      { status: 400 }
    );
  }

  const key = `tr:stats:${surface}`;

  try {
    const stats = await kv.hgetall<Record<string, string | number>>(key);

    if (!stats) {
      return NextResponse.json(
        {
          surface,
          stats: {},
          message: "No activity yet",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        surface,
        stats,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
