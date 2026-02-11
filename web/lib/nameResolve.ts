export async function resolveNameToAddress(input: string): Promise<
  | { ok: true; address: `0x${string}`; label?: string }
  | { ok: false; message: string }
> {
  const v = input.trim();

  // If it's already an address, accept it
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) {
    return { ok: true, address: v as `0x${string}` };
  }

  // MVV: ENS/Basenames can be added later
  return {
    ok: false,
    message: "Name resolution not enabled yet. Paste a 0x address for now.",
  };
}
