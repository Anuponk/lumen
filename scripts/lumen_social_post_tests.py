#!/usr/bin/env python3
"""#1056 · Tests of the daily Facebook publisher with a fake transport (no network)."""
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lumen_social_post as social  # noqa: E402

TOKEN = "EAAB-test-token-never-logged"


def post(day, **extra):
    link = f"https://lumen.nopuna.fr/mini/{day}.html?utm_source=facebook_daily&utm_medium=social&utm_campaign=avent_2026"
    base = {"key": "facebook:" + day, "channel": "facebook", "day": day, "kind": "mini", "publishAt": "08:00",
            "message": "Case\n\n👉 " + link, "link": link, "image": f"https://lumen.nopuna.fr/content/social/mini-{day}.jpg"}
    return {**base, **extra}


class Fake:
    def __init__(self, *outcomes):
        self.outcomes, self.calls = list(outcomes), []

    def __call__(self, config, item):
        self.calls.append(item["key"])
        outcome = self.outcomes.pop(0) if self.outcomes else "123_456"
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def setup(tmp, posts, mode="live", **extra):
    plan = Path(tmp) / "social-posts.json"
    plan.write_text(json.dumps({"posts": posts}), encoding="utf-8")
    environ = {"HOME": tmp, "LUMEN_SOCIAL_MODE": mode, "LUMEN_SOCIAL_POSTS": str(plan),
               "LUMEN_SOCIAL_LEDGER": str(Path(tmp) / "private/ledger.json"), "LUMEN_SOCIAL_STOP": str(Path(tmp) / "private/stop"),
               "META_PAGE_ID": "1234567890", "META_PAGE_TOKEN": TOKEN, **extra}
    return social.env_config(environ)


def at(text):  # Paris wall time → aware instant
    return datetime.fromisoformat(text).replace(tzinfo=social.PARIS).astimezone(timezone.utc)


def ledger(config):
    path = config["ledger"]
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def check(name, condition):
    if not condition:
        raise AssertionError(name)


lines = []
log = lines.append
DAY = "2026-12-01"

with tempfile.TemporaryDirectory() as tmp:
    # Off by default: nothing read, nothing sent, nothing written.
    config = setup(tmp, [post(DAY)], mode="")
    fake = Fake()
    check("default mode is off", social.env_config({"HOME": tmp})["mode"] == "off")
    check("off does nothing", social.run({**config, "mode": "off"}, at(DAY + "T08:05"), fake, log) == 0 and not fake.calls and not ledger(config))
    check("unknown mode refused", social.run({**config, "mode": "on"}, at(DAY + "T08:05"), fake, log) == 2)

with tempfile.TemporaryDirectory() as tmp:
    config = setup(tmp, [post(DAY), post("2026-12-02")])
    fake = Fake()
    check("before 08:00 Paris nothing", social.run(config, at(DAY + "T07:59"), fake, log) == 0 and not fake.calls)
    check("08:00 publishes", social.run(config, at(DAY + "T08:00"), fake, log) == 0 and fake.calls == ["facebook:" + DAY])
    entry = ledger(config)["facebook:" + DAY]
    check("ledger published", entry["status"] == "published" and entry["post_id"] == "123_456" and entry["attempts"] == 1)
    for minute in ("08:10", "09:40", "10:50"):
        social.run(config, at(DAY + "T" + minute), fake, log)
    check("idempotent per day", fake.calls == ["facebook:" + DAY])
    check("next day is its own key", social.run(config, at("2026-12-02T08:20"), fake, log) == 0 and len(fake.calls) == 2)
    check("token never journaled", TOKEN not in config["ledger"].read_text(encoding="utf-8") and all(TOKEN not in l for l in lines))
    check("no post planned → nothing", social.run(config, at("2026-12-09T08:20"), fake, log) == 0 and len(fake.calls) == 2)

with tempfile.TemporaryDirectory() as tmp:
    # Paris time zone: 07:30 UTC is 08:30 in winter; in summer 06:30 UTC is already 08:30.
    config = setup(tmp, [post(DAY), post("2027-06-01")])
    fake = Fake()
    social.run(config, datetime(2026, 12, 1, 6, 59, tzinfo=timezone.utc), fake, log)
    check("winter: 07:59 Paris waits", not fake.calls)
    social.run(config, datetime(2026, 12, 1, 7, 0, tzinfo=timezone.utc), fake, log)
    check("winter: 08:00 Paris posts", fake.calls == ["facebook:" + DAY])
    social.run(config, datetime(2027, 6, 1, 6, 0, tzinfo=timezone.utc), fake, log)
    check("summer: 08:00 Paris posts", fake.calls[-1] == "facebook:2027-06-01")
    # Rollover: 23:30 UTC on 30 November is already 1 December in Paris, but before 08:00.
    config2 = setup(tmp, [post(DAY)], LUMEN_SOCIAL_LEDGER=str(Path(tmp) / "l2.json"))
    fake2 = Fake()
    social.run(config2, datetime(2026, 11, 30, 23, 30, tzinfo=timezone.utc), fake2, log)
    check("rollover keeps the Paris clock", not fake2.calls)

