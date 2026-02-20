// web/app/api/sms/inbound/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// Optional (recommended): verify Twilio signature
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim() || "";

function twiml(message: string) {
  // Minimal XML escape
  const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

// If you want signature verification, tell me and I’ll drop in the exact code.
// For v0, you can skip it and just rate-limit.
export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const from = String(form.get("From") ?? "").trim();  // +1669...
    const body = String(form.get("Body") ?? "").trim();

    if (!body) {
      return twiml(`Send a command like:\nsend $5 usdc to device.eth`);
    }

    // 1) Preview
    const previewRes = await fetch(new URL("/api/hub/preview", req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: body }),
      cache: "no-store",
    });

    const preview = await previewRes.json().catch(() => null);
    if (!previewRes.ok || !preview?.ok) {
      return twiml(`❌ I couldn’t route that.\nTry:\nsend $5 usdc to device.eth`);
    }

    const aud = preview?.route?.surface ?? preview?.route?.target;
if (!aud) {
  return twiml(`❌ Missing route. Try:\nsend $5 usdc to device.eth`);
}

    // 2) Commit -> get signed handoff redirect
    const aud = preview?.route?.surface ?? preview?.route?.target; // handle both shapes
    const path = preview?.route?.path || "/new";

    const commitRes = await fetch(new URL("/api/hub/commit", req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        intent: preview.intent,
        route: { aud, path },
        fields: preview.fields ?? {},
        context: {
          source: "sms",
          from,
          text: body,
        },
      }),
      cache: "no-store",
    });

    const commit = await commitRes.json().catch(() => null);
    if (!commitRes.ok || !commit?.redirect) {
      return twiml(`⚠️ Routing failed. Try again in a moment.`);
    }

    // IMPORTANT:
    // commit.redirect is currently a path like "/new?h=..."
    // We want to return a fully-qualified URL to the correct domain (audience)
    const host =
      aud === "payments.chat"
        ? "https://payments.chat"
        : aud === "invoice.chat"
        ? "https://invoice.chat"
        : aud === "refund.chat"
        ? "https://refund.chat"
        : "https://payments.chat";

    const link = host + String(commit.redirect);

    // Tight, demo-friendly SMS copy
    return twiml(`✅ Ready.\nTap to continue:\n${link}`);
  } catch (e: any) {
    return twiml(`⚠️ Server error. Try again.`);
  }
}
