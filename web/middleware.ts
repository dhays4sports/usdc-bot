import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase() || "";
  const pathname = req.nextUrl.pathname;

  // Only rewrite when the request is coming to remit.bot
  if (host === "remit.bot" || host === "www.remit.bot") {
    // If already on /remit, do nothing
    if (pathname === "/remit" || pathname.startsWith("/remit/")) {
      return NextResponse.next();
    }

    // Rewrite / -> /remit and /x -> /remit/x (URL stays remit.bot)
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/remit" : `/remit${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};

