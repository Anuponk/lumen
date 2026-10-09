# o2switch staging pilot (issue #196)

## Scope

The existing Lumen production on Vercel remains unchanged. Lumen is a static site: no Next.js build or Node.js runtime is required on o2switch. The deployment uses an independent cPanel document root for **lumen-test.nopuna.fr** only.

## One-time cPanel setup (owner)

1. Create the subdomain `lumen-test.nopuna.fr`, with a **dedicated document root** ending in `/lumen-test`, not a shared `public_html` root.
2. Create/confirm DNS and activate HTTPS (AutoSSL). Wait until `https://lumen-test.nopuna.fr/` resolves with a trusted certificate.
3. Enable SSH for the cPanel account, generate a *dedicated deploy key*, and configure access. Verify that `rsync` is available remotely.
4. Create the dedicated staging directory and validate its absolute path. **Never use the Vercel production URL or a production document root here.**
5. In the GitHub repository, create the environment `o2switch-staging` (prefer required reviewers) and configure its secrets:
   - `O2SWITCH_SSH_HOST`: SSH hostname for your o2switch account
   - `O2SWITCH_SSH_USER`: cPanel SSH user
   - `O2SWITCH_SSH_KEY`: private deploy key, multiline
   - `O2SWITCH_SSH_KNOWN_HOSTS`: independently verified SSH host key entry (do not use blind ssh-keyscan inside CI)
   - `O2SWITCH_STAGING_PATH`: absolute staging directory **ending in /lumen-test**
6. Authorize `https://lumen-test.nopuna.fr/` as an additional redirect origin in Supabase Auth; test Google OAuth, email OTP, session restoration and any configured external callbacks.

## Run pilot

In GitHub Actions select **o2switch staging pilot**, then **Run workflow** on `main`, input `DEPLOY`. This action runs the existing complete quality gate, synchronizes static assets via SSH, records the commit SHA, and checks HTTPS and `sw.js`.

The workflow is deliberately **manual-only** in this pilot: no action on merge, no prod domain rewrite, no DNS switch. Automated release-on-merge, atomic activation, reliable rollback and full E2E checks are later stages, after validating the cPanel environment.

## Risks / checks

- `rsync --delete` runs **only** within the dedicated staging path; do not point it at production or a parent folder. It is not an atomic deployment.
- Ensure no private/secret files are committed at other paths; review release exclusions before triggering.
- Test CDN and Supabase connectivity, MIME for ES modules/manifest, CSP/CORS, PWA install/update/service worker, challenge links and permissions.
- Browser localStorage/PWA cannot migrate between domains automatically. Test signed-in cloud restore and define a plan for guest users before migrating production.
- Review notifications and any server-side push sender separately.
- Confirm static hosting resources, performance, security and cPanel quotas.

## Rollback for pilot

Disable the GitHub workflow and restore the staging directory from a known Git commit manually. Automated rollback is **not implemented** in this initial pilot.
