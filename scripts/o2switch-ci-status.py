"""Verify all release gates for one exact main SHA. Exit 75 means pending."""
import json
import os
import re
import sys
import urllib.request

REPOSITORY_ID = 1401296378
REPOSITORY_API = f"/repositories/{REPOSITORY_ID}"
REQUIRED = {"cloud-reconciliation-matrix.yml", "canonical-ledger.yml"}
PR_REQUIRED_JOBS = {
    "quality.yml": "quality",
    "canonical-ledger.yml": "ledger-sql",
    "cloud-reconciliation-matrix.yml": "reconciliation",
}
PR_REQUIRED = PR_REQUIRED_JOBS.keys() | {"cloud-persistence-contract.yml", "docs-consistency.yml"}


def check_runs(runs, sha):
    latest = {}
    for run in runs:
        if (run.get("head_sha") != sha or run.get("head_branch") != "main"
                or run.get("event") not in ("push", "workflow_dispatch", "schedule")
                or (run.get("head_repository") or {}).get("id") != REPOSITORY_ID):
            continue
        workflow = run.get("path", "").split("@")[0].rsplit("/", 1)[-1]
        if workflow in REQUIRED:
            prior = latest.get(workflow)
            if prior is None or (run.get("id", 0), run.get("run_attempt", 1)) > (prior.get("id", 0), prior.get("run_attempt", 1)):
                latest[workflow] = run
    for name, run in latest.items():
        if run.get("status") == "completed" and run.get("conclusion") != "success":
            return 1, "Release gate failed: " + name
    pending = sorted(name for name in REQUIRED if name not in latest or latest[name].get("status") != "completed")
    if pending:
        return 75, "Waiting for exact-SHA release gates: " + ", ".join(pending)
    return 0, "All release gates passed for " + sha


def has_required_pr_job(run, name, fetch):
    path = (f"{REPOSITORY_API}/actions/runs/{run['id']}"
            f"/attempts/{run.get('run_attempt', 1)}/jobs?per_page=100")
    result = fetch(path)
    jobs = result["jobs"]
    required = [job for job in jobs if job.get("name") == name]
    if len(jobs) != result.get("total_count") or len(required) != 1:
        return False
    if required[0].get("status") != "completed":
        return False
    if required[0].get("conclusion") == "success":
        return True
    # Previous #744 workflows skipped the static check after a successful
    # landing classifier. A deferred draft has no successful classifier.
    return (name in ("ledger-sql", "reconciliation")
            and required[0].get("conclusion") == "skipped"
            and len(jobs) == 2
            and any(job.get("name") == "scope" and job.get("status") == "completed"
                    and job.get("conclusion") == "success" for job in jobs))


def tested_tree_includes_advanced_base(commit, base, parent, head, fetch):
    """A historical PR base is safe only with identical tested contents/ancestry."""
    if not all(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value)
               for value in (base, parent, head)):
        return False
    tree = ((commit.get("commit") or {}).get("tree") or {}).get("sha")
    if not isinstance(tree, str) or not re.fullmatch(r"[0-9a-f]{40}", tree):
        return False
    reviewed = fetch(f"{REPOSITORY_API}/commits/{head}")
    if ((reviewed.get("commit") or {}).get("tree") or {}).get("sha") != tree:
        return False
    # main must contain the historical base; the tested head must already
    # contain that actual main parent. No untested merge resolution is allowed.
    for older, newer in ((base, parent), (parent, head)):
        if older != newer and fetch(f"{REPOSITORY_API}/compare/{older}...{newer}").get("status") != "ahead":
            return False
    return True


def validated_merged_pr(sha, fetch):
    """Reuse successful PR checks only for a verified squash or regular merge."""
    commit = fetch(f"{REPOSITORY_API}/commits/{sha}")
    parents = commit.get("parents", [])
    if len(parents) not in (1, 2):
        return 1, "Expected a squash commit (one parent) or merge commit (two parents)"
    candidates = fetch(f"{REPOSITORY_API}/commits/{sha}/pulls")
    for pr in candidates:
        pr_base = pr.get("base") or {}
        if (not pr.get("merged_at") or pr_base.get("ref") != "main"
                or (pr_base.get("repo") or {}).get("id") != REPOSITORY_ID):
            continue
        if pr.get("merge_commit_sha") != sha:
            continue
        pr_head = pr.get("head") or {}
        head = pr_head.get("sha")
        base = pr_base.get("sha")
        if not head or (pr_head.get("repo") or {}).get("id") != REPOSITORY_ID:
            continue
        # A regular merge must connect the reviewed base and exact PR head.
        # For a squash merge the only parent must be the reviewed base.
        parent_shas = [parent.get("sha") for parent in parents]
        if not base or (len(parents) == 2 and parent_shas[1] != head):
            continue
        if parent_shas[0] != base and not tested_tree_includes_advanced_base(commit, base, parent_shas[0], head, fetch):
            continue
        runs = fetch(f"{REPOSITORY_API}/actions/runs?head_sha={head}&per_page=100").get("workflow_runs", [])
        latest = {}
        for run in runs:
            if run.get("head_sha") != head or run.get("event") != "pull_request":
                continue
            if (run.get("head_repository") or {}).get("id") != REPOSITORY_ID:
                continue
            name = run.get("path", "").split("@")[0].rsplit("/", 1)[-1]
            if name not in PR_REQUIRED:
                continue
            prior = latest.get(name)
            if prior is None or (run.get("id", 0), run.get("run_attempt", 1)) > (prior.get("id", 0), prior.get("run_attempt", 1)):
                latest[name] = run
        missing = PR_REQUIRED - latest.keys()
        if missing:
            return 75, "Waiting for PR release gates: " + ", ".join(sorted(missing))
        for name, run in latest.items():
            if run.get("status") != "completed":
                return 75, "Waiting for PR release gate: " + name
            if run.get("conclusion") != "success":
                return 1, "PR release gate failed: " + name
        # A successful workflow alone does not prove that a required job ran.
        for workflow, name in PR_REQUIRED_JOBS.items():
            if not has_required_pr_job(latest[workflow], name, fetch):
                return 1, "PR workflow lacks required check evidence: " + name
        return 0, "Merged PR quality verified: #" + str(pr["number"])
    return 1, "No verified squash/merge PR matching the exact main commit and parents"


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"[0-9a-f]{40}", sys.argv[1]):
        return 2
    sha = sys.argv[1]
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "lumen-deployment"}
    if os.environ.get("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    def fetch(path):
        url = "https://api.github.com" + path
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as response:
            return json.load(response)
    pr_code, pr_message = validated_merged_pr(sha, fetch)
    print(pr_message)
    if pr_code != 0:
        return pr_code
    runs = []
    for page in range(1, 11):
        batch = fetch(f"{REPOSITORY_API}/actions/runs?head_sha={sha}&per_page=100&page={page}")["workflow_runs"]
        runs.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise RuntimeError("Too many workflow runs; refusing incomplete verification")
    code, message = check_runs(runs, sha)
    print(message)
    return code


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print("Cannot verify release gates: " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
