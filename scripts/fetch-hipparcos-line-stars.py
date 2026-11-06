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
VizieR I/311/hip2 fields RArad and DErad are ALREADY IN DEGREES, despite
misleading column names. NEVER apply math.degrees to these values.
"""
import argparse
import json
import math
from pathlib import Path

CATALOGUE = "I/311/hip2"
# Official VizieR installations: https://vizier.cfa.harvard.edu/vizier/mirrors.gml
VIZIER_SERVERS = ("vizier.cds.unistra.fr", "vizier.cfa.harvard.edu")

def fetch_hipparcos_table(query_factory, network_errors):
    last_error = None
    for server in VIZIER_SERVERS:
        try:
            tables = query_factory(columns=["*"], row_limit=-1, vizier_server=server, timeout=30).get_catalogs(CATALOGUE)
        except network_errors as error:
            last_error = error
            print(f"VizieR network failure on {server}: {type(error).__name__}", flush=True)
            continue
        # Empty or malformed scientific data is not a network incident. The
        # existing column/coordinate/completeness validation must still fail.
        if not tables:
            raise RuntimeError("VizieR returned no Hipparcos catalog")
        print(f"Hipparcos catalogue fetched from {server}", flush=True)
        return tables[0]
    raise RuntimeError(f"No VizieR mirror reachable for {CATALOGUE}") from last_error

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
    from astropy.table import Table
    from astroquery.vizier import Vizier
    from requests.exceptions import RequestException

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stellarium_json", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("--cache", type=Path, default=Path(".cache/hipparcos2.ecsv"))
    args = parser.parse_args()
    index = json.loads(args.stellarium_json.read_text())
    needed = referenced_hip_ids(index)
    if not args.cache.exists():
        print(f"Fetching {CATALOGUE} from VizieR; this may take some time.")
        table = fetch_hipparcos_table(Vizier, (RequestException,))
        args.cache.parent.mkdir(parents=True, exist_ok=True)
        table.write(args.cache, format="ascii.ecsv", overwrite=True)
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
        if math.isfinite(ra) and math.isfinite(dec) and 0 <= ra < 360 and -90 <= dec <= 90:
            coords[str(hip)] = {"raDeg": ra, "decDeg": dec}
        else:
            raise ValueError(f"Invalid Hipparcos degree coordinates for HIP {hip}: RA={ra} Dec={dec}")
    missing = sorted(needed - set(map(int, coords)))
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(coords, indent=2, sort_keys=True) + "\n")
    print(f"Line HIP coordinates: {len(coords)}/{len(needed)}; missing: {missing[:20]}")
    if missing:
        raise SystemExit(2)

if __name__ == "__main__":
    main()
