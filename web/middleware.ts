import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = (req.headers.get("host") || "").toLowerCase();

  // Don’t interfere with Next internals / APIs / static assets
  const p = url.pathname;
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

  // remit.bot root -> /remit (but allow /remit/* to work normally)
  if (host === "remit.bot" || host === "www.remit.bot") {
    if (!p.startsWith("/remit")) {
      url.pathname = `/remit${p === "/" ? "" : p}`;
      return NextResponse.rewrite(url);
    }
  }

  // authorize.bot root -> /authorize
  if (host === "authorize.bot" || host === "www.authorize.bot") {
    if (!p.startsWith("/authorize")) {
      url.pathname = `/authorize${p === "/" ? "" : p}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

// Apply middleware to everything except next internals
export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
