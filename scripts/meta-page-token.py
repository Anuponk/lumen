#!/usr/bin/env python3
"""#1056 · One-off helper, run by the owner in the o2switch cPanel Terminal.

  python3 ~/lumen-staging/scripts/meta-page-token.py          create the private configuration
  python3 ~/lumen-staging/scripts/meta-page-token.py --check  verify it without publishing

It exchanges a short-lived user token (Graph API Explorer) for a long-lived one,
then reads the Page token (which does not expire while access is kept) and
writes ~/lumen-private/social-post.env (mode 600) with LUMEN_SOCIAL_MODE=dry-run.
Secrets are typed hidden, never printed, never sent anywhere but graph.facebook.com.
"""
from __future__ import annotations

import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

GRAPH = "https://graph.facebook.com/" + os.environ.get("META_GRAPH_VERSION", "v27.0")
ENV_FILE = Path(os.path.expanduser("~/lumen-private/social-post.env"))
NEEDED = {"pages_manage_posts", "pages_read_engagement", "pages_show_list"}


def graph(path: str, params: dict, opener=urllib.request.urlopen) -> dict:
    url = GRAPH + path + "?" + urllib.parse.urlencode(params)
    try:
        with opener(url, timeout=20) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read().decode() or "{}").get("error", {})
        except Exception:
            detail = {}
        raise SystemExit(f"Meta a refusé la requête : {detail.get('message', 'HTTP ' + str(error.code))}") from None


def read_env(path: Path = ENV_FILE) -> dict:
    values = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    return values


def write_env(values: dict, path: Path = ENV_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    tmp = path.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write("# Lumen #1056 — never commit or paste this file.\n")
        for key in ("LUMEN_SOCIAL_MODE", "META_PAGE_ID", "META_PAGE_TOKEN", "META_GRAPH_VERSION"):
            if values.get(key):
                handle.write(f"{key}={values[key]}\n")
    os.replace(tmp, path)
    os.chmod(path, 0o600)


def check(values: dict, opener=urllib.request.urlopen) -> str:
    page_id, token = values.get("META_PAGE_ID", ""), values.get("META_PAGE_TOKEN", "")
    if not page_id.isdigit() or not token:
        raise SystemExit("Configuration incomplète : relancer sans --check.")
    page = graph("/" + page_id, {"fields": "id,name", "access_token": token}, opener)
    graph("/" + page_id + "/feed", {"limit": 1, "fields": "id", "access_token": token}, opener)
    return page.get("name", "?")


def setup(ask=input, secret=getpass.getpass, opener=urllib.request.urlopen, out=print) -> dict:
    app_id = ask("Identifiant de l'app Meta (App ID) : ").strip()
    app_secret = secret("Clé secrète de l'app (App Secret, masquée) : ").strip()
    short = secret("Jeton utilisateur du Graph API Explorer (masqué) : ").strip()
    if not app_id.isdigit() or not app_secret or not short:
        raise SystemExit("Valeurs manquantes.")
    long_user = graph("/oauth/access_token", {"grant_type": "fb_exchange_token", "client_id": app_id,
                                              "client_secret": app_secret, "fb_exchange_token": short}, opener)["access_token"]
    granted = {p["permission"] for p in graph("/me/permissions", {"access_token": long_user}, opener).get("data", [])
               if p.get("status") == "granted"}
    missing = NEEDED - granted
    if missing:
        raise SystemExit("Permissions manquantes : " + ", ".join(sorted(missing)))
    pages = graph("/me/accounts", {"fields": "id,name,access_token,tasks", "access_token": long_user}, opener).get("data", [])
    pages = [p for p in pages if p.get("access_token") and ("tasks" not in p or "CREATE_CONTENT" in p["tasks"])]
    if not pages:
        raise SystemExit("Aucune Page sur laquelle ce compte peut publier.")
    for index, page in enumerate(pages, 1):
        out(f"  {index}. {page['name']} ({page['id']})")
    choice = int(ask("Numéro de la Page LUMEN : ").strip() or "0")
    if not 1 <= choice <= len(pages):
        raise SystemExit("Choix invalide.")
    page = pages[choice - 1]
    values = {**read_env(), "META_PAGE_ID": page["id"], "META_PAGE_TOKEN": page["access_token"]}
    values.setdefault("LUMEN_SOCIAL_MODE", "dry-run")
    return values


if __name__ == "__main__":
    if sys.argv[1:] == ["--check"]:
        print("Accès vérifié à la Page « " + check(read_env()) + " ». Aucun post n'a été publié.")
    elif not sys.argv[1:]:
        values = setup()
        write_env(values)
        print("Configuration écrite dans " + str(ENV_FILE) + " (mode " + values["LUMEN_SOCIAL_MODE"] + ").")
        print("Accès vérifié à la Page « " + check(values) + " ». Aucun post n'a été publié.")
    else:
        raise SystemExit("Usage : meta-page-token.py [--check]")
