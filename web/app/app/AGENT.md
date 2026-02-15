# usdc.bot — Agent Surface

This surface extends the global AGENT.md contract.

## Purpose
usdc.bot coordinates USDC escrow preparation and inspection.
It exposes safe interfaces for escrow creation and state observation.

## Agents MAY
- Prepare escrow parameters
- Resolve recipient identifiers (ENS, Basename, 0x)
- Read escrow state and events
- Generate transaction previews

## Agents MAY NOT
- Sign transactions
- Move funds autonomously
- Assume settlement completion

## Guarantees
- User-signed execution only
- Deterministic escrow preparation
- Transparent on-chain references

usdc.bot assists execution — it never performs it.
