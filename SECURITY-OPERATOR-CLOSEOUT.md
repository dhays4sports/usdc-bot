# Credential and legacy-contract operator closeout

Reviewed 2026-10-10 UTC against main `acac6c600239060fdba237dbdfa33b8534dfa415` and PR #1 `9543cd78d698a9e6e5ae8a5b00171e29e1bea461`. This checklist is NOT execution approval. No credentials were tested, rotated or revoked; no deployment, wallet or contract write was performed. No provider log connection is available here.

## Current status

Main still tracks `web/.env.local`. PR #1 deletes it; history, clones, forks, build artifacts and deployed environment snapshots remain potentially exposed after merge. No active credential, provider-confirmed revocation or incident-free interval has been established. Database credentials remain UNKNOWN. The Vercel OIDC token's unverified payload says it expired on 2026-02-11 at 08:30:18 UTC; this is not issuer verification and does not settle historical misuse or downstream sessions.

| Exposed category | Required provider-side action after separate approval | Completion evidence |
|---|---|---|
| `KV_REST_API_TOKEN` | Reset the affected Upstash Redis database password / revoke standard token. Identify actual database and owner first; do not confuse legacy Vercel KV with a separate database. | Provider reset event, old standard token authentication rejected, replacement works |
| `KV_REST_API_READ_ONLY_TOKEN` | Revoke with the same database password reset; read-only access can expose private records. Verify separately. | Old read-only token rejected; replacement has intended restricted scope |
| `KV_URL`, `REDIS_URL` | Replace every password-bearing connection string for the affected database, including duplicate aliases and any separately issued ACL users. | Old native Redis authentication rejected on fresh connections; existing sessions addressed per provider guidance |
| `VERCEL_OIDC_TOKEN` | Do not treat this as a Vercel personal API token. Review issuer/audience/subject/project/environment trust and downstream token exchanges during its validity interval. Revoke any affected downstream sessions/credentials if supported and necessary. | Issuer/signature and expiry verification, downstream audit disposition and session revocation evidence or explicit UNKNOWN |
| Endpoint and `NEXT_PUBLIC_*` configuration | Endpoints/addresses are not automatically secrets. Check for account keys and restrictions privately. Rotate only an actual exposed credential. Never place replacements in public variables. | Private service/configuration inventory with network and project mapping |

## Ordered operator procedure

1. Assign an incident owner. Through an authorized Vercel/Upstash account, privately map database IDs, project/team IDs, integration ownership, affected environments and credential aliases. Preserve relevant logs before retention expires. Record first public exposure and last known use without copying tokens into tickets.
2. Obtain separate approval for rotation, deployment changes and any temporary service restriction. Plan a short maintenance window if reset is immediate; do not keep compromised credentials valid merely for convenience. Preserve business data and pending obligations. No database deletion/reset-of-data is proposed.
3. In Upstash's affected Redis database settings, reset its password. Upstash documents that this revokes both standard and read-only REST tokens. If another Redis operator/ACL is involved, use that operator's revocation mechanism. Do not assume resetting one database covers other databases or ACL users. Ask provider support about already-authenticated connection invalidation where unclear.
4. Store replacement values in the authorized secret manager. Update Vercel Production, Preview, Development, custom environments and branch overrides; check shared/team variables, Marketplace integration sync, local developer copies, CI secrets, scheduled jobs and other consumers. Check whether integration-managed aliases repopulate stale values. Do not log values or include them in shell history, command arguments, screenshots or this repository.
5. Environment edits affect subsequent deployments. An authorized operator must redeploy affected consumers, verify environment targeting, and review older deployment URLs/aliases. Retire or restrict old deployments where approved; rollback must use a known-safe build with new credentials, not an old secret snapshot. Review build logs, downloadable artifacts and cached client bundles for unintended disclosure.
6. From a private approved verification harness, with tracing disabled and values injected securely, use non-mutating authentication probes: REST PING (or an allowed GET of a synthetic nonexistent key for a read-only token) and fresh TLS Redis AUTH/PING. Test each OLD standard token, OLD read-only token and OLD password independently. Expected result is an explicit provider authentication rejection (401/WRONGPASS or documented equivalent). Timeout, network error, rate limit, missing key, command-not-permitted or unavailable service is INCONCLUSIVE, not revocation proof. Verify each replacement succeeds with intended scope. Do not enumerate/read customer records or exercise write commands to prove rejection.
7. Record UTC time, database/project/environment ID, credential category/version identifier, probe type and redacted status only. Confirm no old credential is accepted anywhere in scope. Do not assume rotation invalidates existing pooled connections; verify provider behavior and restart consumers if authorized. If direct testing of an old OIDC token is inappropriate, use offline signature/claims validation plus downstream provider records; do not mint new live sessions solely to test it.
8. Review available Vercel deployment/build/runtime/audit records, Upstash usage/access/security records and downstream OIDC exchange logs for the exposure window. Check unexplained access, volume, changed/deleted payment/authorization records and cross-environment use. Provider logging may not include per-command or historical records: document retention/coverage gaps. No finding is not proof of no compromise. Escalate integrity/privacy impact through the operator's incident process.
9. Close only when revocation, deployment verification and incident disposition have evidence. Otherwise preserve UNKNOWN. Merge hygiene independently when reviewed; it reduces future exposure but does not certify remediation. Consider approved history cleanup only after revocation; it cannot remove outside copies. No automatic Git history rewrite.

