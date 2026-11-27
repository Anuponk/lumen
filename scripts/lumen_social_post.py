#!/usr/bin/env python3
"""#1056 · Daily 08:00 Europe/Paris Facebook post, run by the o2switch cron.

The plan (content/generated/social-posts.json, published with the site) holds one
post per day. This script publishes today's post at most once:

* LUMEN_SOCIAL_MODE: ``off`` (default, does nothing), ``dry-run`` (journal only,
  never calls Meta) or ``live``.
* Stop file (``LUMEN_SOCIAL_STOP``): its presence stops everything at once.
* Ledger (``LUMEN_SOCIAL_LEDGER``, private): one entry per ``facebook:AAAA-MM-JJ``
  key, written and fsynced *before* the request. ``published`` is final. An
  ambiguous outcome (timeout, connection lost after sending) stays ``reserved``
  and is never retried automatically: an operator checks the Page first.
* Bounded retries for clear provider errors (HTTP 429/5xx), never for 4xx.
* Window: from LUMEN_SOCIAL_PUBLISH_AT (08:00) to LUMEN_SOCIAL_LATEST (11:00) Paris time.
* Alerts: one line on stderr (cron mail) and a non-zero exit code.

No Supabase call, no secret in the repository: META_PAGE_ID and META_PAGE_TOKEN
come from the private environment file loaded by o2switch-social-post.sh.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

try:  # o2switch (Linux); the local test suite may run elsewhere.
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None

PARIS = ZoneInfo("Europe/Paris")
SITE = "https://lumen.nopuna.fr/"
MODES = {"off", "dry-run", "live"}
KEEP_ENTRIES = 120


class Ambiguous(Exception):
    """The request may have reached Meta: never retry automatically."""


class ProviderError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def env_config(environ=os.environ) -> dict:
    home = Path(environ.get("HOME", "."))
    return {
        "mode": environ.get("LUMEN_SOCIAL_MODE", "off").strip() or "off",
        "plan": Path(environ.get("LUMEN_SOCIAL_POSTS", home / "lumen.nopuna.fr/content/generated/social-posts.json")),
        "ledger": Path(environ.get("LUMEN_SOCIAL_LEDGER", home / "lumen-private/social-post-ledger.json")),
        "stop": Path(environ.get("LUMEN_SOCIAL_STOP", home / "lumen-private/social-post.stop")),
        "publish_at": environ.get("LUMEN_SOCIAL_PUBLISH_AT", "08:00"),
        "latest": environ.get("LUMEN_SOCIAL_LATEST", "11:00"),
        "max_attempts": int(environ.get("LUMEN_SOCIAL_MAX_ATTEMPTS", "3")),
        "page_id": environ.get("META_PAGE_ID", ""),
        "token": environ.get("META_PAGE_TOKEN", ""),
        "graph_version": environ.get("META_GRAPH_VERSION", "v27.0"),
    }


def validate_post(post: dict, day: str) -> None:
    if post.get("day") != day or post.get("key") != "facebook:" + day or post.get("channel") != "facebook":
        raise ValueError("post does not match today")
    link = post.get("link", "")
    if not link.startswith(SITE):
        raise ValueError("link outside lumen.nopuna.fr")
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(link).query)
    if query.get("utm_source") != ["facebook_daily"]:
        raise ValueError("link without the facebook_daily campaign")
    message = post.get("message", "")
    if not message or len(message) > 2000 or link not in message:
        raise ValueError("invalid message")
    image = post.get("image")
    if image is not None and not image.startswith(SITE + "content/social/"):
        raise ValueError("image outside content/social")


def meta_transport(config: dict, post: dict, timeout: float = 20) -> str:
    """Publish a link post on the Page; Facebook shows the page's Open Graph image."""
    if not config["page_id"].isdigit() or not config["token"]:
        raise ProviderError(0, "META_PAGE_ID / META_PAGE_TOKEN missing")
    url = f"https://graph.facebook.com/{config['graph_version']}/{config['page_id']}/feed"
    body = urllib.parse.urlencode({"message": post["message"], "link": post["link"], "access_token": config["token"]}).encode()
    request = urllib.request.Request(url, data=body, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read().decode() or "{}").get("error", {})
            message = f"{detail.get('type', 'error')} {detail.get('code', '')}: {detail.get('message', '')}"[:300]
        except Exception:
            message = f"HTTP {error.code}"
        raise ProviderError(error.code, message) from None
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise Ambiguous(type(error).__name__) from None
    post_id = str(payload.get("id", ""))
    if not post_id:
        raise Ambiguous("response without id")
    return post_id


