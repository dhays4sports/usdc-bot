// web/app/api/hub/preview/route.ts
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Hub Preview Envelope (v0.1)
 * - NO KV writes
 * - Deterministic routing
 * - Uses /api/resolve with ABSOLUTE URL (server-safe)
 */

type HubIntent = "pay" | "invoice" | "refund" | "help" | "unknown";

type HubSurface = "payments.chat" | "invoice.chat" | "refund.chat";
type HubKey = "payments" | "invoice" | "refund";

type HubPreviewResponse = {
  ok: true;
  command: string;
  intent: HubIntent;
  confidence: number; // 0..1
  warnings: string[];
  route: {
    // ✅ your requested shape
    key: HubKey;
    surface: HubSurface;
    path: "/new";
    reason: string;

    // ✅ compatibility for older hub UI code that expects these
    kind?: "surface";
    target?: HubSurface;
  };
  fields: {
    network: "base";
    asset?: "USDC";

    // payments
    payeeInput?: string;
    payeeAddress?: `0x${string}` | null;
    label?: string;
    amount?: string;
    memo?: string;

    // refund v0.1 (useful for UI later)
    merchant?: string;
    tx?: string;
  };
  evidence: {
    parsedBy: "routeintelligence:v0.1";
    parseVersion: "0.1";
    timestamp: string;
    extracted: Record<string, any>;
  };
};

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function isPositiveAmount(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function normalizeCommand(raw: any) {
  return String(raw ?? "").trim();
}

function mkRoute(key: HubKey, surface: HubSurface, reason: string): HubPreviewResponse["route"] {
  return {
    key,
    surface,
    path: "/new",
    reason,
    // compatibility for hub UI that still expects these:
    kind: "surface",
    target: surface,
  };
}

/**
 * PAY parser (strict on purpose)
 */
function parsePay(cmd: string): { amount: string; asset: "USDC"; payeeInput: string; memo?: string } | null {
  const re =
    /^(send|pay)\s+\$?(\d+(?:\.\d+)?)\s*(usdc)?\s+to\s+([^\s]+)(?:\s+(?:for|memo)\s+(.+))?$/i;

  const m = cmd.match(re);
  if (!m) return null;

  const amount = m[2];
  const payeeInput = m[4];
  const memo = m[5]?.trim();

  return {
    amount,
    asset: "USDC",
    payeeInput,
    memo: memo || undefined,
  };
}

/**
 * INVOICE parser (v0.1 minimal)
 */
function parseInvoice(cmd: string): { amount: string; asset: "USDC"; payeeInput?: string; memo?: string } | null {
  const re =
    /^(invoice|create\s+invoice|make\s+invoice)\s+\$?(\d+(?:\.\d+)?)\s*(usdc)?(?:\s+to\s+([^\s]+))?(?:\s+(?:for|memo)\s+(.+))?$/i;

  const m = cmd.match(re);
  if (!m) return null;

  const amount = m[2];
  const payeeInput = m[4]?.trim();
  const memo = m[5]?.trim();

  return {
    amount,
    asset: "USDC",
    payeeInput: payeeInput || undefined,
    memo: memo || undefined,
  };
}

/**
 * REFUND parser (v0.1 minimal)
 */
function parseRefund(cmd: string): { merchant?: string; tx?: string; memo?: string } | null {
  // tx hash
  const txm = cmd.match(
    /^(refund|request\s+refund)\s+(?:tx|transaction)\s+(0x[a-fA-F0-9]{64})(?:\s+(?:for|memo)\s+(.+))?$/i
  );
  if (txm) {
    return { tx: txm[2], memo: txm[3]?.trim() || undefined };
  }

  // merchant
  const mm = cmd.match(/^(refund|request\s+refund)(?:\s+for)?\s+([^\s]+)(?:\s+(?:for|memo)\s+(.+))?$/i);
  if (mm) {
    return { merchant: mm[2], memo: mm[3]?.trim() || undefined };
  }

  return null;
}

async function resolveRecipient(
  req: Request,
  input: string
): Promise<
  | { ok: true; address: `0x${string}`; label?: string }
  | { ok: false; message: string }
> {
  const url = new URL(`/api/resolve?input=${encodeURIComponent(input)}`, req.url);
  const rr = await fetch(url, { method: "GET", cache: "no-store" });
  const json = await rr.json().catch(() => null);

  if (!json) return { ok: false, message: "Resolver error." };
  if (json.ok) return { ok: true, address: json.address as `0x${string}`, label: json.label as string | undefined };
  return { ok: false, message: json.message || "Could not resolve." };
}

export async function POST(req: Request) {
  const rl = await rateLimit({
    surface: "hub",
    action: "preview",
    req,
    limit: 80,
    windowSec: 60,
  });

  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again soon." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const command = normalizeCommand(body.command ?? body.prompt);
    if (!command) return NextResponse.json({ error: "Missing command" }, { status: 400 });

    const warnings: string[] = [];
    let confidence = 0.7;

    // 1) PAY
    const pay = parsePay(command);
    if (pay) {
      confidence = 0.92;

      if (!isPositiveAmount(pay.amount)) {
        confidence = 0.25;
        warnings.push("Invalid amount.");
      }

      const r = await resolveRecipient(req, pay.payeeInput);
      const route = mkRoute("payments", "payments.chat", "Recognized pay/send + amount + recipient → payments");

      if (!r.ok) {
        confidence = 0.25;
        warnings.push(r.message || "Could not resolve recipient.");

        const resp: HubPreviewResponse = {
          ok: true,
          command,
          intent: "pay",
          confidence: clamp01(confidence),
          warnings,
          route,
          fields: {
            network: "base",
            asset: "USDC",
            amount: pay.amount,
            memo: pay.memo,
            payeeInput: pay.payeeInput,
            payeeAddress: null,
          },
          evidence: {
            parsedBy: "routeintelligence:v0.1",
            parseVersion: "0.1",
            timestamp: new Date().toISOString(),
            extracted: { parser: "pay", ...pay },
          },
        };

        return NextResponse.json(resp, { status: 200 });
      }

      const resp: HubPreviewResponse = {
        ok: true,
        command,
        intent: "pay",
        confidence: clamp01(confidence),
        warnings,
        route,
        fields: {
          network: "base",
          asset: "USDC",
          amount: pay.amount,
          memo: pay.memo,
          payeeInput: pay.payeeInput,
          payeeAddress: r.address,
          label: r.label,
        },
        evidence: {
          parsedBy: "routeintelligence:v0.1",
          parseVersion: "0.1",
          timestamp: new Date().toISOString(),
          extracted: { parser: "pay", ...pay },
        },
      };

      return NextResponse.json(resp, { status: 200 });
    }

    // 2) INVOICE
    const inv = parseInvoice(command);
    if (inv) {
      confidence = 0.85;

      if (!isPositiveAmount(inv.amount)) {
        confidence = 0.25;
        warnings.push("Invalid amount.");
      }

      let payeeAddress: `0x${string}` | null = null;
      let label: string | undefined = undefined;

      if (inv.payeeInput) {
        const r = await resolveRecipient(req, inv.payeeInput);
        if (!r.ok) {
          confidence = 0.55;
          warnings.push(r.message || "Could not resolve invoice recipient (optional).");
        } else {
          payeeAddress = r.address;
          label = r.label;
        }
      }

      const resp: HubPreviewResponse = {
        ok: true,
        command,
        intent: "invoice",
        confidence: clamp01(confidence),
        warnings,
        route: mkRoute("invoice", "invoice.chat", "Recognized invoice intent → invoice"),
        fields: {
          network: "base",
          asset: "USDC",
          amount: inv.amount,
          memo: inv.memo,
          payeeInput: inv.payeeInput,
          payeeAddress,
          label,
        },
        evidence: {
          parsedBy: "routeintelligence:v0.1",
          parseVersion: "0.1",
          timestamp: new Date().toISOString(),
          extracted: { parser: "invoice", ...inv },
        },
      };

      return NextResponse.json(resp, { status: 200 });
    }

    // 3) REFUND
    const ref = parseRefund(command);
    if (ref) {
      confidence = 0.8;

      const resp: HubPreviewResponse = {
        ok: true,
        command,
        intent: "refund",
        confidence: clamp01(confidence),
        warnings,
        route: mkRoute("refund", "refund.chat", "Recognized refund intent → refund"),
        fields: {
          network: "base",
          memo: ref.memo,
          merchant: ref.merchant,
          tx: ref.tx,
        },
        evidence: {
          parsedBy: "routeintelligence:v0.1",
          parseVersion: "0.1",
          timestamp: new Date().toISOString(),
          extracted: { parser: "refund", ...ref },
        },
      };

      return NextResponse.json(resp, { status: 200 });
    }

    // 4) Unknown
    confidence = 0.35;
    warnings.push('Could not route. Try: "send $50 usdc to device.eth"');

    const resp: HubPreviewResponse = {
      ok: true,
      command,
      intent: "unknown",
      confidence: clamp01(confidence),
      warnings,
      route: mkRoute("payments", "payments.chat", "Default route (unknown intent) → payments"),
      fields: {
        network: "base",
      },
      evidence: {
        parsedBy: "routeintelligence:v0.1",
        parseVersion: "0.1",
        timestamp: new Date().toISOString(),
        extracted: { parser: "none" },
      },
    };

    return NextResponse.json(resp, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
