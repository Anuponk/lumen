# Lumen / SoldeZen authentication separation (issue #225)

## Verified architecture
Lumen and SoldeZen share a Supabase Auth project. Supabase's project-level email sender, subject and templates are shared configuration. A browser-supplied URL is not a trusted app identity, so replacing the shared template with Lumen branding would incorrectly rebrand SoldeZen and cannot guarantee isolated identity.

## Current safe incremental change
- Lumen Google OAuth already supplies an explicit redirect URL.
- Lumen email OTP now supplies an explicit Lumen-origin `emailRedirectTo` (from the UI current origin), rather than leaving the provider to use its project-wide default Site URL.
- **This does not fix the branding of Auth emails.** The global email template still controls it, and allowlisted redirect URLs in Supabase Auth must include all intended Lumen origins.
- No auth schema or existing account was migrated.

## Architecture decision required before claiming #225 resolved
Select an authenticated, server-controlled brand-specific delivery path (or split Supabase Auth projects with a verified account/progress migration). Reject any unauthenticated `brand` parameter as proof of origin. Test confirmation, recovery, email change and invitations on BOTH Lumen and SoldeZen, including OAuth, old sessions, redirects, no mixed branding, RLS and player/account analytics isolation. Do not change shared templates unilaterally.

## Release checks
Test an email OTP from `https://lumen.nopuna.fr` and verify its return URL and preserved progression. Verify the same unchanged flows for SoldeZen. Validate allowed redirect URLs with the Supabase Auth config and E2E account migration with isolated test users before enabling any branding changes.