def read_ledger(path: Path) -> dict:
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("ledger is not an object")
    return data


def write_ledger(path: Path, ledger: dict) -> None:
    keep = dict(sorted(ledger.items())[-KEEP_ENTRIES:])
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(keep, handle, ensure_ascii=False, indent=1, sort_keys=True)
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def run(config: dict, now: datetime | None = None, transport=meta_transport, log=lambda line: print(line, file=sys.stderr)) -> int:
    mode = config["mode"]
    if mode not in MODES:
        log(f"Lumen social post: unknown mode {mode!r}")
        return 2
    if mode == "off":
        return 0
    if config["stop"].exists():
        return 0
    local = (now or datetime.now(timezone.utc)).astimezone(PARIS)
    day, clock = local.strftime("%Y-%m-%d"), local.strftime("%H:%M")
    if clock < config["publish_at"]:
        return 0
    try:
        plan = json.loads(config["plan"].read_text(encoding="utf-8"))
    except Exception as error:
        log(f"Lumen social post: plan unreadable ({type(error).__name__})")
        return 1
    post = next((p for p in plan.get("posts", []) if p.get("day") == day), None)
    if post is None:
        return 0
    config["ledger"].parent.mkdir(parents=True, exist_ok=True)
    with open(str(config["ledger"]) + ".lock", "w") as lock:
        if fcntl:
            fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            ledger = read_ledger(config["ledger"])
        except Exception:
            log("Lumen social post: ledger unreadable, nothing published")
            return 1
        # The key comes from the Paris date, never from the plan: one post per day and channel.
        key = ("dry-run:" if mode == "dry-run" else "") + "facebook:" + day
        entry = ledger.get(key, {})
        status = entry.get("status")
        if status in {"published", "dry-run", "skipped-late", "rejected", "failed"}:
            return 0
        if status == "reserved":
            if not entry.get("alerted"):
                entry["alerted"] = True
                ledger[key] = entry
                write_ledger(config["ledger"], ledger)
                log(f"Lumen social post: {key} outcome unknown; check the Page, then set the entry to published or delete it")
                return 1
            return 0
        attempts = int(entry.get("attempts", 0))
        if attempts >= config["max_attempts"]:
            return 0
        base = {"day": day, "kind": post.get("kind"), "attempts": attempts, "at": local.isoformat(timespec="seconds")}
        try:
            validate_post(post, day)
        except ValueError as error:
            ledger[key] = {**base, "status": "rejected", "error": str(error)}
            write_ledger(config["ledger"], ledger)
            log(f"Lumen social post: {key} rejected ({error})")
            return 1
        if clock > config["latest"]:
            ledger[key] = {**base, "status": "skipped-late"}
            write_ledger(config["ledger"], ledger)
            log(f"Lumen social post: {key} not published before {config['latest']}; skipped")
            return 1
        if mode == "dry-run":
            ledger[key] = {**base, "status": "dry-run", "link": post["link"], "chars": len(post["message"])}
            write_ledger(config["ledger"], ledger)
            log(f"Lumen social post: dry-run {key} ({post['kind']}) ready")
            return 0
        ledger[key] = {**base, "status": "reserved", "attempts": attempts + 1}
        write_ledger(config["ledger"], ledger)
        try:
            post_id = transport(config, post)
        except Ambiguous as error:
            log(f"Lumen social post: {key} outcome unknown ({error}); not retried")
            ledger[key]["alerted"] = True
            write_ledger(config["ledger"], ledger)
            return 1
        except ProviderError as error:
            retry = error.status == 429 or error.status >= 500
            final = not retry or attempts + 1 >= config["max_attempts"]
            ledger[key] = {**base, "attempts": attempts + 1, "status": "failed" if final else "retry", "error": str(error)[:300]}
            write_ledger(config["ledger"], ledger)
            log(f"Lumen social post: {key} failed ({error})" + ("" if final else "; will retry"))
            return 1
        ledger[key] = {**base, "attempts": attempts + 1, "status": "published", "post_id": post_id}
        write_ledger(config["ledger"], ledger)
        return 0


if __name__ == "__main__":
    sys.exit(run(env_config()))
