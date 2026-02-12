import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const MAINNET_RPC =
  process.env.MAINNET_RPC ||
  process.env.NEXT_PUBLIC_MAINNET_RPC ||
  "https://cloudflare-eth.com";

const client = createPublicClient({
  chain: mainnet,
  transport: http(MAINNET_RPC),
});

function isAddress(v: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = (searchParams.get("input") || "").trim();

  if (!input) {
    return NextResponse.json({ ok: false, message: "Missing input" }, { status: 400 });
  }

  // already an address
  if (isAddress(input)) {
    return NextResponse.json({ ok: true, address: input, label: undefined, avatarUrl: null });
  }

  // only try ENS-like names
  if (!input.includes(".") || !input.endsWith(".eth")) {
    return NextResponse.json({
      ok: false,
      message: "Paste a 0x address, or an .eth / .base.eth name.",
    });
  }

  try {
    const address = await client.getEnsAddress({ name: input });
    if (!address) {
      return NextResponse.json({ ok: false, message: `Could not resolve ${input}.` }, { status: 200 });
    }

    let avatarUrl: string | null = null;
    try {
      avatarUrl = await client.getEnsAvatar({ name: input });
    } catch {
      avatarUrl = null;
    }

    return NextResponse.json({ ok: true, address, label: input, avatarUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: `Could not resolve ${input}.` },
      { status: 200 }
    );
  }
}
