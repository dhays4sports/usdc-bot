# AGENT.md — Global Agent Safety Contract (v0.1)

This repository hosts multiple “agent surfaces” (domain-native nodes) that are intended to be:
- human-usable
- agent-callable
- auditable

Surfaces in this repo currently include:
- usdc.bot (execution-adjacent)
- remit.bot (coordination/receipt)
- authorize.bot (authorization/gating)

This document defines the GLOBAL safety rules that apply to ALL surfaces.

---

## 1) Non-Custodial Rule

No surface in this repo may:
- take custody of user funds
- hold private keys
- move funds without an explicit wallet confirmation from the user

All settlement occurs directly on-chain via user-signed transactions.

---

## 2) No Silent Execution

No surface may:
- execute transfers/escrows/approvals automatically
- “simulate” completion by writing a “settled” state without proof
- claim funds moved unless proof is linked

All execution must be:
- user-confirmed (wallet)
- provable (tx hash / receipt link)

---

## 3) Separation of Intent vs Execution

Intent records (coordination) are not execution.

Examples:
- remit.bot records intent and proof links (coordination)
- usdc.bot performs wallet-confirmed execution (execution-adjacent)
- authorize.bot expresses permissions and revocation (authorization)

A coordination record must not be treated as proof of execution.

---

## 4) Proof Handling Rules

Any “proof” fields (tx hash, receipt URL) must be:
- validated syntactically on write
- stored as-is (no rewriting)
- replaceable (never lock the user out)

A proof may be one of:
- a basescan tx hash `0x…` (64 hex chars)
- a usdc.bot receipt URL `https://usdc.bot/e/<id>`

Surfaces should distinguish:
- linked (proof attached)
- verified (optional future: proof confirmed on-chain)

---

## 5) Rate Limits + Abuse Resistance

All write endpoints MUST be rate limited to reduce:
- spam writes
- KV poisoning
- brute force / enumeration

At minimum:
- per-IP throttling
- stricter limits on PATCH/POST than GET

---

## 6) Minimum Disclosure

Surfaces must not expose:
- secrets
- internal keys
- raw provider errors containing sensitive values

Errors returned should be:
- human-readable
- minimal
- safe for logs

---

## 7) Agent Behavior Requirements

A third-party agent interacting with these surfaces must:
- not attempt to bypass user confirmation
- not claim execution unless proof is linked
- not misrepresent “linked” as “settled”
- respect rate limits and back off on 429s

---

## 8) Compatibility Direction (Non-Normative)

These surfaces are designed to evolve toward:
- .well-known agent declarations
- tool exposure via tools.json
- WebMCP-style schemas
- x402-style payment flows

This is a safety-first contract: adoption must never weaken user control.
