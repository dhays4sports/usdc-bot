// web/app/api/payments/handoff/route.ts
import { NextResponse } from "next/server";
import { consumeHandoffToken } from "@/lib/handoff";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const token = String(body.token ?? "").trim();
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

    const res = await consumeHandoffToken({
      token,
      expectedAud: "payments.chat",
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json(
      {
        ok: true,
        intent: res.payload.intent,
        fields: res.payload.fields,
        exp: res.payload.exp,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", detail: String(err?.message ?? err) }, { status: 500 });
  }
}
