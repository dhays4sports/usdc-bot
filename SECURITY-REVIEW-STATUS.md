# Legacy reference security status
This repository is historical/experimental and is not approved for new real-money use.

The October 2026 Mesh reconciliation found credential exposure and financial authorization issues requiring operator review. Removing tracked environment material does not revoke credentials, remove historical copies, remediate existing deployments or establish that funds are safe.

Operators must review and revoke/rotate potentially exposed credentials through authorized provider access, inspect logs and deployed contracts, and verify remediation. Do not reuse legacy authorization/payment backends or deploy the historical coordinator for production settlement. No production operation is enabled by this hygiene change.

The tracked-file guard is intentionally bounded. It rejects environment files and common private-key, Redis-password and JWT shapes without printing values. It does not replace provider secret scanning, history analysis or security review. Configure provider scanning where available. Do not rewrite public history automatically.
