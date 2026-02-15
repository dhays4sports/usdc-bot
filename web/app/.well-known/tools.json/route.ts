import { NextResponse } from "next/server";

function pick(host: string | null) {
  const h = (host ?? "").toLowerCase();
  if (h.includes("remit.bot")) return "/.well-known/tools-remit.json";
  if (h.includes("authorize.bot")) return "/.well-known/tools-authorize.json";
  return "/.well-known/tools-usdc.json"; // default
}

export async function GET(req: Request) {
  const host = req.headers.get("host");
  const path = pick(host);

  const url = new URL(path, req.url);
  const res = await fetch(url);
  const json = await res.json();

  return NextResponse.json(json, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=300",
    },
  });
}
