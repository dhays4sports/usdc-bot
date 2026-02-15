export type PermissionAction =
  | "remit:create"
  | "remit:link_settlement"
  | "usdc:create_escrow"
  | "usdc:release_escrow"
  | "usdc:refund_escrow";

export type PermissionStatus = "active" | "revoked" | "expired";

export type PermissionGrant = {
  id: string;
  createdAt: string;
  updatedAt?: string;

  version: "mvv-0.1";
  status: PermissionStatus;

  principal: { type: "human" | "org"; id: string }; // e.g. wallet addr or internal id
  agent: { id: string; label?: string };            // agent identifier (string for now)

  action: PermissionAction;

  // Optional constraints
  constraints?: {
    maxAmountUSDC?: string;      // "100"
    allowDomains?: string[];     // ["remit.bot", "usdc.bot"]
    network?: "base";
  };

  expiresAt?: string; // ISO string
};
