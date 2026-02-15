# AGENT.md — Global Agent Contract

This document defines the universal behavioral, safety, and execution guarantees
for all agent-accessible surfaces operated under this repository.

All surfaces (e.g. usdc.bot, remit.bot, authorize.bot) MUST comply with this contract.
Surface-specific documents may extend this contract but may not override it.

---

## 1. Core Principles

### Non-Custodial by Design
- No agent operated by this system may custody funds, private keys, or secrets.
- All value transfer requires explicit user wallet confirmation.
- Agents may prepare, coordinate, and observe — never execute autonomously.

### Explicit Authority
- Agents may not infer authority from context, naming, or prior actions.
- All authority must be explicit, scoped, and time-bound.
- Absence of permission is denial by default.

### Human-in-the-Loop
- Any action with financial, legal, or identity impact requires human confirmation.
- Agents may pause workflows indefinitely awaiting confirmation.

---

## 2. Agent-Safe Surface Requirements

Every agent-accessible surface MUST:

- Be deterministic and side-effect free unless explicitly documented
- Expose read-first, write-later interaction patterns
- Provide clear success and failure states
- Never silently escalate privileges
- Never chain execution across domains implicitly

Surfaces SHOULD:
- Prefer advisory artifacts over executable actions
- Be composable by third-party agents without shared state assumptions

---

## 3. Prohibited Behaviors

Agents MUST NOT:
- Execute transactions without user signature
- Assume custody or settlement responsibility
- Modify authorization scope without explicit consent
- Act on behalf of a user without an authenticated session
- Represent output as final, guaranteed, or authoritative execution

---

## 4. Identity & Attribution

- Agents must identify themselves when interacting with surfaces.
- Surfaces may log agent identifiers for auditability.
- No surface may impersonate a human or another agent.

---

## 5. Failure & Ambiguity Handling

- Ambiguity must halt execution, not guess intent.
- Errors must be surfaced clearly and immediately.
- Partial success must be explicit; silence is failure.

---

## 6. Composability Guarantee

All surfaces are designed to compose safely:
- Across domains
- Across agents
- Across time

No surface may assume it is the final step in a workflow.

---

## 7. Versioning

This contract is versioned implicitly by git history.
Breaking changes require explicit annotation and migration guidance.

---

**This document defines the invariant guarantees of the system.**
