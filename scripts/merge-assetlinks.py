#!/usr/bin/env python3
"""Publish Android Digital Asset Links without discarding existing associations.

Usage: merge-assetlinks.py EXISTING_FILE DESIRED_FILE OUTPUT_FILE
The existing file may be absent. Both present files must be valid DAL JSON arrays.
"""
import json
import os
from pathlib import Path
import re
import sys
import tempfile

RELATION = "delegate_permission/common.handle_all_urls"
FINGERPRINT = re.compile(r"(?:[0-9A-F]{2}:){31}[0-9A-F]{2}")


def load(path, *, required):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        if required:
            raise
        return []
    if not isinstance(data, list) or any(not isinstance(item, dict) for item in data):
        raise ValueError(f"Invalid DAL array: {path}")
    return data


def is_app_link(item):
    target = item.get("target")
    return (
        isinstance(target, dict)
        and target.get("namespace") == "android_app"
        and isinstance(target.get("package_name"), str)
        and item.get("relation") == [RELATION]
    )


def merge(existing, desired):
    result = list(existing)
    for entry in desired:
        if not is_app_link(entry):
            raise ValueError("Desired entries must be precise Android handle_all_urls statements")
        target = entry["target"]
        hashes = target.get("sha256_cert_fingerprints")
        if (
            not isinstance(hashes, list)
            or not hashes
            or any(not isinstance(value, str) or not FINGERPRINT.fullmatch(value) for value in hashes)
        ):
            raise ValueError("Invalid certificate fingerprint")
        matches = [
            index for index, value in enumerate(result)
            if is_app_link(value) and value["target"]["package_name"] == target["package_name"]
        ]
        if matches:
            combined = []
            for index in matches:
                candidate = result[index]["target"].get("sha256_cert_fingerprints", [])
                if not isinstance(candidate, list):
                    raise ValueError("Existing app certificate fingerprints malformed")
                combined.extend(candidate)
            combined.extend(hashes)
            first = matches[0]
            result[first] = {
                **result[first],
                "target": {
                    **result[first]["target"],
                    "sha256_cert_fingerprints": list(dict.fromkeys(combined)),
                },
            }
            for index in reversed(matches[1:]):
                del result[index]
        else:
            result.append(entry)
    return result


def publish(existing_file, desired_file, destination):
    if destination.is_symlink() or destination.parent.is_symlink():
        raise ValueError("Refuse to write through a symlink")
    existing = load(existing_file, required=False)
    desired = load(desired_file, required=True)
    updated = merge(existing, desired)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".assetlinks.", dir=destination.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as output:
            json.dump(updated, output, indent=2)
            output.write("\n")
        os.chmod(temporary, 0o644)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: merge-assetlinks.py EXISTING DESIRED OUTPUT")
    publish(*(Path(arg) for arg in sys.argv[1:]))
