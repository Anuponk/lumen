#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["astropy==7.2.0", "astroquery==0.4.10"]
# ///
"""Offline-only build preparation: fetch VizieR I/311/hip2, select *line* HIP IDs.

Usage (after checking source licenses):
    uv run scripts/fetch-hipparcos-line-stars.py western-index.json hip-lines.json

No client credentials, no changes to cloud storage, no browser runtime networking.
Coordinates are ICRS from Hipparcos New Reduction, epoch J1991.25.
"""
import argparse
import json
import math
from pathlib import Path

from astropy.table import Table
from astroquery.vizier import Vizier

CATALOGUE = "I/311/hip2"

def referenced_hip_ids(index):
    result = set()
    for figure in index["constellations"]:
        for raw in figure.get("lines", []):
            line = raw[1:] if raw and raw[0] in ("thin", "bold") else raw
            for value in line:
                if not isinstance(value, int) or value <= 0:
                    raise ValueError(f"Unsupported line reference {value!r}")
                result.add(value)
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stellarium_json", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("--cache", type=Path, default=Path(".cache/hipparcos2.ecsv"))
    args = parser.parse_args()
    index = json.loads(args.stellarium_json.read_text())
    needed = referenced_hip_ids(index)
    if not args.cache.exists():
        print(f"Fetching {CATALOGUE} from VizieR; this may take some time.")
        tables = Vizier(columns=["*"], row_limit=-1).get_catalogs(CATALOGUE)
        if not tables:
            raise RuntimeError("VizieR returned no Hipparcos catalog")
        args.cache.parent.mkdir(parents=True, exist_ok=True)
        tables[0].write(args.cache, format="ascii.ecsv", overwrite=True)
    table = Table.read(args.cache, format="ascii.ecsv")
    if not {"HIP", "RArad", "DErad"}.issubset(table.colnames):
        raise RuntimeError("Missing required HIP / RArad / DErad columns")
    coords = {}
    for row in table:
        hip = int(row["HIP"])
        if hip not in needed:
            continue
        ra = float(row["RArad"])
        dec = float(row["DErad"])
        if math.isfinite(ra) and math.isfinite(dec):
            coords[str(hip)] = {"raDeg": math.degrees(ra) % 360, "decDeg": math.degrees(dec)}
    missing = sorted(needed - set(map(int, coords)))
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(coords, indent=2, sort_keys=True) + "\n")
    print(f"Line HIP coordinates: {len(coords)}/{len(needed)}; missing: {missing[:20]}")
    if missing:
        raise SystemExit(2)

if __name__ == "__main__":
    main()