with tempfile.TemporaryDirectory() as tmp:
    config = setup(tmp, [post(DAY)])
    config["stop"].parent.mkdir(parents=True, exist_ok=True)
    config["stop"].write_text("stop")
    fake = Fake()
    check("stop file halts", social.run(config, at(DAY + "T08:30"), fake, log) == 0 and not fake.calls)

with tempfile.TemporaryDirectory() as tmp:
    # Ambiguous outcome: reserved, alert once, never retried automatically.
    config = setup(tmp, [post(DAY)])
    fake = Fake(social.Ambiguous("TimeoutError"))
    lines.clear()
    check("ambiguous alerts", social.run(config, at(DAY + "T08:05"), fake, log) == 1 and any("outcome unknown" in l for l in lines))
    check("reserved kept", ledger(config)["facebook:" + DAY]["status"] == "reserved")
    for minute in ("08:15", "08:25"):
        social.run(config, at(DAY + "T" + minute), fake, log)
    check("never retried after ambiguity", len(fake.calls) == 1)
    # Crash between reservation and request: the next run alerts once, then stays quiet.
    config2 = setup(tmp, [post(DAY)], LUMEN_SOCIAL_LEDGER=str(Path(tmp) / "crash.json"))
    social.write_ledger(config2["ledger"], {"facebook:" + DAY: {"status": "reserved", "attempts": 1}})
    lines.clear()
    fake2 = Fake()
    check("stale reservation alerts", social.run(config2, at(DAY + "T08:20"), fake2, log) == 1 and not fake2.calls)
    check("alert only once", social.run(config2, at(DAY + "T08:30"), fake2, log) == 0 and not fake2.calls)

with tempfile.TemporaryDirectory() as tmp:
    # 5xx / 429: bounded retries; 4xx: final at once.
    config = setup(tmp, [post(DAY)], LUMEN_SOCIAL_MAX_ATTEMPTS="3")
    fake = Fake(social.ProviderError(503, "down"), social.ProviderError(429, "slow"), social.ProviderError(500, "down"))
    for minute in ("08:00", "08:10", "08:20", "08:30", "08:40"):
        social.run(config, at(DAY + "T" + minute), fake, log)
    check("bounded retries", len(fake.calls) == 3 and ledger(config)["facebook:" + DAY]["status"] == "failed")
    config2 = setup(tmp, [post(DAY)], LUMEN_SOCIAL_LEDGER=str(Path(tmp) / "4xx.json"))
    fake2 = Fake(social.ProviderError(400, "OAuthException 190: token expired"))
    for minute in ("08:00", "08:10"):
        social.run(config2, at(DAY + "T" + minute), fake2, log)
    check("4xx not retried", len(fake2.calls) == 1 and ledger(config2)["facebook:" + DAY]["status"] == "failed")
    config3 = setup(tmp, [post(DAY)], LUMEN_SOCIAL_LEDGER=str(Path(tmp) / "retry.json"))
    fake3 = Fake(social.ProviderError(502, "gateway"), "999")
    social.run(config3, at(DAY + "T08:00"), fake3, log)
    social.run(config3, at(DAY + "T08:10"), fake3, log)
    check("retry then success", ledger(config3)["facebook:" + DAY]["status"] == "published" and len(fake3.calls) == 2)

with tempfile.TemporaryDirectory() as tmp:
    # Late window: after 11:00 Paris the post is skipped, not published at noon.
    config = setup(tmp, [post(DAY)])
    fake = Fake()
    lines.clear()
    check("late skip alerts", social.run(config, at(DAY + "T11:01"), fake, log) == 1 and not fake.calls)
    check("late is final", ledger(config)["facebook:" + DAY]["status"] == "skipped-late")

with tempfile.TemporaryDirectory() as tmp:
    # Dry-run journals the post without calling Meta and does not block live.
    config = setup(tmp, [post(DAY)], mode="dry-run")
    fake = Fake()
    check("dry-run ok", social.run(config, at(DAY + "T08:05"), fake, log) == 0 and not fake.calls)
    check("dry-run journal", ledger(config)["dry-run:facebook:" + DAY]["status"] == "dry-run")
    check("live after dry-run", social.run({**config, "mode": "live"}, at(DAY + "T08:06"), fake, log) == 0 and fake.calls == ["facebook:" + DAY])

