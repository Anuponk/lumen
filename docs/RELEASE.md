# Git, Vercel and release workflow

## Branches
As observed on 2026-10-03, `main` and `dev` had diverged. Do not assume a dev->main merge means the branches are functionally synchronized. Compare refs/commits before merging.

Prefer batching coherent work instead of pushing every micro-edit, especially when hosting/deployment quotas are constrained.

## Intended workflow
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

## Cloud persistence release blocker (#248)
For every PR, complete the cloud-impact section of the PR template even if not applicable (with reason). For any player-data, authentication or shop change, inspect the persistence matrix in [TESTING.md](TESTING.md#cloud-persistence-regression-matrix) and run all relevant automation plus isolated multi-device/manual verification. Do not deploy purchases before server-ledger, entitlements and recovery are implemented. Branch protection should require cloud regression CI checks before merging; a template/checklist alone does not enforce that requirement.

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
