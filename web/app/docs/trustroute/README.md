TrustRoute v0.1 — Protocol Fields

Namespace: tr:stats:<surface> (Redis hash)

Surface format: DNS host string (examples: payments.chat, remit.bot, authorize.bot, invoice.chat)

Required fields (v0.1)
	•	surface (not stored in hash; returned by API): string
	•	totalCreated: number (monotonic increasing)
	•	totalLinked: number (monotonic increasing)
	•	totalRevoked: number (monotonic increasing, may be omitted if surface doesn’t revoke)
	•	lastActivityAt: ISO8601 string

Optional fields (v0.1)
	•	proposed: number
	•	linked: number
	•	revoked: number
	•	settled: number (if/when you add settled)
	•	lastError: string (best-effort)
	•	lastErrorAt: ISO8601 string

API Contract (v0.1)
Endpoint: GET /api/tr/stats?surface=<surface>

Response:
{
  surface: string;
  stats: Record<string, string | number>;
  message?: string; // "No activity yet" possible
}

Write rules (v0.1)
	•	Writes are best-effort (never break core flows)
	•	Writes must be idempotent on transitions:
	•	only increment “linked” when record moves from proposed → linked
	•	only increment “revoked” when record moves from non-revoked → revoked
	•	Always update lastActivityAt on meaningful events:
	•	create intent
	•	link proof
	•	revoke (if supported)
