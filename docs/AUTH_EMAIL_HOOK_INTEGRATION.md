# Multi-brand Auth email delivery — integration gate (#225)
**Status: classification/test only; NO Send Email Hook deployed or enabled.** Existing Supabase Auth sending remains untouched.

Supabase Send Email Hook replaces default Auth email sending. Its payload contains `email_data.redirect_to`, `email_action_type`, `token` and, for secure email change, extra token/token-hash pairs. See https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

The application-origin classifier in `src/auth/email-brand-routing.js` is a **presentation hint**, not proof of application identity or authorization. It uses exact HTTPS hostname allowlists for Lumen and SoldeZen and returns no brand for unsupported inputs. Only a signed Supabase webhook verified with Standard Webhooks and a controlled delivery service may consume the result. Never use user_metadata.brand or a client-supplied brand in RLS or authorization. The hook must not leak tokens or deliver mail to an unknown origin. Confirm actual SoldeZen domains and every Auth redirect URI before production activation.

## Activation prerequisites
1. Verify registered `redirect_to` values for signup, magic-link/OTP, recovery, email change, invite, reauthentication, and OAuth across **both** apps. The Supabase Auth `site_url` fallback is not sufficient to identify a brand.
2. Implement and unit-test a signed webhook (verify `webhook-id`, `webhook-timestamp`, `webhook-signature` against `SEND_EMAIL_HOOK_SECRET`), enforce body size, reject replay, configure provider credentials as server-only secrets.
3. Ensure complete delivery of both emails in secure email-change flows (new/current token mapping follows Supabase docs). Use neutral language or refuse delivery safely if the brand is ambiguous.
4. Confirm approved per-brand sender domains, legal content, sender reputation and deliverability; safely handle failures without disclosing codes.
5. Run isolated E2E signup, returning signin, recovery, email changes on Lumen **and** SoldeZen; verify redirects and progress restoration.
6. Capture previous Auth config, arrange rollback and alerting, then enable Send Email Hook only after deliberate production approval. A failed hook can block every email-auth flow in both apps.

Run classifier test: `node scripts/auth-email-brand-routing-tests.mjs`.
