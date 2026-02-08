"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function ConnectButton() {
  const [mounted, setMounted] = useState(false);

  // IMPORTANT: hooks must always run, every render, in same order
  const account = useAccount();
  const connectState = useConnect();
  const disconnectState = useDisconnect();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <button disabled>Connect wallet</button>;
  }

  const { isConnected, address } = account;
  const { connect, connectors, isPending } = connectState;
  const { disconnect } = disconnectState;

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending || connectors.length === 0}
      >
        {isPending ? "Connecting..." : "Connect wallet"}
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 12, opacity: 0.8 }}>
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}

