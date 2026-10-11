# Lumen-only Auth email delivery (PR #272)

This implementation does NOT use the project-wide Send Email Hook or change the shared SMTP settings. No SoldeZen flow is touched.

## Routes
- `POST /functions/v1/lumen-auth-mail` with `{type:"signup",email,password}`: Supabase Admin generate_link, branded confirmation via Resend.
- `{type:"magiclink",email}`: legacy OTP transition; Supabase verifies the OTP client-side.
- `{type:"recovery",email}`: emailed reset link, then Supabase password update.

Google login and the Supabase user ID used by cloud saves are unchanged.

## Production prerequisites — not configured by committing code
- `LUMEN_AUTH_MAIL_ENABLED=true` **only after staging E2E and explicit production approval**. Default is disabled.
- `LUMEN_RESEND_API_KEY`: restricted key for verified `nopuna.fr`.
- `LUMEN_UPSTASH_REDIS_REST_URL`, `LUMEN_UPSTASH_REDIS_REST_TOKEN`: private credentials to a durable Redis limiter.
- Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side only. Never add these secrets to frontend, source, or PR.
- Deploy only `lumen-auth-mail` with JWT verification disabled so unregistered players can request sign-up email. The function checks `Origin`, but origin is **not** an authorization barrier; server-side per-email and global limits are required. Caller-provided IP forwarding headers must not be trusted.
- Existing Supabase Auth SMTP/templates/hook must stay untouched.

## Validation before production
- Signup by email+password produces a Resend email from Lumen, link completes confirmation, and next password login succeeds; an existing email does not acquire a new user ID.
- Google login has no regression.
- Existing OTP-only user can use the legacy path and set a password on the same account.
- Recovery email returns to Lumen and enables updateUser(password), then password login.
- Malformed requests, unsupported origins, excessive per-email/global traffic, missing Redis/Resend credentials and disabled flag fail closed.
- Prove no cross-application impact by exercising one normal SoldeZen email flow without altering its configuration.
- Preserve user ID and the cloud profile; no destructive migration.

## Known caveats
- The Supabase Admin generate_link response and verification routes need live isolated E2E checks for the installed Supabase version.
- This branch has not deployed a function, set any secret or enabled live auth mail.\n- Per-email/global limits reduce bulk sending but are not a substitute for a CAPTCHA/human-verification control and abuse monitoring prior to public release.\n- Server function signup creates an Auth account *before* delivery is confirmed. Assess unconfirmed-account cleanup and retries in E2E without modifying SoldeZen users.
- Password signup is kept **blocked** in production until the backend is deployed and enabled. Do not merge-and-deploy blindly.
