"""Publish one signed Lumen bundle to the configured, existing closed-test track."""

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener


PACKAGE = "com.nopuna.lumen"
HOST = "https://androidpublisher.googleapis.com"
APP = f"/androidpublisher/v3/applications/{PACKAGE}"
MAX_CODE = 2_100_000_000


class ReleaseError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def publisher(token):
    opener = build_opener(NoRedirect())

    def request(method, path, data=None):
        headers = {"Authorization": f"Bearer {token}"}
        if isinstance(data, bytes):
            headers["Content-Type"] = "application/octet-stream"
        elif data is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(data).encode()
        try:
            with opener.open(Request(HOST + path, data=data, headers=headers, method=method),
                             timeout=180 if isinstance(data, bytes) else 30) as response:
                payload = response.read()
                return json.loads(payload) if payload else {}
        except HTTPError as error:
            raise ReleaseError(f"Play rejected {method} {path} (HTTP {error.code})") from None
        except (URLError, TimeoutError):
            raise ReleaseError(f"Play request interrupted: {method} {path}") from None

    return request


def closed_track(name):
    if (not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,99}", name)
        or name.lower() in {"production", "beta", "open", "internal", "qa"}):
        raise ReleaseError("Set the API ID of an existing closed testing track")
    return name


@contextmanager
def play_edit(request):
    edit_id = request("POST", f"{APP}/edits", {})["id"]
    edit = f"{APP}/edits/{quote(edit_id, safe='')}"
    committed = False

    def commit():
        nonlocal committed
        request("POST", f"{edit}:commit")
        committed = True

    try:
        yield edit, commit
    finally:
        if not committed:
            try:
                request("DELETE", edit)
            except ReleaseError:
                print("Play did not confirm disposal of the edit.", file=sys.stderr)


def check_track(request, edit, track):
    path = f"{edit}/tracks/{quote(track, safe='')}"
    selected = request("GET", path)
    if selected.get("track") != track:
        raise ReleaseError("Play did not confirm the exact configured track")
    if any(release.get("status") != "completed" for release in selected.get("releases", [])):
        raise ReleaseError("The selected track has an unfinished release; resolve it in Play Console")
    return path


def highest_code(request, edit, baseline):
    codes = [baseline]
    for resource in ("bundles", "apks"):
        codes.extend(int(item["versionCode"]) for item in request("GET", f"{edit}/{resource}").get(resource, []))
    for track in request("GET", f"{edit}/tracks").get("tracks", []):
        for release in track.get("releases", []):
            codes.extend(int(code) for code in release.get("versionCodes", []))
    return max(codes)


def next_code(request, track, baseline):
    with play_edit(request) as (edit, _):
        check_track(request, edit, track)
        code = highest_code(request, edit, baseline) + 1
        if code > MAX_CODE:
            raise ReleaseError("No Android versionCode remains in the Google Play range")
        return code


def publish(request, track, baseline, version, name, bundle):
    digest = hashlib.sha256(bundle).hexdigest()
    with play_edit(request) as (edit, commit):
        path = check_track(request, edit, track)
        if not highest_code(request, edit, baseline) < version <= MAX_CODE:
            raise ReleaseError("The versionCode is no longer available; run the workflow again")
        upload = request("POST", f"/upload{edit}/bundles?uploadType=media", bundle)
        if upload.get("versionCode") != version or upload.get("sha256", "").lower() != digest:
            raise ReleaseError("Play returned a different versionCode or AAB SHA-256")
        request("PUT", path, {"track": track, "releases": [{
            "name": name, "versionCodes": [str(version)], "status": "completed",
        }]})
        request("POST", f"{edit}:validate")
        commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--track", required=True)
    parser.add_argument("--baseline", type=int, required=True)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("next-code")
    release = sub.add_parser("publish")
    release.add_argument("--bundle", type=Path, required=True)
    release.add_argument("--version", type=int, required=True)
    release.add_argument("--name", required=True)
    args = parser.parse_args()
    try:
        track = closed_track(args.track)
        token = os.environ.get("PLAY_ACCESS_TOKEN")
        if not token:
            raise ReleaseError("Missing Google Play publishing access token")
        request = publisher(token)
        if args.command == "next-code":
            print(next_code(request, track, args.baseline))
        else:
            publish(request, track, args.baseline, args.version, args.name, args.bundle.read_bytes())
            print(f"Google Play committed {PACKAGE} ({args.version}) to closed track {track}.")
    except (ReleaseError, OSError, KeyError, ValueError) as error:
        print(f"Closed test release: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
