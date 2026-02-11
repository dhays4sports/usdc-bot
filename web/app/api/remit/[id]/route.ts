import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KEY = (id: string) => `remit:${id}`;

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const rec = await kv.get(KEY(id));
  if (!rec) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(rec, { status: 200 });
}