## Historical coordinator inventory and read-only follow-up

| Chain | Coordinator | Current bytecode/state, balances, transactions, obligations |
|---|---|---|
| Base 8453 | `0x069384fb28e6f0c67b5f32cfd4fd228d53fe4489` | UNKNOWN |
| Base 8453 | `0xf5c4724ff44fd111379ec47efb92c0b769edcfa6` | UNKNOWN |
| Base Sepolia 84532 | `0x069384fb28e6f0c67b5f32cfd4fd228d53fe4489` | UNKNOWN |

Dry-run records additionally predict `0x5b73c5498c1e3b4dba84de0f1833c4a029d90519` on both chains without transaction hashes. These are uncertain leads, not confirmed deployments; read-only address retrieval also failed for both. Inventory comes from historical broadcast records, not proof of current deployment. October 10 read-only Blockscout address, token-balances and transactions requests failed for all three pairs; Basescan pages were inaccessible. Prior public Base RPC attempts also failed. No balances were established as zero.

An authorized read-only follow-up should pin chain ID, finalized block number/hash and observation time; fetch deployment receipt/runtime bytecode and compare against documented source; inspect coordinator token, fee recipient, fee rate, next escrow ID and each recorded escrow; query native and token balances; enumerate creation/funding/release/refund events from deployment through the pinned block with complete pagination; reconcile funded-but-unreleased/refunded amounts plus residual fees against balances. Include all tokens, not only configured USDC. A positive token balance may be unsolicited; a zero balance does not erase outstanding claims. Fee setter calls/history matter because these setters lack access control. Record missing event ranges, RPC limitations and unresolved counterparties.

Do not fund, release, refund, change fees, upgrade or deploy. If active funds or users are found, preserve evidence and escalate to specialized contract/security review. The historical coordinator remains unsafe for new real-money use.

## Hygiene verification and limits

PR removal verified; generalized `.env*` ignore rule now covers named environments and allows only example/sample/template filenames. Tracked-file guard reports zero findings; five isolated synthetic cases cover environment rejection, Redis password, JWT, private key and a benign file, without echoing input values. These are bounded checks, not exhaustive history scanning. Example files must contain placeholders; the scanner cannot recognize every arbitrary opaque provider token. Provider-confirmed secret scanning remains a separate control.

## Primary documentation consulted 2026-10-10

- https://upstash.com/docs/redis/features/restapi — standard/read-only tokens and password-reset revocation.
- https://upstash.com/docs/redis/troubleshooting/http_unauthorized — authentication rejection diagnostics.
- https://vercel.com/docs/environment-variables/managing-environment-variables — redeployment required for changed variables.
- https://vercel.com/docs/oidc and https://vercel.com/docs/oidc/reference — token issuance and environment/runtime use.
