export async function resolveNameToAddress(
  input: string
): Promise<
  | { ok: true; address: `0x${string}`; label?: string; avatarUrl?: string | null }
  | { ok: false; message: string }
> {
  const v = input.trim();
  if (!v) return { ok: false, message: "Enter a wallet address or name." };

  try {
    const res = await fetch(`/api/resolve-name?input=${encodeURIComponent(v)}`, {
      cache: "no-store",
    });

    const json = await res.json();
    if (!json?.ok) return { ok: false, message: json?.message || "Could not resolve." };

    return {
      ok: true,
      address: json.address as `0x${string}`,
      label: json.label,
      avatarUrl: json.avatarUrl ?? null,
    };
  } catch {
    return { ok: false, message: "Resolver unavailable. Try again." };
  }
}
