export function surfaceApi(path: string) {
  // path should start with "/api/..."
  const p = window.location.pathname;

  if (p.startsWith("/remit")) return `/remit${path}`;
  if (p.startsWith("/authorize")) return `/authorize${path}`;
  if (p.startsWith("/payments")) return `/payments${path}`;

  return path; // default usdc.bot
}
