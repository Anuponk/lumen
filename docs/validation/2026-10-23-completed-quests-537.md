# Completed quests and replay holds — #537

Baseline: `72f96a360e46e9255fa4a8cc5d039b1408a5a0e8`, version 1.11.1+495.
Read AGENTS, preserved contracts, PROGRESSION, cloud persistence/matrix,
architecture/debug routes, #470, #398 and the #536 delivery/#530 report.
Coordination: [#537](https://github.com/Anuponk/lumen/issues/537),
[#470](https://github.com/Anuponk/lumen/issues/470),
[#391](https://github.com/Anuponk/lumen/issues/391),
[#398](https://github.com/Anuponk/lumen/issues/398),
[#536](https://github.com/Anuponk/lumen/issues/536).

## Evidence and limits

The report names no exact affected stable quest IDs and contains no local/cloud
pair from the device. A RED UI reproduction is not proof of that player's
complete incident. Do not fabricate a solved flag or remove a cloud gate.

After explicit owner authorization, a minimal read-only production check found
a persisted snapshot containing legacy and canonical completions with a supported
catalogue origin. Recent account health contains mutable-balance and storage-quota
refusals. No complete save, account identifier, balance, receipt or local device
database was retrieved or copied into fixtures. No production data was changed.
The first inspection requests were rejected by automatic approval review; they
were executed only after the owner explicitly authorized these minimal reads.
These results support an actual hydration hold, not a confirmed deleted quest
or a claim that all previously acquired device-only progress is on the server.
Individual counts/telemetry are deliberately omitted from this public report.

Independent exhaustive synthetic inspection, now committed as a regression,
checks every published quest independently as completed. With verified Auth/cloud,
each is ready/replay and its pack is accessible from existing completion evidence,
despite missing earlier prerequisites. Canonical completions intentionally remain
sync-required while hydration is unverified. No catalogue identity remapping,
pack or quest-access policy defect was demonstrated on that input.

## RED and proven cause

The actual production render functions run against a minimal DOM, real catalogue
and synthetic progress. Initial result: five existing checks pass, two new fail.

- `renderMap`: completed canonical title initially contains completion, then
  an unconditional unavailable-canonical override replaces it with only the
  sync reason. Its accessible name also discards completion.
- `renderCanonicalJourneyPreview`: `!available` adds `locked` even when solved,
  producing `puzzle-card done locked` for preserved history. This auxiliary
  renderer is not currently wired to the main detail surface; its RED result
  alone is not evidence of the real player's visible route.
- A further RED assertion proves the touch detail has no visible explanation of
  preserved completions during the hold; a tooltip alone cannot explain it there.

The fix only changes presentation: keep completion alongside the precise action
refusal, reserve the progression-lock class for unfinished quests, and append a
visible hold explanation to the existing constellation note. Badge HTML, counts,
confirmed profile, available decision, disabled buttons, conditional handlers
and direct-start checks are unchanged. No new acquisition, migration, RPC or
writer. No numeric maximum or bypass resolves a wallet difference.

## Validation

Targeted: ten campaign-presentation checks and twenty catalogue-access checks
pass, retaining existing assertions. The latter exercises every current
published stable ID; variable catalogue waves, origins/past catalogues,
unfinished prerequisites, missing pack rights, legacy/canonical evidence and
serialization coverage remain present.

The renderer matrix includes sync/auth holds, verified replay, unsupported origin,
locked unfinished content, and serialized restored copies. Those copies are not
three real physical devices or independent Auth sessions. All before/after
profiles remain identical; guarded direct starts refuse held content.

The native browser helper `completed-quest-hold-browser.mjs`, included in the
existing account suite, passed separately on a new isolated Chrome profile at
390×844 with real touch events. A synthetic Auth/RPC transport delays the read:
completed card/badges and visible reason remain, touching the disabled button
cannot start a new attempt or write a snapshot. After verified hydration, the
same card is replayable with the exact saved canonical entry/badge HTML; a real
touch starts its stable quest ID. It waits for the controlled PWA document so
the initial service-worker installation reload cannot invalidate the test.

Existing source-contract assertions for the historical prerequisite text and
accessible quest label are retained, including their expected source shape.
Full gate/CI results and exact public SHA are recorded in the delivery comments.
Generated browser reports/screenshots are not committed. Independent code review
found no added access/data authority or vacuous completion assertions.

Onboarding impact: no unlock, reward, teaching order, gesture or navigation
destination changes. Existing terms "terminée", "rejouable" and synchronization
are preserved and now displayed together. The sky tour/rules require no update.

## Field validation still required

Keep #537 open pending affected-device confirmation. On the verified public
release, open the previously affected constellation without clearing storage.
Record only stable quest ID, completion presence, action refusal and app/catalogue
version; retry through the existing account sync action if offered. A continued
wallet/quota hold belongs to #391/#398/#536 and must not be bypassed by replay.
Physical Android/PWA, the exact missing device evidence, full cloud recovery and
cross-device identity on the real account remain unverified. Do not edit the real
profile or replay uncertain rewards to force readiness.
