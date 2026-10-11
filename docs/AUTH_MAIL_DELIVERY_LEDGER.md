# Durable auth email ledger — draft, not activated (#225)

This draft is intentionally fail-closed: a signed webhook recipient is claimed once, then marked sent after the provider confirms delivery. If the sender crashes between claim and acknowledgement, the claim stays **pending**. Automated retries **do not resend it** because we cannot distinguish a pre-send crash from an accepted-but-unacknowledged email. An operator must investigate and recover pending claims after checking provider logs, the event identity and the original recipient.

The ledger records delivery key, SHA-256 fingerprint, state and provider ID; it must not store OTP tokens, recipient emails or full hook payloads. Access is limited to service_role in the draft migration. Never expose its service-role key to a client. The webhook must verify the signed request before computing keys and fingerprints.

**Important limitation:** This provides at-most-once sending, not guaranteed delivery. For a secure email-change requiring two emails, a failure on the second recipient can leave one delivered and the other pending. Do not enable without defining operator recovery and an E2E test of this failure. Provider idempotency keys add defense in depth but do not replace the durable ledger.

Required environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, `LUMEN_AUTH_SENDER`, `SOLDEZEN_AUTH_SENDER`. This repository change MUST NOT run the SQL or deploy/activate the function on production.

Gate: exercise signup, signin, recovery, invite, reauth and both secure email-change recipients in isolated Supabase test project; confirm auth hook payload/signature with official docs and mail provider. Rollback requires reverting Auth Hook configuration first (not deleting the ledger). Do not log tokens, webhook body or provider API credentials.
