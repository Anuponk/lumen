"""Verify all release gates for one exact main SHA. Exit 75 means pending."""
import json
import os
import re
import sys
import urllib.request

REPOSITORY = "Anuponk/lumen"
REQUIRED = {"quality.yml", "cloud-reconciliation-matrix.yml", "canonical-ledger.yml"}


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


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r"[0-9a-f]{40}", sys.argv[1]):
        return 2
    sha = sys.argv[1]
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "lumen-deployment"}
    if os.environ.get("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    runs = []
    for page in range(1, 11):
        url = f"https://api.github.com/repos/{REPOSITORY}/actions/runs?head_sha={sha}&per_page=100&page={page}"
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as response:
            batch = json.load(response)["workflow_runs"]
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
