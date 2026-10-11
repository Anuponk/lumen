## Integration verification matrix — #225

The unit/mock suite exercises the *actual email planner* and Auth Hook handler with fake signed requests, provider responses and a mocked ledger. These tests deliberately make **no real calls** to Supabase or Resend and do not verify live cryptographic signatures or database transactions.

| Scenario | Mock suite | Requires isolated live validation |
|---|---|---|
| Signup Lumen → Lumen sender | Yes | Yes |
| Signup SoldeZen → SoldeZen sender | Yes | Yes |
| Recovery → correct brand | Yes | Yes |
| Forged webhook signature | Mock rejection | Yes, real Standard Webhooks |
| Domain lookalike / missing destination | Yes | Yes |
| Identical webhook delivered twice | Yes | Yes |
| First provider send fails | Yes | Yes |
| Two-recipient secure email-change with failed second send | Yes | Yes |
| Two-recipient replay after both succeed | Yes | Yes |
| Concurrent duplicate requests / claim transaction race | Not yet | Yes, PostgreSQL |
| Provider accepts email but acknowledgement is lost | Pending claim design | Yes, provider audit |
| Actual deliverability, sender domains and reply-to | No | Yes |
| Guest signup and cloud progress restored on another device | No | Yes, both apps |

**Production activation remains forbidden** until an isolated Supabase environment and verified provider test senders are available, manual recovery of pending claims is documented and rehearsed, and a deliberate rollback of the project-wide Send Email Hook is proven. A CI green check is necessary but **not sufficient** to activate this shared authentication infrastructure.

Safe order: validate mock suite → independently review signing/callback/ledger SQL → deploy test-only function and draft SQL in isolated Supabase project → verify every Auth flow and failure mode across both brands → obtain explicit approval before any shared production Auth setting is changed.
