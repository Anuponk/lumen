"""Verify all release gates for one exact main SHA. Exit 75 means pending."""
import json
import os
import re
import sys
import urllib.request

REPOSITORY = "Anuponk/lumen"
REQUIRED = {"cloud-reconciliation-matrix.yml", "canonical-ledger.yml"}
PR_REQUIRED = {"quality.yml", "cloud-reconciliation-matrix.yml", "canonical-ledger.yml", "cloud-persistence-contract.yml", "docs-consistency.yml"}


def check_runs(runs, sha):
    latest = {}
    for run in runs:
        if (run.get("head_sha") != sha or run.get("head_branch") != "main"
                or run.get("event") not in ("push", "workflow_dispatch", "schedule")
                or run.get("head_repository", {}).get("full_name") != REPOSITORY):
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


def validated_merged_pr(sha, fetch):
    """Only reuse PR checks for a squash merge directly onto its reviewed base."""
    commit = fetch(f"/repos/{REPOSITORY}/commits/{sha}")
    parents = commit.get("parents", [])
    if len(parents) != 1:
        return 1, "Expected a squash commit with exactly one parent"
    candidates = fetch(f"/repos/{REPOSITORY}/commits/{sha}/pulls")
    for pr in candidates:
        if not pr.get("merged_at") or pr.get("base", {}).get("ref") != "main":
            continue
        if pr.get("merge_commit_sha") != sha:
            continue
        head = pr["head"].get("sha")
        if not head or pr["head"].get("repo", {}).get("full_name") != REPOSITORY:
            continue
        runs = fetch(f"/repos/{REPOSITORY}/actions/runs?head_sha={head}&per_page=100").get("workflow_runs", [])
        latest = {}
        for run in runs:
            if run.get("head_sha") != head or run.get("event") != "pull_request":
                continue
            if run.get("head_repository", {}).get("full_name") != REPOSITORY:
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
        return 0, "Merged PR quality verified: #" + str(pr["number"])
    return 1, "No verified squash-merged PR matching the exact main commit and parent"


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
        batch = fetch(f"/repos/{REPOSITORY}/actions/runs?head_sha={sha}&per_page=100&page={page}")["workflow_runs"]
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
