import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function GET() {
  const h = await headers();

  const host = (
    h.get("x-forwarded-host") ??
    h.get("host") ??
    h.get("x-vercel-forwarded-host") ??
    ""
  )
    .toLowerCase()
    .split(",")[0]
    .trim();

  // ---- usdc.bot ----
  if (host === "usdc.bot" || host === "www.usdc.bot") {
    return NextResponse.json({
      domain: "usdc.bot",
      surface_type: "execution",
      description: "Non-custodial USDC escrow and settlement execution on Base.",
      human_required: true,
      capabilities: [
        "createEscrow",
        "getEscrow",
        "resolveRecipient",
      ],
      verification_model: "onchain",
      linked_surfaces: ["remit.bot", "authorize.bot"],
    });
  }

  // ---- remit.bot ----
  if (host === "remit.bot" || host === "www.remit.bot") {
    return NextResponse.json({
      domain: "remit.bot",
      surface_type: "coordination",
      description: "Neutral remittance record, receipt, and settlement proof coordination.",
      human_required: false,
      capabilities: [
        "createRemittance",
        "getRemittance",
        "linkSettlement",
        "replaceSettlement",
      ],
      verification_model: "hybrid",
      linked_surfaces: ["usdc.bot", "authorize.bot"],
    });
  }

  // ---- authorize.bot ----
  if (host === "authorize.bot" || host === "www.authorize.bot") {
    return NextResponse.json({
      domain: "authorize.bot",
      surface_type: "authorization",
      description: "Agent authorization, delegation, and execution permission gating.",
      human_required: true,
      capabilities: [
        "createAuthorization",
        "revokeAuthorization",
        "linkProof",
      ],
      verification_model: "explicit",
      linked_surfaces: ["usdc.bot", "remit.bot"],
    });
  }

  // ---- fallback (never 500) ----
  return NextResponse.json(
    { error: "Unknown host" },
    { status: 400 }
  );
}
