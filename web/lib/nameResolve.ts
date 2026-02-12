export async function resolveNameToAddress(input: string): Promise<
  | { ok: true; address: `0x${string}`; label?: string }
  | { ok: false; message: string }
> {
  const v = input.trim();
  if (!v) return { ok: false, message: "Enter a wallet address or name." };

  const res = await fetch(`/api/resolve?input=${encodeURIComponent(v)}`, {
    method: "GET",
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!json) return { ok: false, message: "Resolver error." };
  if (json.ok) return { ok: true, address: json.address, label: json.label };
  return { ok: false, message: json.message || "Could not resolve." };
}
