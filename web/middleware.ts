import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").toLowerCase();
  const pathname = req.nextUrl.pathname;

  // ONLY apply to remit.bot
  if (host === "remit.bot" || host === "www.remit.bot") {
    // already under /remit → do nothing
    if (pathname === "/remit" || pathname.startsWith("/remit/")) {
      return NextResponse.next();
    }

    // redirect once: / -> /remit, /new -> /remit/new, etc.
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/remit" : `/remit${pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// avoid touching Next internals + api
export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
