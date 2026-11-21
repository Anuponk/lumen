"""Deployment tests; publisher fixtures run only on disposable Linux files."""
import importlib.util
import http.server
import json
import os
from pathlib import Path
import shutil
import sys
import subprocess
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ci_status", ROOT / "scripts/o2switch-ci-status.py")
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)
SHA = "a" * 40
PUBLIC_PAGES = ("mentions-legales.html", "confidentialite.html", "cgv.html", "supprimer-compte.html", "legal-notice.html", "privacy-policy.html", "terms-of-sale.html", "delete-account.html", "decouvrir.html", "discover.html", "comment-jouer.html", "how-to-play.html", "apprendre-constellations.html", "learn-constellations.html", "constellations/index.html", "constellations/en.html", "robots.txt", "sitemap.xml")


def runs():
    return [dict(id=i, path=".github/workflows/" + name, status="completed", conclusion="success",
                 head_sha=SHA, head_branch="main", event="push",
                 head_repository={"full_name": "Anuponk/lumen"}) for i, name in enumerate(sorted(ci.REQUIRED), 1)]


class Gates(unittest.TestCase):
    def test_all_required(self):
        self.assertEqual(ci.check_runs(runs(), SHA)[0], 0)

    def test_status_check_authenticates_when_a_token_is_present(self):
        seen = []
        def refuse(request, timeout):
            seen.append(request.get_header("Authorization"))
            raise OSError("fixture stop")
        original, ci.urllib.request.urlopen = ci.urllib.request.urlopen, refuse
        argv, sys.argv = sys.argv, ["o2switch-ci-status.py", SHA]
        saved = os.environ.get("GH_TOKEN")
        try:
            for token, expected in (("fixture-token", "Bearer fixture-token"), (None, None)):
                os.environ.pop("GH_TOKEN", None)
                if token:
                    os.environ["GH_TOKEN"] = token
                with self.assertRaises(OSError):
                    ci.main()
                self.assertEqual(seen.pop(), expected)
        finally:
            ci.urllib.request.urlopen, sys.argv = original, argv
            os.environ.pop("GH_TOKEN", None)
            if saved is not None:
                os.environ["GH_TOKEN"] = saved

    def test_release_scripts_load_the_private_token_file_safely(self):
        for script in ("o2switch-cron-publish.sh", "o2switch-safe-release.sh"):
            text = (ROOT / "scripts" / script).read_text()
            self.assertIn('GITHUB_TOKEN_FILE="${HOME}/.config/lumen/github-token"', text)
            self.assertIn('== 600 ]]', text)
            self.assertIn('headers["Authorization"]="Bearer "+os.environ["GH_TOKEN"]', text)
            self.assertNotRegex(text, r'echo[^\n]*\$GH_TOKEN')

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

    def test_verified_squash_merge_reuses_green_pr_checks(self):
        head = "b" * 40
        base = "c" * 40
        merged = SHA
        pr = {"number": 663, "merged_at": "2026-11-12T20:00:00Z",
              "merge_commit_sha": merged, "base": {"ref": "main", "sha": base},
              "head": {"sha": head, "repo": {"full_name": ci.REPOSITORY}}}
        def fetch(path):
            if path.endswith("/commits/" + merged):
                return {"parents": [{"sha": base}]}
            if path.endswith("/commits/" + merged + "/pulls"):
                return [pr]
            if "actions/runs?" in path:
                return {"workflow_runs": [
                    {"id": i, "path": ".github/workflows/" + name,
                     "status": "completed", "conclusion": "success",
                     "head_sha": head, "event": "pull_request",
                     "head_repository": {"full_name": ci.REPOSITORY}}
                    for i, name in enumerate(sorted(ci.PR_REQUIRED), 1)]}
            raise AssertionError(path)
        self.assertEqual(ci.validated_merged_pr(merged, fetch)[0], 0)
        pr["merge_commit_sha"] = "d" * 40
        self.assertEqual(ci.validated_merged_pr(merged, fetch)[0], 1)

    def test_verified_regular_merge_reuses_green_pr_checks(self):
        base, head, merged = "c" * 40, "b" * 40, SHA
        pr = {"number": 808, "merged_at": "2026-11-18T20:08:07Z",
              "merge_commit_sha": merged, "base": {"ref": "main", "sha": base},
              "head": {"sha": head, "repo": {"full_name": ci.REPOSITORY}}}
        outcome = {"conclusion": "success"}
        parents = [base, head]
        def fetch(path):
            if path.endswith("/commits/" + merged):
                return {"parents": [{"sha": value} for value in parents]}
            if path.endswith("/commits/" + merged + "/pulls"):
                return [pr]
            if "actions/runs?" in path:
                return {"workflow_runs": [
                    {"id": i, "path": ".github/workflows/" + name,
                     "status": "completed", "conclusion": outcome["conclusion"],
                     "head_sha": head, "event": "pull_request",
                     "head_repository": {"full_name": ci.REPOSITORY}}
                    for i, name in enumerate(sorted(ci.PR_REQUIRED), 1)]}
            raise AssertionError(path)
        self.assertEqual(ci.validated_merged_pr(merged, fetch)[0], 0)
        for bad_parents in ([head, base], [base, "d" * 40], [base, head, "e" * 40]):
            parents[:] = bad_parents
            self.assertEqual(ci.validated_merged_pr(merged, fetch)[0], 1)
        parents[:] = [base, head]
        outcome["conclusion"] = "failure"
        self.assertEqual(ci.validated_merged_pr(merged, fetch)[0], 1)
        outcome["conclusion"] = "success"
        pr["head"]["sha"] = "d" * 40
        self.assertEqual(ci.validated_merged_pr(merged, fetch)[0], 1)

    def test_reject_unreviewed_commit(self):
        def fetch(path):
            if path.endswith("/pulls"):
                return []
            return {"parents": [{"sha": "c" * 40}]}
        self.assertEqual(ci.validated_merged_pr(SHA, fetch)[0], 1)

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
        self.env.pop("GH_TOKEN", None)
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Isolated fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        for folder in ("scripts", "src", "src/ui", "content"):
            (self.source / folder).mkdir()
        for name in ("index.html", "sw.js", "manifest.webmanifest", "icon.svg", "icon-maskable.svg", "src/main.js", "src/ui/game-screen.js", "src/ui/styles.css", "content/data.json"):
            (self.source / name).write_text('<meta name="lumen-build" content="fixture"><script src="src/main.js"></script>')
        (self.source / "scripts/merge-assetlinks.py").write_bytes((ROOT / "scripts/merge-assetlinks.py").read_bytes())
        # The gate selector is tested above; stub only its network boundary here.
        (self.source / "scripts/o2switch-ci-status.py").write_text('import os,sys;open(os.environ["HOME"]+"/gate-token","w").write(os.environ.get("GH_TOKEN",""));sys.exit(int(os.environ.get("TEST_GATE_STATUS","0")))')
        self.git("add", ".")
        self.git("commit", "-m", "baseline")
        self.old = self.git("rev-parse", "HEAD").strip()
        for name in PUBLIC_PAGES + ("internal-preview.html",):
            page = self.source / name
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text("Reviewed page: " + name)
        (self.source / ".well-known").mkdir()
        self.debug_dal = [{"relation": ["delegate_permission/common.handle_all_urls"],
                           "target": {"namespace": "android_app", "package_name": "fr.nopuna.lumen.debug",
                                      "sha256_cert_fingerprints": ["AA:" * 31 + "AA"]}}]
        (self.source / ".well-known" / "assetlinks.json").write_text(json.dumps(self.debug_dal))
        (self.source / "admin").mkdir()
        (self.source / "admin" / ".htaccess").write_bytes((ROOT / "admin/.htaccess").read_bytes())
        (self.source / "sw.js").write_text("new version")
        self.git("add", ".")
        self.git("commit", "-am", "new release")
        self.sha = self.git("rev-parse", "HEAD").strip()
        self.git("remote", "add", "origin", ".")
        (self.target / "index.html").write_text("original site")
        (self.target / ".lumen-release-sha").write_text(self.old)
        bin_dir = self.home / "bin"
        bin_dir.mkdir()
        curl = bin_dir / "curl"
        curl.write_text('''#!/bin/bash
endpoint="${@: -1}"
if [[ "$endpoint" == *build-info.json* ]]; then
 printf '{"sha":"%s"}\\n' "$TEST_HTTP_SHA"
elif [[ "$endpoint" == *'/assetlinks.json?'* ]]; then
 [[ "${TEST_DAL_FORBIDDEN:-0}" != 1 ]] || exit 22
 asset="${endpoint#https://lumen.nopuna.fr/}"
 cat "$HOME/lumen.nopuna.fr/${asset%%\\?*}"
elif [[ "$endpoint" == *'/src/'* ]]; then
 [[ "${TEST_STATIC_FORBIDDEN:-0}" != 1 ]] || exit 22
 asset="${endpoint#https://lumen.nopuna.fr/}"
 cat "$HOME/lumen.nopuna.fr/${asset%%\\?*}"
elif [[ "$endpoint" == *'/admin/analytics?'* ]]; then
 [[ "${TEST_ADMIN_FORBIDDEN:-0}" != 1 ]] || exit 22
 cat "$HOME/lumen.nopuna.fr/index.html"
elif [[ "$endpoint" == *'/constellations?'* ]]; then
 [[ "${TEST_CONSTELLATIONS_FORBIDDEN:-0}" != 1 ]] || exit 22
 cat "$HOME/lumen.nopuna.fr/constellations/index.html"
elif [[ "$endpoint" == *'.html?'* || "$endpoint" == *'.txt?'* || "$endpoint" == *'.xml?'* ]]; then
 [[ "${TEST_PAGE_FORBIDDEN:-0}" != 1 ]] || exit 22
 asset="${endpoint#https://lumen.nopuna.fr/}"
 cat "$HOME/lumen.nopuna.fr/${asset%%\\?*}"
else
 echo '<script src="src/main.js"></script>'
fi
''')
        curl.chmod(0o755)
        self.env.update(PATH=str(bin_dir) + os.pathsep + self.env["PATH"], TEST_HTTP_SHA=self.sha)
        (self.home / "lumen-private").mkdir()
        (self.home / "lumen-private" / ("ci-check-" + self.sha)).touch()

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.source, env=self.env, text=True, stderr=subprocess.DEVNULL)

    def publish(self, sha=None, mode="--deploy", mask=-1):
        return subprocess.run(["bash", str(ROOT / "scripts/o2switch-cron-publish.sh"), mode, sha or self.sha],
                              env=self.env, text=True, capture_output=True, timeout=30, umask=mask)

    def test_https_private_umask_keeps_static_assets_public(self):
        secret = self.home / "lumen-private" / "deploy-webhook-secret"
        secret.write_text("synthetic-private-secret")
        secret.chmod(0o600)
        result = self.publish(mask=0o077)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        for directory in (self.target / "src", self.target / "content"):
            self.assertEqual(directory.stat().st_mode & 0o777, 0o755)
            for path in directory.rglob("*"):
                self.assertEqual(path.stat().st_mode & 0o777, 0o755 if path.is_dir() else 0o644)
        self.assertEqual(secret.stat().st_mode & 0o777, 0o600)

    def test_analytics_route_is_published_without_overwriting_root_configuration(self):
        (self.target / ".htaccess").write_text("existing hosting configuration")
        result = self.publish(mask=0o077)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual((self.target / ".htaccess").read_text(), "existing hosting configuration")
        self.assertEqual((self.target / "admin/.htaccess").read_bytes(), (ROOT / "admin/.htaccess").read_bytes())
        self.assertEqual((self.target / "admin").stat().st_mode & 0o777, 0o755)

    def test_broken_analytics_route_rolls_back_the_release(self):
        self.env["TEST_ADMIN_FORBIDDEN"] = "1"
        result = self.publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.target / "index.html").read_text(), "original site")
        self.assertFalse((self.target / "admin/.htaccess").exists())

    def test_reviewed_public_pages_are_published_without_other_html(self):
        result = self.publish(mask=0o077)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        for name in PUBLIC_PAGES:
            self.assertTrue((self.target / name).is_file(), "Missing public page: " + name)
            self.assertEqual((self.target / name).read_bytes(), (self.source / name).read_bytes())
            self.assertEqual((self.target / name).stat().st_mode & 0o777, 0o644)
        self.assertFalse((self.target / "internal-preview.html").exists())

    def test_directory_index_unavailable_at_public_route_rolls_back(self):
        self.env["TEST_CONSTELLATIONS_FORBIDDEN"] = "1"
        result = self.publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.target / "index.html").read_text(), "original site")
        self.assertFalse((self.target / "constellations").exists())

    def test_dal_published_with_correct_certificate_and_other_app_preserved(self):
        existing = [{"relation": ["delegate_permission/common.handle_all_urls"],
                     "target": {"namespace": "android_app", "package_name": "org.example.another",
                                "sha256_cert_fingerprints": ["BB:" * 31 + "BB"]}}]
        (self.target / ".well-known").mkdir()
        (self.target / ".well-known" / "assetlinks.json").write_text(json.dumps(existing))
        result = self.publish(mask=0o077)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        published = json.loads((self.target / ".well-known" / "assetlinks.json").read_text())
        self.assertEqual(published, existing + self.debug_dal)
        self.assertEqual((self.target / ".well-known" / "assetlinks.json").stat().st_mode & 0o777, 0o644)

    def test_dal_http_rejection_rolls_back_entire_site(self):
        self.env["TEST_DAL_FORBIDDEN"] = "1"
        result = self.publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.target / "index.html").read_text(), "original site")
        self.assertFalse((self.target / ".well-known" / "assetlinks.json").exists())

    def test_forbidden_public_page_restores_previous_site(self):
        self.env["TEST_PAGE_FORBIDDEN"] = "1"
        result = self.publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.target / "index.html").read_text(), "original site")
        for name in PUBLIC_PAGES:
            self.assertFalse((self.target / name).exists())

    def test_historical_release_without_public_pages_removes_stale_copies(self):
        # Unversioned static site: exercise activation, not the same-SHA no-op.
        (self.target / ".lumen-release-sha").unlink()
        for name in PUBLIC_PAGES:
            page = self.target / name
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text("stale candidate")
        self.env["TEST_HTTP_SHA"] = self.old
        result = self.publish(self.old)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        for name in PUBLIC_PAGES:
            self.assertFalse((self.target / name).exists())

    def test_forbidden_static_module_rolls_back_even_with_correct_marker(self):
        self.env["TEST_STATIC_FORBIDDEN"] = "1"
        result = self.publish(mask=0o077)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.target / "index.html").read_text(), "original site")
        self.assertEqual((self.target / ".lumen-release-sha").read_text().strip(), self.old)
        self.assertEqual((self.target / "index.html").stat().st_mode & 0o777, 0o644)

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

    def install_token(self, mode=0o600):
        folder = self.home / ".config" / "lumen"
        folder.mkdir(parents=True)
        (folder / "github-token").write_text("fixture-token\n")
        (folder / "github-token").chmod(mode)

    def test_private_repository_token_reaches_the_exact_gate(self):
        self.install_token()
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual((self.home / "gate-token").read_text(), "fixture-token")
        self.assertNotIn("fixture-token", result.stdout + result.stderr)

    def test_without_token_file_the_gate_stays_anonymous(self):
        result = self.publish()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual((self.home / "gate-token").read_text(), "")

    def test_exposed_token_file_is_refused_before_any_change(self):
        self.install_token(0o644)
        result = self.publish()
        self.assertEqual(result.returncode, 1)
        self.assertIn("mode 600", result.stderr)
        self.assertNotIn("fixture-token", result.stdout + result.stderr)
        self.assertEqual((self.target / "index.html").read_text(), "original site")

    def test_fallback_cron_authenticates_its_github_query(self):
        self.install_token()
        (self.home / "lumen-private" / ("ci-check-" + self.sha)).unlink()
        seen, sha = [], self.sha
        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                seen.append(self.headers.get("Authorization"))
                body = json.dumps({"workflow_runs": [{"head_sha": sha, "status": "completed", "conclusion": "success",
                                                      "event": "push", "head_branch": "main"}]}).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, *args):
                pass
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        env = {**self.env, "LUMEN_GITHUB_API": "http://127.0.0.1:%d" % server.server_port, "NO_PROXY": "127.0.0.1"}
        result = subprocess.run(["bash", str(ROOT / "scripts/o2switch-cron-publish.sh"), "--deploy"],
                                env=env, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual(seen, ["Bearer fixture-token"])
        self.assertEqual((self.target / ".lumen-release-sha").read_text().strip(), self.sha)

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
