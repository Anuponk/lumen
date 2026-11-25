# CI and Codex efficiency — phase 3

## Local-first validation and publication (#1039)

Keep related commits on one branch. Before opening a PR for review, install
locked dependencies with `npm ci --ignore-scripts --no-audit --no-fund`,
run `npm run format:check` and `npm run test:affected` locally. Use Node 22
to match CI. Run `npm run test:full` if the selection or product impact
requires it, and run the relevant isolated SQL or release checks when those
boundaries change. Use a draft for unfinished work that needs to be shared.
Batch related corrections and push the tested revision. Mark the PR ready
after local validation.

Draft events defer the `quality` workflow's runner jobs. On readiness and on
subsequent ready-PR revisions, GitHub still performs the usual `quality`
checks. Deferred or skipped jobs cannot supply the required quality result.
The other required workflows keep their existing triggers. The publisher
verifies the successful `quality` job for the exact workflow attempt, in
addition to the reviewed head, merge ancestry and exact-main gates.

The automatic deployment is triggered by main ledger SQL completion. This
normally avoids allocating a production runner while the slower SQL suite is
still executing. The publisher still waits for both exact-main gates if their
order changes. After a reconciliation-only recovery, the cron fallback and the
normal guarded manual dispatch remain available. Keep the hosting-filter retries
and public SHA verification.

Measured CI reductions require counting runner minutes, including setup,
cancelled runs, and repetitions, at comparable work and PR volume. A ready
PR's checked runtime suite is still required for merge.

## Remove duplicate PR execution (#1039)

The PR Node quality job delegates ten identical suites to the existing required
checks for the same revision. `cloud-contract` runs the isolated persistence
regression, and `reconciliation` runs nine recovery and diagnostic suites.
The PR declaration check still runs on edits. The four separate backup, matrix,
guest transfer and OAuth steps in `quality.yml` remain distinct. The local
quality gate and `test:full` retain the complete Node inventory. The shard
regression verifies the exact overlap with the dedicated workflows and local
coverage. SQL and exact-SHA publication gates are unaffected.

For presentation-only PRs, CI schedules one browser job instead of scheduling
two extra jobs without suites. Full PRs still use three jobs, and docs-only PRs
skip the runtime jobs as before. Measure runner savings from CI job durations.

### Thirty-day baseline (#1039)

From 26 October through 24 November 2026 inclusive (Paris time), GitHub returned
5,571 runs, including 4,284 triggered by PRs, 845 by pushes, 332 by other
workflows, 88 scheduled and 22 manual. A stratified sample of 598 runs estimates
10,253 cumulative runner minutes, including about 1,089 minutes already spent on
564 cancelled runs. The 62 rerun attempts accounted for 427 measured minutes.
These figures describe work done, not guaranteed savings from cancellation
or deduplication.

The 256 PRs merged into main and 232 distinct main SHAs with a successful o2switch
Actions run imply about 40 runner minutes per merged PR and 44 per GitHub-verified
delivery. Both ratios use the entire CI footprint as numerator. Cron-only
publications are outside this denominator. Only 18 of the 4,284 PR-triggered runs
carry a direct PR association in the collected payload, so these ratios do not
attribute minutes to individual PRs or project work. An attribution audit needs
head/branch history and exact-SHA matches, with unmatched runs reported separately.

## Browser sharding — November 2026 (#750)

