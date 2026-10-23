# Git, Vercel and release workflow

## Branches
As observed on 2026-10-03, `main` and `dev` had diverged. Do not assume a dev->main merge means the branches are functionally synchronized. Compare refs/commits before merging.

Prefer batching coherent work instead of pushing every micro-edit, especially when hosting/deployment quotas are constrained.

## Intended workflow

For o2switch, `Deploy Lumen to o2switch` publishes the exact successful `main`
revision after all three release gates pass, when `O2SWITCH_DEPLOY_ENABLED=true`.
The server independently checks the gates and the published HTTP SHA, using
the existing backup/restore and shared publish lock. An authenticated HTTPS
receiver at `/lumen-release/` (HMAC-SHA256, five-minute expiry) avoids incoming
SSH firewall rules and direct public requests to a `.php` path.
The private receiver and GitHub secret require one-time setup documented in
`O2SWITCH_SIMPLE_CRON.md`. A real GitHub deployment verified main SHA
`72f96a360e46e9255fa4a8cc5d039b1408a5a0e8` on 2026-10-23
([run](https://github.com/Anuponk/lumen/actions/runs/39908907546)), but TigerProtect
still intermittently rejects runners (503) and browser assets (429).
See the hosting-filter diagnosis in that runbook; deployment success alone
does not establish browser availability. The ten-minute cron remains a fallback; event-driven publication
does not wait for its five-minute CI-poll cooldown.
1. Work on a non-production branch.
2. Run tests + strict grid audit.
3. Push and record GitHub commit SHA.
4. Review the PR and validate locally; feature branches do not deploy to Vercel.
5. Merge the reviewed/tested commit to `main`.
6. Verify the **merge commit's Production deployment**, not merely that some deployment succeeded.
7. Report status as success, failure with reason, or pending.

## Version discipline
There are multiple notions of version: Git commit SHA, branch head, UI/application version string and deployed Vercel commit. Always identify which one is being discussed. The deployed commit SHA is authoritative for answering “what code is in production?”

## Vercel
The repository is connected to Vercel and deploys **only `main`**, as confirmed by the owner on 2026-10-04. Feature branches and pull requests do not produce Vercel previews; an ignored deployment on those branches is expected. Validate development changes locally and in GitHub CI. Deployment follows merging the reviewed change to `main`, then verify the deployment for that exact merge commit.

A GitHub push being accepted does **not** prove Vercel Production is running that commit.

PWA freshness: a current HTML build label alone does not prove its imported
modules are current. The v9 service-worker/browser cache mismatch is reproduced
by `service-worker-update-browser-tests.mjs`; v10 bypasses HTTP/resource caching
for managed public assets while retaining explicit offline copies. A changed
worker upgrades already controlled clients through the existing reload hook.
Release verification still requires the exact server SHA, applicable browser
upgrade test and affected-device confirmation. Do not clear player storage as
an update procedure. Interrupted network loads are not an atomic module-graph
deployment guarantee; keep diagnostics and pending saves until verified recovery.

## Cloud persistence release blocker (#248)
For every PR, complete the cloud-impact section of the PR template even if not applicable (with reason). For any player-data, authentication or shop change, inspect the persistence matrix in [TESTING.md](TESTING.md#cloud-persistence-regression-matrix) and run all relevant automation plus isolated multi-device/manual verification. Do not deploy purchases before server-ledger, entitlements and recovery are implemented. Branch protection should require cloud regression CI checks before merging; a template/checklist alone does not enforce that requirement.

Repository setting verified on 22 October 2026: `main` requires GitHub Actions
checks `quality`, `cloud-contract`, `reconciliation`, `ledger-sql` and
`docs-consistency`, with an up-to-date base and enforcement for administrators.
Force pushes and deletion are disabled. This is live GitHub configuration,
separate from workflow source; recheck it before relying on merge protection.
Deployment remains a separately authorized action for the P0 persistence lot.

## Release checklist
- expected branch/ref confirmed;
- complete tests pass;
- strict grid audit passes;
- mobile smoke test for board/input changes;
- persistence migration considered;
- docs synchronized;
- GitHub commit SHA captured;
- Vercel deployment for that exact SHA checked;
- production smoke check after main merge.

## GitHub CI orchestration
The `Cloud persistence contract` workflow runs on pull requests and PR description edits to validate the cloud-policy declaration and isolated regression. On `main`, the `Lumen quality gate` runs these same two checks as part of its existing push/manual/scheduled verification, without launching a second cloud workflow. Scheduled quality runs still skip full tests for a SHA previously validated on `main`. o2switch continues to require a successful quality workflow for the exact deployed SHA.
