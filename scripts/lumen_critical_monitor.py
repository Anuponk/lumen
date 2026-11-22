"""Public probe from an independent runner; incident writes and mail are opt-in."""

import json
import os
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import URLError
from urllib.request import Request, build_opener

from lumen_activity_mail import NoRedirect, digest_settings, drain, enqueue_digest, supabase_client

SITE = "https://lumen.nopuna.fr"
KINDS = ["incident_open", "incident_resolved", "purchase_missing_access", "purchase_access_restored"]


class GameShell(HTMLParser):
    def __init__(self):
        super().__init__()
        self.builds = []
        self.board = False
        self.entry = False

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if tag == "meta" and fields.get("name") == "lumen-build":
            self.builds.append(fields.get("content", ""))
        if fields.get("id") == "board":
            self.board = True
        if tag == "script" and fields.get("type") == "module":
            self.entry |= fields.get("src") in ("./src/main.js", "/src/main.js")


def public_read(path, content_type, limit):
    request = Request(SITE + path, headers={"Cache-Control": "no-cache"})
    with build_opener(NoRedirect()).open(request, timeout=8) as response:
        if response.status != 200 or response.headers.get_content_type() != content_type:
            raise ValueError("unexpected public response")
        body = response.read(limit + 1)
        if len(body) > limit:
            raise ValueError("public response exceeds budget")
        return body.decode("utf-8")


def probe_once(read):
    try:
        info = json.loads(read("/build-info.json", "application/json", 4096))
        sha, version = info["sha"], info["version"]
        if not isinstance(sha, str) or not isinstance(version, str):
            return "invalid_build"
        if not re.fullmatch(r"[a-f0-9]{40}", sha) or not re.fullmatch(r"\d+\.\d+\.\d+\+\d+", version):
            return "invalid_build"
        shell = GameShell()
        shell.feed(read("/", "text/html", 512_000))
        if not (shell.entry and shell.board and len(shell.builds) == 1):
            return "invalid_shell"
        if shell.builds[0] != version + " · " + sha[:7]:
            return "revision_mismatch"
        return "healthy"
    except (KeyError, TypeError, ValueError, URLError, OSError):
        return "unavailable"


def probe(read=public_read):
    first = probe_once(read)
    return probe_once(read) if first == "revision_mismatch" else first


def tick(rpc, send, config, result, now=None):
    if rpc("lumen_observe_critical_incidents", {
        "p_sample": config["sample"], "p_probe_ok": result == "healthy",
        "p_stall_minutes": config["stall_minutes"], "p_failures": config["failures"],
        "p_recoveries": config["recoveries"], "p_backlog": config["backlog"],
    }) is not True:
        raise RuntimeError("incident observation busy or unavailable")
    performance_unavailable = False
    if config.get("performance"):
        try:
            rpc("lumen_observe_performance", {})
        except RuntimeError:
            performance_unavailable = True
    digest = config.get("digest")
    digest_unavailable = bool(digest and digest.get("invalid"))
    try:
        enqueue_digest(rpc, digest, now or datetime.now(timezone.utc))
    except RuntimeError:
        digest_unavailable = True
    outcome = {}
    if send is not None:
        if digest and not digest.get("invalid"):
            config = {**config, "kinds": [*config["kinds"], "daily_summary"],
                      "digest_recipient": digest["recipient"]}
        outcome = drain(
            lambda payload: rpc("lumen_claim_activity_mail", payload),
            lambda payload: rpc("lumen_finish_activity_mail", payload),
            send, config,
        )
    if performance_unavailable:
        outcome['performance_unavailable'] = 1
    if digest_unavailable:
        outcome['digest_unavailable'] = 1
    return outcome


def main(env):
    result = probe()
    print("Lumen public probe:", result)
    if env.get("LUMEN_CRITICAL_MONITOR_ENABLED") != "1":
        return int(result != "healthy")
    try:
        config = {
            "performance": env.get("LUMEN_PERFORMANCE_MONITOR_ENABLED") == "1",
            "digest": digest_settings(env, require_recipient=False),
            "sample": int(env["LUMEN_PROBE_SAMPLE"]),
            "stall_minutes": int(env.get("LUMEN_CRITICAL_STALL_MINUTES", "15")),
            "failures": int(env.get("LUMEN_CRITICAL_FAILURES", "3")),
            "recoveries": int(env.get("LUMEN_CRITICAL_RECOVERIES", "2")),
            "backlog": int(env.get("LUMEN_CRITICAL_BACKLOG", "20")),
        }
        outcome = tick(supabase_client(env), None, config, result)
    except (RuntimeError, KeyError, ValueError, TypeError, OSError):
        print("Lumen critical monitor: processing interrupted", file=sys.stderr)
        return 1
    if outcome:
        print(json.dumps(outcome, sort_keys=True))
    return int(any(outcome.get(key) for key in ("rejected", "unknown", "performance_unavailable", "digest_unavailable")))


if __name__ == "__main__":
    sys.exit(main(os.environ))