Base: `4316d09e2e542bac9f2cf079772a1eede54ce623`. Successful PR runs
[43754677941](https://github.com/Anuponk/lumen/actions/runs/43754677941) and
[43756662325](https://github.com/Anuponk/lumen/actions/runs/43756662325) took
532 s and 588 s inside the quality script. In the latter, Node suites totalled
41.3 s and 31 browser suites totalled 1027.4 s across two workers. The longest
browser suites were sky navigation (251.5 s), learning (156.9 s), account session
(79.8 s) and general browser (65.8 s). These are two observations, not a trend.

The PR workflow now classifies scope in `prepare`, then runs `node` and three
`browser` matrix children concurrently. Each browser runner retains two isolated
workers. The required `quality` job runs even after dependency failure and
accepts only a successful scope classification plus successful Node and aggregate
browser results, or explicit documentation-only classification with both runtime
jobs skipped. Matrix fail-fast is disabled so independent failures retain reports.
Workflow identity, the final `quality` context, independent cloud/SQL checks,
documentation classification and optional learning selection remain unchanged.
Presentation-page scope (#744): `prepare` also exposes `scope` from the base copy of `scripts/ci-scope.mjs`. For a `landing` PR, the `node` job runs formatting, the release tests and `landing-seo-tests`. Only browser shard 1 is scheduled and runs `landing-browser-tests`. `ledger-sql` and `reconciliation` are skipped. See [TESTING](TESTING.md#ci-scope-presentation-page-only-744).
The old schedule/main-only steps were unreachable under the PR-only trigger and
are removed; no current validation is removed.

`scripts/quality-gate-browser-suites.mjs` is the shared browser inventory. Suites
are assigned by their stable inventory index modulo three before optional
learning selection. Every existing suite runs exactly once across the three
children; no assertion, viewport or real victory delay changes. New suites join
the same inventory for both local and CI execution. Browser/server lifecycle
remains in the existing quality runner, not in workflow shell scripts.

Local commands: `node scripts/quality-gate.mjs` retains the full Node/browser
run; `--node-only` runs Node suites; `--browser-shard=1/3`, `2/3` or `3/3` runs
one browser partition. Invalid/mixed options fail. `quality-gate-shards-tests.mjs`
covers inventory preservation, exact-once partitioning, optional learning,
invalid invocation and final-gate failure/cancellation/missing-result handling;
the existing pool tests still cover draining failures and worker isolation.

CI sets `LUMEN_VALIDATION_DIR` to a runner temporary directory and uploads all
current JSON reports under distinct `lumen-validation-node` and
`lumen-validation-browser-N` artifacts, retained for 14 days. Historical tracked
reports cannot enter these artifacts. Local default output remains
`docs/validation/`. Timing summaries include phase and shard; the metrics
collector distinguishes skipped documentation runs from executed runtime gates.

Measure the complete workflow wall time including scope classification and final
aggregation, and separately sum runner durations. More concurrent runners can
increase billed work even when feedback arrives sooner. CI results and timings
for this change belong in its PR; no gain is claimed before that execution.
Compare the next 10 comparable PRs before declaring a durable improvement.

The October report below is historical, including its then-current suite counts
and absence of npm dependencies. The current workflow retains `npm ci` and the
format check; it does not cache successful test results.

Scope: tooling and CI only, based on `b95fce3` (merged phases 1/#466 and 2/#467).
No player rules, runtime modules, migrations or saves change. Phase 1 maps and
phase 2 selector/regressions were found and executed before these edits.

## Audit and decisions

The bounded [baseline snapshot](validation/phase3-before-snapshot.json) contains
100 runs from **17 October 2026 04:37 to 18 October 2026 04:52 UTC**, not a complete
repository history. [Computed summary](validation/phase3-before-summary.json).
Latest-attempt job timings were fetched for all 26 completed quality runs, three
other validation jobs and three failed deployments. Missing timings are `null`.

| Workflow(s) | Observation / decision |
|---|---|
| `quality.yml` | 11 PR jobs: mean **163.45 s**, median **166 s**. 7 push jobs: mean **165.43 s**. All successful. Prioritize browser scheduling. |
| Quality browser suites | Latest phase 2 run [39098315955](https://github.com/Anuponk/lumen/actions/runs/39098315955): gate **154.2 s**, seven browser commands **122.8 s** combined. Two isolated workers, longest suite first; Node checks precede browser work. Default local worker count stays one. |
| Four mandatory workflows | Already independent and parallel. Preserve workflow/job names `quality`, `cloud-contract`, `reconciliation`, `ledger-sql`. Cancel obsolete **PR** runs only, in a group unique to workflow + PR. Main/manual/scheduled runs have unique run IDs and cannot cancel each other. |
| Cloud contract | `edited` events deliberately retained: PR declaration must be rechecked. Its independent regression remains mandatory. |
| Ledger / reconciliation | Latest sampled jobs: **21 s / 7 s**. Keep real PostgreSQL 17 and all fault checks; no test-result cache. |
| Quality schedule | Eight already-reused jobs average **8.625 s**. Existing same-SHA reuse is retained, with full validation on lookup failure. Keep the publication fallback; do not claim these cheap runs as full validations. |
| Deployment | 9 failures / 15 deployment runs in this window. Three sampled failures occur in HTTPS publication, after release gates pass. No evidence that CI optimization fixes transport failures. Exact-SHA release checks and serialization remain unchanged. |
| Astronomy | Cache pip downloads keyed by Python/platform + requirements content via setup-python. Keep installation and validation on cache hit and miss. Do not cache mutable astronomical source results. Trigger includes requirements changes. |
| `diverse-100`, first preview, issue 222 generation, atlas materialization, first-adventure preparation, diverse staging | Existing selective/manual content producers, separate from mandatory validation. No indiscriminate parallel generation or extra scheduled experiments. Preparation now distinguishes an empty diff from a failing commit instead of swallowing all commit errors. |

There are no npm dependencies or lockfile to cache. Browser binaries already come
from the runner. Adding dependency installation, browser downloads or a cached
green test result would add cost or weaken freshness. One duplicate on-main cloud
regression step was removed because `nodeSuites` already runs that exact suite;
the four standalone backup/migration/OAuth regressions are distinct and retained.

No path filter was added to mandatory checks. Docs, unknown files, tooling and
SQL still receive full CI. Path-filtered generation jobs are not substitutes for
these checks. The selector remains local; unknown impact still expands to full.

## Measurement without a service

| Indicator | Source / interpretation |
|---|---|
| Targeted local duration | `test:affected` prints the temporary log directory; `timings.json` there records mode, wall time, per-suite times and failures. No selected suites means no timing sample, rather than a zero-duration validation. |
| Full local validation | `test:full` uses the same timing file; `quality-gate.mjs` also writes `docs/validation/ci-quality-summary.json`, including failed attempts and browser worker count. |
| CI duration | Read-only collector below. Group by workflow, event, conclusion and executed/reused. Execution wall time is first job start to last job end; setup/checkout/upload included, queue time excluded. Job durations are separate. |
| Runs / reruns per PR | `perPR` counts observed workflow runs separately from `sum(run_attempt - 1)`. Heads indicate revisions, not diagnosed bug fixes. Commit-to-PR lookup handles empty `pull_requests` API arrays. Partial windows undercount lifetimes. |
| Avoidable failures | Manual classification with a linked failing run and diagnosis; never infer from a red conclusion. Baseline: **unavailable**, not zero. |
| Corrections per bug | Manually link bug ID to attempted corrective revisions and their evidence; exclude unrelated commits/body edits. Baseline: **unavailable**. |
| Codex tokens | Only attributable session/task export. Baseline/session counters unavailable. The available personal daily CSV is not attributable to this repository or phase; its totals are not published as Lumen consumption. |

```sh
# Node 22; optional GH_TOKEN with repository/Actions read access avoids the
# unauthenticated public API rate limit. Never put credentials in tracked files.
node scripts/ci-metrics.mjs collect /tmp/lumen-ci.json 1
node scripts/ci-metrics.mjs summarize /tmp/lumen-ci.json /tmp/lumen-ci-summary.json
```

Collection uses bounded pages (100 runs/page, default 1), all latest-attempt jobs,
and fails visibly on API errors. `scope.truncated` identifies incomplete history.
The baseline was collected via the connected GitHub API after the unauthenticated
collector reached HTTP 403; only selected jobs were fetched, as declared above.
No automatic reruns, dispatches, paid services or production telemetry are added.
CI uploads all seven browser JSON reports plus the quality timing summary for
14 days. Previously tracked reports are cleared before execution to avoid
publishing stale success after a failure. Detailed assertion output stays visible.

For the next **10 comparable PRs**, retain before/after summaries over equal
windows; separate runtime/docs/tooling changes, runner OS, Node/browser versions,
worker count, successful/failed/cancelled runs, and scheduled reuse. Compare means,
medians and sample sizes, both wall time and runner work. Record local targeted and
full timings on the same machine. Exclude this instrumentation PR's deliberate
cache verification rerun from normal development rerun rates, while reporting it.
Use a small local CSV with columns `bug,pr,run,revision,classification,evidence` for
manual diagnoses; share only anonymized aggregates. Count a correction when a
diagnosed bug requires another attempted fix, not on every CI run.

For a usage CSV with input/cache/output counters: cache is a subset of input;
total is input + output, uncached input is input - cache. Keep scope/date/model
and cache share; never add cache again to total. Daily totals cannot establish
phase-level savings. Hardware load, test additions and GitHub queueing can explain
changes; do not attribute every difference to this phase.

## Verification and remaining limits

Before edits: selector's four tests, cloud regression, badge persistence,
qualification/restart regression and all four repaired phase 2 suites passed.
Windows process restrictions required running the Git fixture outside the process
sandbox; tests and assertions were unchanged.

Local full validation: **91 Node suites**, **29 complementary suites** and **six
browser suites** passed. General browser suite still fails the previously
documented Edge 375×667 app overflow (3 px); the error remains blocking. The gate
records 92.485 s and the full wrapper 94.781 s, both **failed** runs. These are
not comparable gains against successful Linux runs. Pool tests verify concurrency
limits, execution once, and draining/reporting multiple failures before cleanup.
Metric tests verify reruns, reused schedules, missing data and overlapping jobs.
A real targeted selection in a disposable worktree (instrumented phase 2 base,
whitespace-only edit to the badge test) passed **63 suites in 4.932 s**. This is
a tooling smoke measurement, not a fix benchmark or an estimated token saving.

`actionlint` passes on modified workflows (shellcheck/pyflakes unavailable).
Whole-repository lint finds three existing untrusted-branch interpolation warnings
in issue-222 generation, atlas materialization and diverse staging. Changing those
path-triggered writers would start unrelated content generation; handle separately.
Do not infer that their generated commits received a fresh CI run.

Branch protection API returns **403 Resource not accessible by integration**.
No settings were changed. A maintainer must confirm all four existing contexts
remain required and that merge queue behavior, if configured, matches repository
policy. No merge/deployment is part of this phase.

First successful Linux observation: [quality run 39113311332](https://github.com/Anuponk/lumen/actions/runs/39113311332)
on `ebbfa6d`: job **118 s**, gate **106.9 s**, all 91 Node + seven browser suites
pass. Versus the latest phase 2 job (**165 s** / **154.2 s** gate), the observed
differences are **−47 s (−28.5%)** / **−47.3 s (−30.7%)**. One after sample is
insufficient to establish a durable or entirely causal gain. The longer historical
PR mean is 163.45 s (n=11); test additions and runner variation remain confounders.

All five workflows pass. Astronomy: **58 s**, pip install **8 s**, cold cache miss
then successful save. The final commit also normalizes Windows line endings for a
readable diff; its required CI rerun verifies the warm cache. Final-SHA status and
warm observations are recorded in [PR #469](https://github.com/Anuponk/lumen/pull/469)
without another documentation-only CI cycle. [Machine-readable first results](validation/phase3-first-results.json).

The first final-SHA check [39113522519](https://github.com/Anuponk/lumen/actions/runs/39113522519)
failed in account browser assertions after reload; six other browser suites passed.
The warm pip cache restored successfully (48 MB), with install **9 s** versus
**8 s** cold: no installation-time gain established. This failure is retained.
CDP acknowledges reload before replacing the old document, so its existing ready
diagnostics can prematurely satisfy the old wait. A deterministic regression
reproduces that acceptance (red), then passes when navigation must change
`performance.timeOrigin` and the new document must finish loading with diagnostics.
Account UI assertions are unchanged; no automatic retry or ignored failure is
added. The bounded navigation wait retries only recognized destroyed-context
transitions; unexpected errors still fail. The new regression runs in full CI.
Final verification is linked in the PR; passing timings and failure timings stay
separate. This diagnosed test synchronization defect is one identified avoidable
failure, not evidence of a measured reduction in future failure rates.

References: [GitHub concurrency / workflow semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax),
[setup-python dependency caching](https://github.com/actions/setup-python#caching-packages).
