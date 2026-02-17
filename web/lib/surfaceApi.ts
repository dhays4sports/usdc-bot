export function surfaceApi(path: string): string {
  // ensure leading slash
  const p = path.startsWith("/") ? path : `/${path}`;

  // In your current architecture, each surface lives under a path prefix.
  // This helper is meant to be used INSIDE that surface’s routes.
  //
  // So inside /remit/* pages, call surfaceApi("/api/remit/123") -> "/remit/api/remit/123"
  // inside /authorize/* pages -> "/authorize/api/authorize/123"
  // inside /payments/* pages -> "/payments/api/payments/123"

  if (typeof window === "undefined") return p; // server fallback

  const host = window.location.host.toLowerCase();

  if (host.includes("remit.bot")) return `/remit${p}`;
  if (host.includes("authorize.bot")) return `/authorize${p}`;
  if (host.includes("payments.chat")) return `/payments${p}`;

  // default (usdc.bot or preview)
  return p;
}
