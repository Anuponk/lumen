## Summary
Describe the change and linked issue.

## Cloud persistence impact (mandatory — #248)
- [ ] I reviewed cloud persistence impact across **all existing player data** (progress, stars, badges, currency, purchased skills, Adventure entitlements), even if this PR is unrelated.
- [ ] I identified changed/new persisted fields, their server/local ownership and restore/merge policy; or explained why not applicable below.
- [ ] I preserved prior saves, cross-device restore and guest-to-account behavior; or explained why not applicable below.
- [ ] I added/updated regression tests for all affected persisted data and retained existing cloud tests; or explained why not applicable below.

**Impact / justification:** <!-- Required: explain what changes, or explicitly state why persistence is unaffected. -->

**Tests executed / results:** <!-- Required: name commands and actual results; mention unrun tests. -->

**Migration / rollback / cloud restore:** <!-- Required: explain old saves and rollback, or N/A with reason. -->

**Command / UI boundary:** <!-- For transactions: operation identity, durable capture, exact receipt/current-profile verification, concurrency/account guards. For pending victories: celebration versus confirmed rewards; navigation projection never saved. -->

**Release evidence:** <!-- Exact SHA/checks; Android real versus simulated; SQL application and deployment require their own authorization. A successful merge is not release verification. -->

## Other validation
- [ ] Applicable non-regression tests run
- [ ] Relevant UI/mobile smoke tests run or N/A
