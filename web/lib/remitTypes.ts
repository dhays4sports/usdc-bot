export type RemitStatus = "proposed" | "linked" | "settled";

export type Settlement =
  | { type: "usdc_bot_receipt"; value: string }
  | { type: "tx_hash"; value: string };

export type RemittanceRecord = {
  id: string;
  createdAt: string; // ISO
  version: "mvv-1";
  status: RemitStatus;

  network: "base";
  asset: "USDC";
  amount: string; // decimal string

  recipient: {
    input: string; // what user typed
    address: `0x${string}`;
    displayName?: string; // ENS/base name if you later add it
  };

  memo: string;
  reference?: string;

  settlement?: Settlement;
};
