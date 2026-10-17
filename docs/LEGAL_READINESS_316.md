# Issue #316 — Legal readiness audit (working document)

Status: **NOT APPROVED FOR GOOGLE PLAY SUBMISSION**. This is an evidence checklist, not a legal certification.

## Confirmed product decisions (2026-10-17)
- Lumen is free to play, without advertising or in-app purchases at launch.
- Publisher: existing French *entreprise individuelle* (legal identity/details to be confirmed).
- PWA remains available; Android/Google Play publication is planned.
- No sales terms, Play Billing integration, ad SDK or advertising consent flow should be introduced solely for this release. Reassess if business model changes.

## Repository evidence inspected
- `README.md`, `AGENTS.md`, `docs/DATA_AND_ARCHITECTURE.md`: static ES-module PWA, Supabase cloud persistence, offline guest play.
- `index.html`: Google/email/password account creation, nickname editor, feedback, push opt-in, local guest progress.
- `src/persistence/cloud.js`: RPC calls for user registration, profile, nickname, progress and entitlements.
- `manifest.webmanifest`: standalone PWA.
- Attempts to fetch `privacy.html`, `legal.html`, `mentions-legales.html` returned 404. This does **not** prove no other legal pages exist.
- Full dependency/SDK and server-side SQL audits **not yet completed**.

## Blocking verification matrix
| Area | Evidence required | Status |
|---|---|---|
| Legal notice | EI legal identity, professional contact, hosting details, publication director; accessible in PWA | TODO |
| Privacy policy | Controller, purposes, legal bases, data categories, retention, recipients, international transfers, rights, contact, complaint to CNIL | TODO |
| Processing inventory | Auth, nickname, progress, challenges, feedback, analytics, admin, push tokens, logs, hosting and SDKs; document necessity and retention | TODO |
| Guest/local data | Storage keys, erase/reset procedure, distinction between device and cloud deletion | TODO |
| Account deletion | In-app request, publicly reachable web deletion request, authenticated identity verification, cascading deletion/anonymisation of linked records, exceptions, tests | TODO |
| Rights requests | Access, rectification, erasure, objection, portability where applicable; operational response process | TODO |
| Cookies/SDK | Actual browser storage, telemetry, third-party SDK inventory, consent only where required; essential storage exemption documented | TODO |
| Android | Actual Android package permissions and SDKs, age targeting, Play Data safety, deletion URL, Play policy consistency | TODO |
| IP/licensing | Astronomy catalogue source/attribution, icon, fonts, sounds, libraries, game name trademark clearance | TODO |
| Business | EI activity classification, accounting/tax treatment and professional confirmation of unclear points | TODO |

## Implementation constraints
1. Do not invent EI name, SIREN, address, contact email, hosting address, retention periods, subprocessors or international transfer guarantees.
2. Never offer an unimplemented 'delete account' button or claim deletion is complete without testing cloud tables, Auth, challenges, backups/retention policies and local data.
3. Do not destroy player progression during an audit. Account deletion must be explicit and verified.
4. Preserve cloud persistence invariants in `AGENTS.md` and regression tests for every code change.
5. Complete Android-specific audit against the **actual built package**, not merely PWA files.
6. Re-check Google Play and CNIL guidance at submission time.

## Next implementation slices
1. Inspect repository tree and all backend SQL/functions, analytics, notifications and SDK imports; fill actual processing register.
2. Add accessible legal/privacy pages with verified publisher details, plus links in app and onboarding.
3. Implement and test account deletion including server-side authorization, related data, local cleanup, and external web request route; coordinate #170.
4. Verify SDK/consent behavior, Android permissions, Google Play declarations, IP licenses and screenshots.
5. Close only after acceptance criteria and professional review of unresolved legal/accounting questions.
