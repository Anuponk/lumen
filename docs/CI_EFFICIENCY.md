# CI and Codex efficiency — phase 3

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
