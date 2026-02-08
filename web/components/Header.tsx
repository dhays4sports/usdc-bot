"use client";

import Link from "next/link";
import ConnectButton from "@/components/ConnectButton";

export default function Header() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <b>usdc.bot</b>
        </Link>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Network: Base Mainnet</span>
      </div>
      <ConnectButton />
    </div>
  );
}
