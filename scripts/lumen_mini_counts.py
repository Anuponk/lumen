#!/usr/bin/env python3
"""#1057 / #1056 · Aggregated acquisition counts from the o2switch access log.

No Supabase write, no cookie, no identifier: the public mini-puzzle requests a
static pixel (/mini/t.gif?e=…&d=…&l=…&s=…) and campaign links carry UTM codes.
This script reads yesterday's lines (Paris date) from the access logs and keeps
only counters per event, day, source and language. IP addresses, user agents and
referrers are never written. Robots (including Facebook's link preview crawler)
are ignored.

Environment:
  LUMEN_ACCESS_LOGS   glob of log files (default ~/access-logs/lumen.nopuna.fr*; .gz read too)
  LUMEN_COUNTS_DIR    output directory (default ~/lumen-private/acquisition)
  LUMEN_COUNTS_DAY    AAAA-MM-JJ to aggregate (default: yesterday in Paris)
"""
import glob
import gzip
import json
import os
import re
import sys
import urllib.parse
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lumen_social_post import paris_local  # noqa: E402

LINE = re.compile(r'^\S+ \S+ \S+ \[(?P<at>[^\]]+)\] "(?P<method>GET|HEAD) (?P<target>\S+) [^"]*" (?P<status>\d{3}) \S+(?: "[^"]*" "(?P<ua>[^"]*)")?')
EVENTS = {"view", "win", "cta_discover", "cta_install", "cta_official", "share"}
SOURCES = {"facebook_daily", "facebook", "instagram", "mini_share", "mini_puzzle", "direct"}
LANGS = {"fr", "en", "es"}
BOT = re.compile(r"bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|preview|headless", re.I)
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_time(text):
    try:
        return datetime.strptime(text, "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return None


def classify(target):
    """(metric, day, source, language) for a counted request, else None."""
    parts = urllib.parse.urlsplit(target)
    query = urllib.parse.parse_qs(parts.query)
    one = lambda name: (query.get(name) or [""])[0]
    if parts.path == "/mini/t.gif":
        event, day, source, lang = one("e"), one("d"), one("s"), one("l")
        if event in EVENTS and DAY.match(day) and source in SOURCES and lang in LANGS:
            return ("mini_" + event, day, source, lang)
        return None
    source = one("utm_source")
    if source not in {"facebook_daily", "mini_puzzle", "mini_share"}:
        return None
    if re.fullmatch(r"/mini/\d{4}-\d{2}-\d{2}\.html", parts.path):
        return ("landing_mini", parts.path[6:16], source, "")
    if parts.path in {"/", "/index.html"} and one("daily") == "1":
        return ("landing_official", one("utm_campaign")[6:16] if one("utm_campaign").startswith("daily_") else "", source, "")
    if parts.path in {"/decouvrir.html", "/discover.html", "/descubrir.html"}:
        return ("landing_discover", one("utm_campaign")[5:15] if one("utm_campaign").startswith("mini_") else "", source, "")
    if parts.path in {"/", "/index.html"} and one("install") == "1":
        return ("landing_install", one("utm_campaign")[5:15] if one("utm_campaign").startswith("mini_") else "", source, "")
    return None


def aggregate(lines, day: str) -> dict:
    counts: Counter = Counter()
    for raw in lines:
        match = LINE.match(raw)
        if not match or match["status"] not in {"200", "304"}:
            continue
        if BOT.search(match["ua"] or ""):
            continue
        at = parse_time(match["at"])
        if not at or paris_local(at).strftime("%Y-%m-%d") != day:
            continue
        found = classify(match["target"])
        if found:
            counts[found] += 1
    out: dict = {}
    for (metric, puzzle_day, source, lang), value in sorted(counts.items()):
        out.setdefault(metric, []).append({"day": puzzle_day, "source": source, "lang": lang, "count": value})
    return {"schema": "lumen-acquisition-counts-v1", "logDay": day, "timeZone": "Europe/Paris", "metrics": out}


def read_lines(pattern: str):
    for path in sorted(glob.glob(os.path.expanduser(pattern))):
        opener = gzip.open if path.endswith(".gz") else open
        try:
            with opener(path, "rt", encoding="utf-8", errors="replace") as handle:
                yield from handle
        except OSError:
            continue


def main(environ=os.environ) -> int:
    day = environ.get("LUMEN_COUNTS_DAY") or (paris_local(datetime.now(timezone.utc)) - timedelta(days=1)).strftime("%Y-%m-%d")
    if not DAY.match(day):
        print("Lumen counts: invalid day", file=sys.stderr)
        return 2
    pattern = environ.get("LUMEN_ACCESS_LOGS", "~/access-logs/lumen.nopuna.fr*")
    result = aggregate(read_lines(pattern), day)
    out_dir = Path(os.path.expanduser(environ.get("LUMEN_COUNTS_DIR", "~/lumen-private/acquisition")))
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / (day + ".json")
    tmp = target.with_suffix(".tmp")
    tmp.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(tmp, target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
