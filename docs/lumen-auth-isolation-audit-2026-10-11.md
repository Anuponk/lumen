# Lumen email authentication isolation audit — 2026-10-11

## Constraint
Do not change SoldeZen email delivery, templates, sender, Supabase Auth settings, or existing login behavior. Resend has verified `nopuna.fr`; a manual API test from `auth@nopuna.fr` was delivered. This proves transport only, not integration with Auth.

## Verified code path (main)
- `index.html`: the account invitation appears after five quests; the UI exposes separate account creation and email login with a six-digit OTP.
- `src/ui/game-screen.js`: account UI calls `createCloudPersistence(...)`, which provides `signIn`, `sendEmailOtp`, `verifyEmailOtp`, and sign-out. Cloud-profile synchronization and guest-to-account migration are coupled to the Auth session.
- `src/persistence/cloud.js`: Google login calls `supabase.auth.signInWithOAuth`; email registration and login both call `supabase.auth.signInWithOtp` with `shouldCreateUser` and `emailRedirectTo`; code verification calls `supabase.auth.verifyOtp({type:"email"})`.
- `supabase/functions/lumen-soldezen-auth-email/index.ts`: prepared multi-brand Send Email Hook sends via Resend, but would be project-wide if enabled. **Do not deploy or enable it.**
- `src/auth/email-brand-routing.js`: `redirect_to` is used to classify a brand; it is not a trustworthy authorization proof.

## Consequence
While Lumen and SoldeZen share one Supabase Auth project, the Auth email sender/templates and Send Email Hook are configured at project level. Changing them for Lumen risks changing the working SoldeZen flow. A frontend-only change cannot make Supabase's existing OTP email come from Lumen. Independently emailing an OTP is not safe: the server must securely mint/manage and verify a valid auth challenge without exposing admin credentials or permitting account takeover.

## Decision required before implementation
1. **Prefer isolation of Auth** for Lumen (dedicated project / Auth provider), with a detailed migration mapping of existing user IDs and external identities and all Lumen-specific RLS/profile tables. Carefully verify access to existing progress before any cutover; no production migration without explicit approval.
2. Alternatively, a server-owned custom Lumen identity/email service can be studied, but must preserve Supabase session semantics and cloud profile ownership and be threat-modeled and tested first. This is **not** solved by merely calling Resend.
3. Shared-project global email hook remains **disallowed** by requirement to keep SoldeZen entirely unchanged.

## Acceptance gate
- No SoldeZen configuration or behavior changes (including fallback paths).
- Lumen signup / login / recovery emails use `auth@nopuna.fr`, with valid OTP verification and Lumen-only redirects.
- Existing Google SSO remains functional, with no account duplication.
- Guest and registered Lumen progress, badges, shards and history remain intact on desktop and mobile.
- Negative tests: OTP replay/expiry, rate limiting, invalid redirect, cross-app account mixing, secret exposure, recovery/email-change.
- E2E demonstrated in isolated test environment; rollback documented and approved before production activation.

## Current status
Audit only. No Auth Hook activated, no live Supabase settings changed, no keys committed, no rollout approved.
