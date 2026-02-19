// web/app/api/hub/commit/route.ts
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { mintHandoffToken } from "@/lib/handoff";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "payments",
    action: "create",
    req,
    limit: 60,
    windowSec: 60,
  });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({} as any));

    const aud = String(body.aud ?? "").trim();
    const intent = String(body.intent ?? "").trim();
    const fields = (body.fields ?? {}) as Record<string, any>;
    const path = String(body.path ?? "").trim();

    if (!aud || !intent || !path) {
      return NextResponse.json({ error: "Missing aud/intent/path" }, { status: 400 });
    }

    if (!["payments.chat", "invoice.chat", "refund.chat"].includes(aud)) {
      return NextResponse.json({ error: "Invalid aud" }, { status: 400 });
    }

    const token = mintHandoffToken({
      aud: aud as any,
      intent,
      fields,
      ttlSec: 120,
    });

    const redirect = `https://${aud}${path}?handoff=${encodeURIComponent(token)}`;

    return NextResponse.json({ ok: true, redirect }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", detail: String(err?.message ?? err) }, { status: 500 });
  }
}
