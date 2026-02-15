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
      tools: [
        {
          name: "createEscrow",
          method: "POST",
          path: "/api/escrow",
        },
        {
          name: "getEscrow",
          method: "GET",
          path: "/api/escrow/{id}",
        },
      ],
    });
  }

  // ---- remit.bot ----
  if (host === "remit.bot" || host === "www.remit.bot") {
    return NextResponse.json({
      tools: [
        {
          name: "createRemittance",
          method: "POST",
          path: "/api/remit",
        },
        {
          name: "getRemittance",
          method: "GET",
          path: "/api/remit/{id}",
        },
        {
          name: "linkSettlement",
          method: "PATCH",
          path: "/api/remit/{id}",
        },
      ],
    });
  }

  // ---- authorize.bot ----
  if (host === "authorize.bot" || host === "www.authorize.bot") {
    return NextResponse.json({
      tools: [
        {
          name: "createAuthorization",
          method: "POST",
          path: "/api/authorize",
        },
        {
          name: "revokeAuthorization",
          method: "PATCH",
          path: "/api/authorize/{id}",
        },
      ],
    });
  }

  return NextResponse.json(
    { error: "Unknown host" },
    { status: 400 }
  );
}
