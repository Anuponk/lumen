"""Deployment tests; publisher fixtures run only on disposable Linux files."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ci_status", ROOT / "scripts/o2switch-ci-status.py")
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)
SHA = "a" * 40


def runs():
    return [dict(id=i, path=".github/workflows/" + name, status="completed", conclusion="success",
                 head_sha=SHA, head_branch="main", event="push",
                 head_repository={"full_name": "Anuponk/lumen"}) for i, name in enumerate(sorted(ci.REQUIRED), 1)]


class Gates(unittest.TestCase):
    def test_all_required(self):
        self.assertEqual(ci.check_runs(runs(), SHA)[0], 0)

    def test_missing_or_pending(self):
        self.assertEqual(ci.check_runs(runs()[:-1], SHA)[0], 75)
        rows = runs()
        rows[0]["status"] = "in_progress"
        self.assertEqual(ci.check_runs(rows, SHA)[0], 75)

    def test_failed_gate(self):
        for outcome in ("failure", "cancelled", "skipped", "timed_out"):
            rows = runs()
            rows[0]["conclusion"] = outcome
            self.assertEqual(ci.check_runs(rows, SHA)[0], 1)

    def test_reject_wrong_sha_pr_branch_or_fork(self):
        for key, value in (("head_sha", "b" * 40), ("head_branch", "dev"), ("event", "pull_request"),
                           ("head_repository", {"full_name": "someone/lumen"})):
            rows = runs()
            rows[0][key] = value
            self.assertNotEqual(ci.check_runs(rows, SHA)[0], 0)

    def test_latest_failure_cannot_hide_behind_old_success(self):
        rows = runs()
        rows.append({**rows[0], "id": 999, "conclusion": "failure"})
        self.assertEqual(ci.check_runs(rows, SHA)[0], 1)

    def test_dispatcher_rejects_arbitrary_commands(self):
        shell = os.environ.get("LUMEN_BASH", "bash")
        if not shutil.which(shell):
            self.skipTest("Bash unavailable locally; exercised by CI")
        for command in ("", "true", "deploy main", "deploy " + SHA + "; id", "deploy " + SHA + " extra"):
            result = subprocess.run([shell, str(ROOT / "scripts/o2switch-ssh-deploy.sh")],
                                    env={**os.environ, "SSH_ORIGINAL_COMMAND": command}, capture_output=True)
            self.assertEqual(result.returncode, 2)


@unittest.skipUnless(os.name == "posix", "Real Bash/git/tar publisher fixtures run on Linux CI")
class Publisher(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="lumen-deploy-test-")
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        self.source = self.home / "lumen-staging"
        self.target = self.home / "lumen.nopuna.fr"
        self.source.mkdir()
        self.target.mkdir()
        self.env = {**os.environ, "HOME": str(self.home), "GIT_CONFIG_NOSYSTEM": "1"}
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Isolated fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        for folder in ("scripts", "src", "content"):
            (self.source / folder).mkdir()
        for name in ("index.html", "sw.js", "manifest.webmanifest", "icon.svg", "icon-maskable.svg", "src/main.js", "content/data.json"):
            (self.source / name).write_text('<meta name="lumen-build" content="fixture"><script src="src/main.js"></script>')
        # The gate selector is tested above; stub only its network boundary here.
        (self.source / "scripts/o2switch-ci-status.py").write_text('import os,sys;sys.exit(int(os.environ.get("TEST_GATE_STATUS","0")))')
        self.git("add", ".")
        self.git("commit", "-m", "baseline")
        self.old = self.git("rev-parse", "HEAD").strip()
        (self.source / "sw.js").write_text("new version")
        self.git("commit", "-am", "new release")
        self.sha = self.git("rev-parse", "HEAD").strip()
        self.git("remote", "add", "origin", ".")
        (self.target / "index.html").write_text("original site")
        (self.target / ".lumen-release-sha").write_text(self.old)
        bin_dir = self.home / "bin"
        bin_dir.mkdir()
        curl = bin_dir / "curl"
        curl.write_text('#!/bin/bash\nif [[ "$*" == *build-info.json* ]]; then printf \'{"sha":"%s"}\\n\' "$TEST_HTTP_SHA"; else echo \'<script src="src/main.js"></script>\'; fi\n')
        curl.chmod(0o755)
        self.env.update(PATH=str(bin_dir) + os.pathsep + self.env["PATH"], TEST_HTTP_SHA=self.sha)
        (self.home / "lumen-private").mkdir()
        (self.home / "lumen-private" / ("ci-check-" + self.sha)).touch()

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.source, env=self.env, text=True, stderr=subprocess.DEVNULL)

    def publish(self, sha=None, mode="--deploy"):
        return subprocess.run(["bash", str(ROOT / "scripts/o2switch-cron-publish.sh"), mode, sha or self.sha],
                              env=self.env, text=True, capture_output=True, timeout=30)

    def test_exact_sha_bypasses_cooldown_and_publishes_valid_json(self):
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual(json.loads((self.target / "build-info.json").read_text())["sha"], self.sha)
        self.assertEqual((self.target / ".lumen-release-sha").read_text().strip(), self.sha)
        self.assertTrue(list((self.home / "lumen-deploy-backups").glob("*.tar.gz")))
        self.assertEqual(self.publish().returncode, 0, "duplicate deployment is idempotent")

    def test_failed_or_pending_gates_never_publish_an_older_fallback(self):
        for status in ("1", "75"):
            self.env["TEST_GATE_STATUS"] = status
            self.assertEqual(self.publish().returncode, int(status))
            self.assertEqual((self.target / "index.html").read_text(), "original site")

    def test_unknown_or_newer_deployment_is_protected(self):
        self.assertNotEqual(self.publish("f" * 40).returncode, 0)
        (self.target / ".lumen-release-sha").write_text(self.sha)
        self.assertNotEqual(self.publish(self.old).returncode, 0)

    def test_wrong_public_version_restores_backup(self):
        self.env["TEST_HTTP_SHA"] = self.old
        self.assertNotEqual(self.publish().returncode, 0)
        self.assertEqual((self.target / "index.html").read_text(), "original site")
        self.assertEqual((self.target / ".lumen-release-sha").read_text(), self.old)

    def test_dry_run_changes_no_public_files(self):
        self.assertEqual(self.publish(mode="--dry-run").returncode, 0)
        self.assertEqual((self.target / "index.html").read_text(), "original site")

    def test_fallback_cron_retains_its_cooldown(self):
        result = subprocess.run(["bash", str(ROOT / "scripts/o2switch-cron-publish.sh"), "--deploy"],
                                env=self.env, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 75)
        self.assertIn("Waiting before retrying", result.stdout)
        self.assertEqual((self.target / "index.html").read_text(), "original site")


@unittest.skipUnless(os.name == "posix", "Firewall shell fixtures run on Linux CI")
class Firewall(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="lumen-firewall-test-")
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        curl = self.folder / "curl"
        curl.write_text('''#!/bin/bash
endpoint="${@: -1}"
case "$endpoint" in
 *api.ipify.org) echo 203.0.113.5;;
 */list) printf '%s' "$TEST_LIST";;
 *) echo "$endpoint" >> "$RUNNER_TEMP/requests"; printf '{"status":%s}' "${TEST_API_STATUS:-1}";;
esac
''')
        curl.chmod(0o755)
        self.env = {**os.environ, "RUNNER_TEMP": str(self.folder), "CPANEL_SERVER": "fixture.invalid",
                    "CPANEL_USERNAME": "fixture", "CPANEL_API_TOKEN": "fake-test-token",
                    "PATH": str(self.folder) + os.pathsep + os.environ["PATH"]}

    def invoke(self, mode):
        return subprocess.run(["bash", str(ROOT / "scripts/o2switch-runner-firewall.sh"), mode],
                              env=self.env, capture_output=True, text=True)

    def test_cleanup_preserves_existing_direction(self):
        self.env["TEST_LIST"] = json.dumps({"status": 1, "data": {"list": [
            {"address": "203.0.113.5", "direction": "in", "port": 22}]}})
        self.assertEqual(self.invoke("add").returncode, 0)
        self.assertEqual((self.folder / "lumen-firewall-created").read_text(), "203.0.113.5 out\n")
        self.assertEqual(self.invoke("remove").returncode, 0)
        requests = (self.folder / "requests").read_text()
        self.assertIn("direction=out", requests)
        self.assertNotIn("direction=in", requests)
        self.assertNotIn("remove_all", requests)

    def test_lost_add_response_still_retains_cleanup_intent(self):
        self.env.update(TEST_LIST='{"status":1,"data":{"list":[]}}', TEST_API_STATUS="0")
        self.assertNotEqual(self.invoke("add").returncode, 0)
        self.env["TEST_API_STATUS"] = "1"
        self.assertEqual(self.invoke("remove").returncode, 0)
        requests = (self.folder / "requests").read_text()
        self.assertIn("direction=in", requests)
        self.assertIn("direction=out", requests)

    def test_no_run_owned_exception_means_no_cleanup(self):
        self.assertEqual(self.invoke("remove").returncode, 0)
        self.assertFalse((self.folder / "requests").exists())


if __name__ == "__main__":
    unittest.main()
