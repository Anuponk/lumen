# Lumen account erasure — issue #316

## Shared authentication boundary

Lumen uses schemas `lumen`, `lumen_commands`, and `lumen_private` in the SoldeZen Supabase project. The Supabase `auth.users` identity is shared across applications: **never call `auth.admin.deleteUser` or delete from `auth.users` for an in-app Lumen erasure request**. Erasure applies only to Lumen-controlled records. Sign out of Lumen after completion.

## Server-side contract (implementation pending)

1. Require an authenticated, recently reauthenticated user and explicit irreversible confirmation. Derive target ID from the verified session, never from a client-supplied ID. Use a server-side privileged endpoint with strict authorization, rate limits, idempotency, and auditable result codes; do not expose service credentials in the browser.
2. Atomically mark Lumen membership as `deleting`/`deleted` before any purge, and reject all Lumen writes, sync flushes, recovery and guest claims for that user from that point forward. The tombstone must be retained without personal game data and must be checked by all write paths. A simple client sign-out is insufficient to prevent stale IndexedDB/outbox replay.
3. Inventory every FK, non-FK owner column, JSON payload, guest key, storage object, support capture and materialized/derived snapshot before deletion. Cover both `lumen` and `lumen_commands` plus Lumen-specific `public` tables. Review `historical_performance.player_key` and social challenge relationships carefully. Never delete another player's participation merely because the sender requests erasure; preserve third-party records only after de-identification.
4. Purge child rows before parents within a transaction or use reviewed FK cascades; avoid blanket schema-wide DELETE and dynamic SQL built from user input. Support safe retries and partial-failure recovery. Keep only the minimal non-identifying deletion tombstone and legally required audit information with a documented retention period.
5. After server acknowledgement, clear Lumen-only IndexedDB, caches, localStorage, outbox and notifications on that device. Do not clear other applications' browser storage or Supabase identities. On every other device, reject stale writes and clear Lumen local state at next contact.
6. Publish a discoverable in-app deletion flow and a publicly reachable external deletion request page for Google Play. Explain that the shared login identity may remain for other apps. Provide a separate path for requesting complete Supabase identity deletion when legally appropriate.

## Verified database inventory (read-only, 2026-11-01)

Schemas found: `lumen`, `lumen_commands`, `lumen_private`. User-linked tables include `lumen.users`, `profiles`, `progress`, `profile_snapshots`, `recovery_backups`, `canonical_reward_events`, `social_challenges`, `social_challenge_participations`, and `lumen_commands` receipts, diagnostics, wallet authorities, support cases, and cohorts. Some tables use `sender_user_id`, `participant_user_id`, `actor`, or `player_key` instead of `user_id`. A foreign-key inventory exists but is not a full data lineage inventory.

## Acceptance checks (all pending)

- Test account with progress, badges, receipts, diagnostics, challenge as sender and participant, and queued offline writes: erasure removes or anonymizes all appropriate Lumen data without touching another player's data.
- Shared Supabase identity and SoldeZen records survive erasure.
- Old devices cannot restore the deleted Lumen account or upload stale receipts; new Lumen use requires an explicit fresh registration and cannot silently resurrect previous progress.
- Multiple deletion requests are idempotent; failures are recoverable; client sees a truthful outcome and can sign out.
- Privacy policy, external deletion URL, consent behavior, retention and Google Play Data Safety are reviewed against implemented behavior; technical audit is not legal approval.

**Status:** design and database inventory only. No production migration, endpoint, UI, erasure test, or legal publication has been completed by this document.
