// web/app/api/hub/preview/route.ts
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

type HubPreviewResponse = {
  ok: true;
  intent: "pay" | "invoice" | "refund";
  route: { kind: "surface"; target: "payments.chat" | "invoice.chat" | "refund.chat"; path: string };
  fields: Record<string, any>;
  confidence: number;
  warnings: string[];
};

function parseHubCommand(raw: string) {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  // VERY SIMPLE routing keywords (tight, deterministic)
  // pay: "send $50 usdc to device.eth"
  const payRe =
    /^(send|pay)\s+\$?(\d+(?:\.\d+)?)\s*(usdc)?\s+to\s+([^\s]+)(?:\s+(?:for|memo)\s+(.+))?$/i;

  // invoice: "invoice $50 usdc to device.eth for design"
  const invRe =
    /^invoice\s+\$?(\d+(?:\.\d+)?)\s*(usdc)?\s+to\s+([^\s]+)(?:\s+(?:for|memo)\s+(.+))?$/i;

  // refund: "refund $50 usdc to device.eth for overcharge"
  const refRe =
    /^refund\s+\$?(\d+(?:\.\d+)?)\s*(usdc)?\s+to\s+([^\s]+)(?:\s+(?:for|memo)\s+(.+))?$/i;

  let m = s.match(invRe);
  if (m) {
    return {
      intent: "invoice" as const,
      amount: m[1],
      asset: "USDC" as const,
      payeeInput: m[3],
      memo: m[4]?.trim() || undefined,
    };
  }

  m = s.match(refRe);
  if (m) {
    return {
      intent: "refund" as const,
      amount: m[1],
      asset: "USDC" as const,
      payeeInput: m[3],
      memo: m[4]?.trim() || undefined,
    };
  }

  m = s.match(payRe);
  if (m) {
    return {
      intent: "pay" as const,
      amount: m[2],
      asset: "USDC" as const,
      payeeInput: m[4],
      memo: m[5]?.trim() || undefined,
    };
  }

  return null;
}

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "payments",
    action: "create",
    req,
    limit: 120,
    windowSec: 60,
  });
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

    const parsed = parseHubCommand(prompt);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Could not parse. Try: "send $50 usdc to device.eth"' },
        { status: 400 }
      );
    }

    const warnings: string[] = [];
    let confidence = 0.92;

    const amt = Number(parsed.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      confidence = 0.25;
      warnings.push("Invalid amount.");
    }

    // Keep preview deterministic: let surfaces resolve if you prefer
    // OR resolve right now using your resolver endpoint:
    const resolveUrl = new URL(`/api/resolve?input=${encodeURIComponent(parsed.payeeInput)}`, req.url);
    const rr = await fetch(resolveUrl, { method: "GET", cache: "no-store" });
    const rj = await rr.json().catch(() => null);

    const payeeAddress = rj?.ok ? (rj.address as `0x${string}`) : null;
    if (!rj) warnings.push("Resolver error.");
    if (rj && !rj.ok) warnings.push(rj.message || "Could not resolve payee.");

    const routeTarget =
      parsed.intent === "pay"
        ? ("payments.chat" as const)
        : parsed.intent === "invoice"
        ? ("invoice.chat" as const)
        : ("refund.chat" as const);

    const path =
      parsed.intent === "pay" ? "/payments/new" : parsed.intent === "invoice" ? "/invoice/new" : "/refund/new";

    const resp: HubPreviewResponse = {
      ok: true,
      intent: parsed.intent,
      route: { kind: "surface", target: routeTarget, path },
      fields: {
        amount: String(parsed.amount),
        asset: "USDC",
        network: "base",
        payeeInput: parsed.payeeInput,
        payeeAddress, // may be null; surface can re-resolve on blur
        memo: parsed.memo,
        context: { source: "hub.chat", mode: "nl", prompt },
      },
      confidence,
      warnings,
    };

    return NextResponse.json(resp, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: "Server error", detail: String(err?.message ?? err) }, { status: 500 });
  }
}
