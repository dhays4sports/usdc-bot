import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { newAuthId } from "@/lib/authId";
import type { PermissionGrant, PermissionAction } from "@/lib/authTypes";

const KEY = (id: string) => `auth:${id}`;

function isAction(v: string): v is PermissionAction {
  return [
    "remit:create",
    "remit:link_settlement",
    "usdc:create_escrow",
    "usdc:release_escrow",
    "usdc:refund_escrow",
  ].includes(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const principalId = String(body?.principalId ?? "").trim();
    const agentId = String(body?.agentId ?? "").trim();
    const action = String(body?.action ?? "").trim();

    if (!principalId) return NextResponse.json({ error: "principalId required" }, { status: 400 });
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
    if (!isAction(action)) return NextResponse.json({ error: "invalid action" }, { status: 400 });

    const id = newAuthId();
    const now = new Date().toISOString();

    const grant: PermissionGrant = {
      id,
      createdAt: now,
      version: "mvv-0.1",
      status: "active",
      principal: { type: "human", id: principalId },
      agent: { id: agentId, label: body?.agentLabel ? String(body.agentLabel) : undefined },
      action,
      constraints: body?.constraints ?? undefined,
      expiresAt: body?.expiresAt ? String(body.expiresAt) : undefined,
    };

    await kv.set(KEY(id), grant);
    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/authorize crashed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
