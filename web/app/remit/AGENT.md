# remit.bot — Agent Surface

This surface extends the global AGENT.md contract.

## Purpose
remit.bot is a neutral coordination and receipt layer for remittance workflows.
It represents intent, metadata, and traceability — not money movement.

## Agents MAY
- Create remittance records
- Read remittance state and metadata
- Attach references to external settlement systems
- Generate receipts and identifiers

## Agents MAY NOT
- Transmit funds
- Custody assets
- Set exchange rates
- Guarantee delivery or settlement

## Guarantees
- No value transfer
- Immutable receipts
- Explicit linkage to external execution

remit.bot records *what should happen*, not *what did happen*.
