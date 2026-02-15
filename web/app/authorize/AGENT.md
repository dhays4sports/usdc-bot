# authorize.bot — Agent Surface

This surface extends the global AGENT.md contract.

## Purpose
authorize.bot represents scoped authorization intent and approval artifacts.
It is a coordination layer — not an execution engine.

## Agents MAY
- Create authorization records
- Read authorization state
- Attach authorization references to workflows
- Validate scope, expiry, and constraints

## Agents MAY NOT
- Execute transactions
- Escalate or broaden authorization scope
- Assume authorization implies execution rights

## Guarantees
- Non-custodial
- Read-only by default
- Explicit scope and expiration
- Advisory output only

authorize.bot produces authorization artifacts, not outcomes.