with tempfile.TemporaryDirectory() as tmp:
    # Validation: foreign link, missing campaign, mismatched day or image are refused.
    bad = [post(DAY, link="https://example.com/x", message="https://example.com/x"),
           post(DAY, link="https://lumen.nopuna.fr/mini/x.html", message="https://lumen.nopuna.fr/mini/x.html"),
           post(DAY, key="facebook:2026-12-02"),
           post(DAY, image="https://example.com/a.jpg")]
    for index, item in enumerate(bad):
        config = setup(tmp, [item], LUMEN_SOCIAL_LEDGER=str(Path(tmp) / f"bad{index}.json"))
        fake = Fake()
        check(f"invalid post {index} refused", social.run(config, at(DAY + "T08:05"), fake, log) == 1 and not fake.calls)
        check(f"invalid post {index} final", ledger(config)["facebook:" + DAY]["status"] == "rejected")
    check("fallback without image accepted", social.validate_post(post(DAY, image=None), DAY) is None)
    # Corrupt ledger: refuse rather than risk a duplicate.
    config = setup(tmp, [post(DAY)], LUMEN_SOCIAL_LEDGER=str(Path(tmp) / "corrupt.json"))
    config["ledger"].write_text("{not json")
    fake = Fake()
    check("corrupt ledger refuses", social.run(config, at(DAY + "T08:05"), fake, log) == 1 and not fake.calls)
    # Missing credentials: a provider error, never a request.
    try:
        social.meta_transport({**social.env_config({"HOME": tmp}), "page_id": "", "token": ""}, post(DAY))
        raise AssertionError("transport without credentials")
    except social.ProviderError as error:
        check("credentials required", error.status == 0)

# The committed plan itself passes the publisher's validation, one post per day.
plan = json.loads((Path(__file__).resolve().parent.parent / "content/generated/social-posts.json").read_text(encoding="utf-8"))
keys = [p["key"] for p in plan["posts"]]
check("one post per day", len(keys) == len(set(keys)))
for item in plan["posts"]:
    social.validate_post(item, item["day"])

# Aggregated counts from the access log: counters only, robots ignored, Paris day.
import lumen_mini_counts as counts  # noqa: E402

UA = '"https://m.facebook.com/" "Mozilla/5.0 (Linux; Android 14) FBAN/FB4A"'
log_lines = [
    '203.0.113.7 - - [01/Dec/2026:08:12:00 +0100] "GET /mini/t.gif?e=view&d=2026-12-01&l=fr&s=facebook_daily HTTP/2.0" 200 43 ' + UA,
    '203.0.113.8 - - [01/Dec/2026:08:13:00 +0100] "GET /mini/t.gif?e=view&d=2026-12-01&l=fr&s=facebook_daily HTTP/2.0" 200 43 ' + UA,
    '203.0.113.8 - - [01/Dec/2026:08:14:00 +0100] "GET /mini/t.gif?e=win&d=2026-12-01&l=fr&s=facebook_daily HTTP/2.0" 200 43 ' + UA,
    '203.0.113.8 - - [01/Dec/2026:08:14:30 +0100] "GET /mini/t.gif?e=cta_discover&d=2026-12-01&l=fr&s=facebook_daily HTTP/2.0" 200 43 ' + UA,
    '203.0.113.8 - - [01/Dec/2026:08:15:00 +0100] "GET /decouvrir.html?utm_source=mini_puzzle&utm_medium=referral&utm_campaign=mini_2026-12-01 HTTP/2.0" 200 9000 ' + UA,
    '203.0.113.9 - - [01/Dec/2026:08:11:00 +0100] "GET /mini/2026-12-01.html?utm_source=facebook_daily&utm_medium=social&utm_campaign=avent_2026 HTTP/2.0" 200 4100 ' + UA,
    '203.0.113.9 - - [01/Dec/2026:09:00:00 +0100] "GET /?daily=1&utm_source=facebook_daily&utm_medium=social&utm_campaign=daily_2026-12-01 HTTP/2.0" 200 30000 ' + UA,
    # Ignored: Facebook preview crawler, another Paris day, error, unknown event, tampered values.
    '31.13.1.1 - - [01/Dec/2026:08:00:05 +0100] "GET /mini/2026-12-01.html?utm_source=facebook_daily HTTP/1.1" 200 4100 "-" "facebookexternalhit/1.1"',
    '203.0.113.7 - - [30/Nov/2026:23:59:59 +0100] "GET /mini/t.gif?e=view&d=2026-12-01&l=fr&s=direct HTTP/2.0" 200 43 ' + UA,
    '203.0.113.7 - - [01/Dec/2026:10:00:00 +0100] "GET /mini/t.gif?e=view&d=2026-12-01&l=fr&s=direct HTTP/2.0" 404 0 ' + UA,
    '203.0.113.7 - - [01/Dec/2026:10:00:00 +0100] "GET /mini/t.gif?e=hack&d=2026-12-01&l=fr&s=direct HTTP/2.0" 200 43 ' + UA,
    '203.0.113.7 - - [01/Dec/2026:10:00:00 +0100] "GET /mini/t.gif?e=view&d=2026-12-01&l=fr&s=someone@example.com HTTP/2.0" 200 43 ' + UA,
    'garbage line',
]
result = counts.aggregate(log_lines, "2026-12-01")
metrics = result["metrics"]
total = lambda name: sum(item["count"] for item in metrics.get(name, []))
check("views counted", total("mini_view") == 2)
check("win counted", total("mini_win") == 1 and total("mini_cta_discover") == 1)
check("landings counted", total("landing_mini") == 1 and total("landing_official") == 1 and total("landing_discover") == 1)
check("official landing day", metrics["landing_official"][0]["day"] == "2026-12-01")
text = json.dumps(result)
check("no identifier kept", "203.0.113" not in text and "Mozilla" not in text and "example.com" not in text)
check("robots ignored", total("landing_mini") == 1)
with tempfile.TemporaryDirectory() as tmp:
    log_file = Path(tmp) / "lumen.nopuna.fr-ssl_log"
    log_file.write_text("".join(line + "\n" for line in log_lines), encoding="utf-8")
    code = counts.main({"LUMEN_ACCESS_LOGS": str(log_file), "LUMEN_COUNTS_DIR": str(Path(tmp) / "out"), "LUMEN_COUNTS_DAY": "2026-12-01"})
    written = json.loads((Path(tmp) / "out/2026-12-01.json").read_text(encoding="utf-8"))
    check("counts file written", code == 0 and written["metrics"] == metrics)

