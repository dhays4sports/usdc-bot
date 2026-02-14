export type AuthProof =
  | { type: "basescan_tx"; value: `0x${string}` }
  | { type: "usdc_bot_receipt"; value: string };

export type AuthorizationRecord = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  version: "mvv-1";

  status: "proposed" | "linked" | "revoked";

  network: "base";
  asset: "USDC";

  // "spender" is the address being authorized to do something
  spender: {
    input: string;              // what user typed
    address: `0x${string}`;      // resolved 0x
  };

  // what is being authorized
  scope: string;                // e.g. "Approve USDC spend"
  limit?: string;               // optional (string for simplicity)
  expiresAt?: string;           // optional ISO

  memo?: string;

  proof?: AuthProof;
};
