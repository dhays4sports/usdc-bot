import { NextResponse } from "next/server";

type Input = {
  action?: string;
  amount?: string | number;
  asset?: string;
  recipient?: string;
  context?: any;
};

function isAddr(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

// MVV policy: allow only <= 50 USDC, require valid recipient.
// You can expand this into per-policy KV later.
export async function GET() {
  return NextResponse.json(
    { ok: true, hint: "POST JSON { action, amount, asset, recipient, context }" },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Input;

    const action = String(body.action ?? "").trim() || "unknown";
    const asset = String(body.asset ?? "USDC").trim();
    const amountNum = Number(String(body.amount ?? "").trim());
    const recipient = String(body.recipient ?? "").trim();

    if (!asset || asset !== "USDC") {
      return NextResponse.json(
        { allow: false, policyId: "policy.asset.only-usdc", reason: "Only USDC supported in MVV." },
        { status: 200 }
      );
    }

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { allow: false, policyId: "policy.amount.invalid", reason: "Amount must be a positive number." },
        { status: 200 }
      );
    }

    if (!isAddr(recipient)) {
      return NextResponse.json(
        { allow: false, policyId: "policy.recipient.invalid", reason: "Recipient must be a valid 0x address." },
        { status: 200 }
      );
    }

    const MAX = 50;
    if (amountNum > MAX) {
      return NextResponse.json(
        {
          allow: false,
          policyId: "policy.amount.max",
          reason: `Amount exceeds MVV limit (${MAX} USDC).`,
          constraints: { maxAmount: MAX },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { allow: true, policyId: "policy.mvv.pass", reason: `Allowed for action: ${action}.` },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/authorize crashed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