# Owner helper: token exchange, page choice, private file, check without publishing.
import importlib.util  # noqa: E402

spec = importlib.util.spec_from_file_location("meta_page_token", Path(__file__).resolve().parent / "meta-page-token.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class Response:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return self.payload


calls = []


def opener(url, timeout=20):
    calls.append(url)
    path = url.split("?")[0].split("/v23.0")[1]
    if path == "/oauth/access_token":
        return Response({"access_token": "LONG-USER"})
    if path == "/me/permissions":
        return Response({"data": [{"permission": p, "status": "granted"} for p in ("pages_manage_posts", "pages_read_engagement", "pages_show_list")]})
    if path == "/me/accounts":
        return Response({"data": [{"id": "111", "name": "Autre", "access_token": "T1", "tasks": ["ANALYZE"]},
                                  {"id": "222", "name": "LUMEN", "access_token": "PAGE-TOKEN", "tasks": ["CREATE_CONTENT", "MANAGE"]}]})
    if path == "/222":
        return Response({"id": "222", "name": "LUMEN"})
    if path == "/222/feed":
        return Response({"data": []})
    raise AssertionError(path)


answers = iter(["123456", "1"])
secrets = iter(["app-secret", "short-token"])
shown = []
with tempfile.TemporaryDirectory() as tmp:
    helper.ENV_FILE = Path(tmp) / "lumen-private/social-post.env"
    values = helper.setup(ask=lambda _: next(answers), secret=lambda _: next(secrets), opener=opener, out=shown.append)
    check("only publishable pages listed", shown == ["  1. LUMEN (222)"])
    check("page token chosen", values["META_PAGE_ID"] == "222" and values["META_PAGE_TOKEN"] == "PAGE-TOKEN")
    check("dry-run by default", values["LUMEN_SOCIAL_MODE"] == "dry-run")
    helper.write_env(values, helper.ENV_FILE)
    check("env readable back", helper.read_env(helper.ENV_FILE)["META_PAGE_ID"] == "222")
    if os.name == "posix":
        check("env mode 600", (helper.ENV_FILE.stat().st_mode & 0o777) == 0o600)
    check("check reads, never posts", helper.check(values, opener) == "LUMEN" and all("/feed?" not in c or "limit=1" in c for c in calls))
    check("secrets only sent to Meta", all(c.startswith("https://graph.facebook.com/") for c in calls))

print("lumen_social_post_tests: mode, stop, Paris window, idempotence, ambiguity, retries, dry-run, validation, access-log counts and token helper OK")
