# Cloud-first cutover checklist (PR #238)

## Invariant
Quests 1–5 may be played without an account. Once a player authenticates, Supabase profile snapshots are the sole authority. An existing snapshot is **never** replaced by the browser's guest state on login. Quest 6 remains locked until account sync is verified.

## Deployment order
1. Verify an independent, recoverable backup of `lumen.profile_snapshots` and of relevant legacy progress tables. Verify the count of existing profiles before/after. Do not copy player payloads to logs.
2. Deploy and test the *additive* migration `20261010_lumen_cloud_first_cas.sql` (create-once + compare-and-swap). **Do not revoke** the old `lumen_backup_profile` at this preparation stage: existing production clients still call it.
3. Exercise isolated test accounts: first login after quest 5, re-login with newer cloud state, cloud unavailable, stale second-device mutation, interrupted import, reload and cached PWA. Confirm all quests, badges, stars, shards and XP survive.
4. Ensure gameplay *does not announce or advance an authenticated win* before its full reward snapshot is durably accepted. Pending/failing writes must remain visible and retryable; a competing device must never overwrite the current server state. This release is BLOCKED until this invariant has an end-to-end browser test.
5. Merge/deploy only after the exact head SHA has passing CI, cloud persistence tests and human staging checks on both Vercel and o2switch. Prevent an older PWA/cache from sending unconditional writes during migration.
6. Once old clients have aged out or been forced to update and a rollback strategy is confirmed, revoke execute on `public.lumen_backup_profile(jsonb)` from `authenticated` in a **separate maintenance action**. Check no legacy calls remain before revocation.
7. Validate profile counts, restore success, authentication gate, progression continuity and errors. If failing, stop rollout rather than replacing authoritative snapshots with local copies.

## Rollback constraints
The additive RPC migration is backwards-compatible. Revoking legacy writes early is not. Do not roll back the client alone after legacy RPC revocation; restore the previous grants only as part of an explicitly controlled rollback and verify newer snapshots are preserved.

## Release blocker
Passing CI alone is not sufficient until atomic win/reward acknowledgement is wired into gameplay. The current background `scheduleCloudProfile` timer does not satisfy that guarantee.
