# authorize.bot — Agent Contract (v1)

**Purpose**
authorize.bot is a neutral authorization + proof receipt layer.
It stores authorization intent, and optionally links on-chain proof.
It does not custody funds, execute approvals, or guarantee outcomes.

**Base URL**
- Production: https://authorize.bot
- API base: https://authorize.bot/api

**Data model**
AuthorizationRecord:
- id (string)
- createdAt (ISO string)
- updatedAt (ISO string, optional)
- version: "mvv-1"
- status: "proposed" | "linked" | "revoked"
- network: "base"
- asset: "USDC"
- spender: { input: string, address: 0x-address }
- scope (string)
- limit (string, optional)
- expiresAt (ISO string, optional)
- memo (string, optional)
- proof (optional):
  - { type: "basescan_tx", value: 0x64-txhash }
  - { type: "usdc_bot_receipt", value: "https://usdc.bot/e/[id]" }

---

## Tools (HTTP)

### 1) Create authorization
**POST** `/api/authorize`

Body (JSON):
{
  "spenderInput": "vitalik.eth",
  "spenderAddress": "0x…",
  "scope": "Approve USDC spend",
  "limit": "250 USDC",
  "expiresAt": "2026-12-31T23:59:59Z",
  "memo": "Invoice #1042"
}

Response:
{ "ok": true, "id": "abc123-xyz" }

Rules:
- spenderAddress MUST be a valid 0x address
- scope is required
- If proof is included, status becomes "linked", otherwise "proposed"

---

### 2) Read authorization
**GET** `/api/authorize/{id}`

Response: AuthorizationRecord

---

### 3) Link or replace proof
**PATCH** `/api/authorize/{id}`

Body (JSON):
{
  "proof": { "type": "basescan_tx", "value": "0x…64" }
}

OR:
{
  "proof": { "type": "usdc_bot_receipt", "value": "https://usdc.bot/e/123" }
}

Response:
{ "ok": true }

Rules:
- On success, status becomes "linked"

---

### 4) Revoke authorization
**PATCH** `/api/authorize/{id}`

Body (JSON):
{ "action": "revoke" }

Response:
{ "ok": true }

Rules:
- On success, status becomes "revoked"

---

## Agent integration (under 10 minutes)

1) Resolve spender input to a 0x address (ENS/basename is supported by the UI; agents should resolve externally or accept 0x).
2) POST `/api/authorize` to create a record.
3) Present receipt URL to user:
   - https://authorize.bot/authorize/a/{id}
4) After the user completes the on-chain action, PATCH proof:
   - tx hash OR usdc.bot receipt URL

---

## Safety / Constraints
- No custody, no approvals executed by authorize.bot
- Records are append/update-only via PATCH (proof or revoke)
- Treat “linked” as “proof attached”, not “proof verified”
