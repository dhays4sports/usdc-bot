import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Always clone nextUrl before mutating
  const url = req.nextUrl.clone();
  const host = (req.headers.get("host") || "").toLowerCase();
  const p = url.pathname;

  // Skip Next internals + API + static + well-known
  if (
    p.startsWith("/_next") ||
    p.startsWith("/api") ||
    p.startsWith("/favicon") ||
    p.startsWith("/robots") ||
    p.startsWith("/sitemap") ||
    p.startsWith("/.well-known")
  ) {
    return NextResponse.next();
  }

  // remit.bot -> /remit/*
  if (host === "remit.bot" || host === "www.remit.bot") {
    if (!p.startsWith("/remit")) {
      url.pathname = `/remit${p === "/" ? "" : p}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // authorize.bot -> /authorize/*
  if (host === "authorize.bot" || host === "www.authorize.bot") {
    if (!p.startsWith("/authorize")) {
      url.pathname = `/authorize${p === "/" ? "" : p}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
