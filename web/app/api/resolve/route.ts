import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, fallback } from "viem";
import { mainnet } from "viem/chains";

const rpcPrimary =
  process.env.MAINNET_RPC_URL?.trim() || "https://cloudflare-eth.com";

// A couple no-key fallbacks.
// If one is flaky, the next one catches it.
const rpcFallbacks = [
  "https://cloudflare-eth.com",
  "https://ethereum.publicnode.com",
];

const client = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [rpcPrimary, ...rpcFallbacks].map((url) =>
      http(url, {
        timeout: 10_000, // 10s
        retryCount: 1,
        retryDelay: 250,
      })
    )
  ),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = (searchParams.get("input") || "").trim();

  if (!input) {
    return NextResponse.json({ ok: false, message: "Missing input" }, { status: 400 });
  }

  // Already an address
  if (isAddress(input)) {
    return NextResponse.json({ ok: true, address: input }, { status: 200 });
  }

  // ENS
  if (input.endsWith(".eth")) {
    try {
      const addr = await client.getEnsAddress({ name: input });
      if (!addr) {
        return NextResponse.json(
          { ok: false, message: `No ETH address record set for ${input}.` },
          { status: 200 }
        );
      }
      return NextResponse.json({ ok: true, address: addr, label: input }, { status: 200 });
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, message: `ENS lookup failed: ${String(e?.message ?? e)}` },
        { status: 200 }
      );
    }
  }

  return NextResponse.json(
    { ok: false, message: "Unsupported name. Use a 0x address or .eth for now." },
    { status: 200 }
  );
}

