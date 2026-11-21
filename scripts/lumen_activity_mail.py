"""Drain the private Lumen activity mail queue from the existing host cron."""

import json
import os
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


SUBJECTS = {
    "signup": "Nouveau compte joueur",
    "purchase": "Achat confirmé",
    "purchase_missing_access": "P0 · Achat confirmé sans accès",
    "purchase_access_restored": "P0 résolu · Accès à l’achat vérifié",
    "refund": "Achat remboursé",
    "revocation": "Achat contesté · vérifier le droit d’accès",
    "incident_open": "Incident ouvert",
    "incident_resolved": "Retour à la normale",
}
COCKPIT_URL = "https://lumen.nopuna.fr/admin/analytics"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def post(url, headers, payload):
    request = Request(url, data=json.dumps(payload).encode(), headers={
        "content-type": "application/json", **headers,
    }, method="POST")
    try:
        with build_opener(NoRedirect()).open(request, timeout=8) as response:
            return response.status, json.loads(response.read(65536))
    except HTTPError as error:
        with error:
            return error.code, None
    except (URLError, TimeoutError, ValueError, OSError):
        return 0, None


def timestamp(value):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("timezone required")
    return parsed.isoformat(timespec="seconds")


def format_notice(kind, payload):
    subject = "[Lumen] " + SUBJECTS[kind]
    if kind in ("incident_open", "incident_resolved"):
        label = {"availability": "Disponibilité du jeu", "hydration": "Restauration du compte",
                 "outbox": "Sauvegarde cloud", "backlog": "File de sauvegardes"}[payload["signature"]]
        severity = {"P0": "P0", "P1": "P1", "P2": "P2"}[payload["severity"]]
        affected = payload["affected"]
        if type(affected) is not int or affected < 0:
            raise ValueError("invalid incident count")
        lines = [f"{label} · {severity}", f"Date : {timestamp(payload['event_at'])}"]
        if payload["signature"] != "availability":
            lines.append(f"Joueurs affectés : {affected}")
        return subject + " · " + severity, "\n".join([*lines, "", COCKPIT_URL + "?section=sync"])
    if kind == "signup":
        method = {"email": "Email", "google": "Google"}[payload["method"]]
        lines = [f"Compte créé le {timestamp(payload['created_at'])}",
                 f"Méthode : {method}"]
        if method == "Email":
            if payload["email_confirmed"] is not True:
                raise ValueError("unconfirmed account")
            lines.append("Adresse email confirmée")
    else:
        provider = {"play": "Google Play", "stripe": "Stripe"}[payload["provider"]]
        access = {"verified": "Vérifié", "missing": "Manquant", "changed": "À vérifier"}[payload["access"]]
        product, currency, amount = payload["product"], payload["currency"], payload["amount"]
        if not re.fullmatch(r"[a-z0-9-]{1,80}", product) or not re.fullmatch(r"[A-Z]{3}", currency):
            raise ValueError("invalid receipt")
        if not re.fullmatch(r"\d{1,19}(?:\.\d{1,20})?", amount):
            raise ValueError("invalid amount")
        lines = [f"Produit : {product}", f"Montant d’origine : {amount} {currency}",
                 f"Canal : {provider}", f"Date : {timestamp(payload['event_at'])}",
                 f"Droit d’accès : {access}"]
    return subject, "\n".join([*lines, "", COCKPIT_URL])


def brevo_outcome(status, response):
    if status == 201 and isinstance(response, dict) and response.get("messageId"):
        return "accepted"
    if status == 429:
        return "retry"
    if 400 <= status < 500:
        return "rejected"
    return "unknown"


def drain(claim, finish, send, config):
    claimed = claim({
        "p_since": config["since"], "p_kinds": config["kinds"],
        "p_limit": config["batch"], "p_daily_limit": config["daily"],
    })
    if not isinstance(claimed, list):
        raise RuntimeError("invalid claim response")
    results = Counter()
    for event in claimed:
        try:
            subject, copy = format_notice(event["kind"], event["payload"])
        except (KeyError, ValueError, TypeError):
            result = "rejected"
        else:
            result = brevo_outcome(*send({
                "sender": {"email": config["sender"], "name": "Lumen"},
                "to": [{"email": config["recipient"]}],
                "subject": subject, "textContent": copy,
                "tags": ["lumen-activity", event["kind"].replace("_", "-")],
            }))
        if finish({"p_id": event["id"], "p_lease": event["lease"], "p_result": result}) is not True:
            raise RuntimeError("activity outcome could not be saved")
        results[result] += 1
    return dict(results)


def configuration(env):
    origin = env["LUMEN_ACTIVITY_SUPABASE_URL"].rstrip("/")
    if not re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", origin):
        raise ValueError("invalid Supabase origin")
    kinds = [value.strip() for value in env["LUMEN_ACTIVITY_KINDS"].split(",") if value.strip()]
    if not kinds or not set(kinds).issubset(SUBJECTS):
        raise ValueError("invalid activity kinds")
    sender, recipient = env["LUMEN_ACTIVITY_SENDER"], env["LUMEN_ACTIVITY_RECIPIENT"]
    if any(not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value) for value in [sender, recipient]):
        raise ValueError("invalid email configuration")
    return {
        "origin": origin, "kinds": kinds, "sender": sender, "recipient": recipient,
        "since": timestamp(env["LUMEN_ACTIVITY_START"]),
        "batch": max(1, min(int(env.get("LUMEN_ACTIVITY_BATCH", "10")), 20)),
        "daily": max(1, min(int(env.get("LUMEN_ACTIVITY_DAILY_LIMIT", "100")), 200)),
    }


def clients(config, env):
    def secret(name):
        return (env.get(name) or Path(env[name + "_FILE"]).read_text()).strip()

    role = secret("LUMEN_ACTIVITY_SUPABASE_KEY")
    brevo = secret("LUMEN_ACTIVITY_BREVO_KEY")
    if not role or not brevo:
        raise ValueError("empty credentials")

    def rpc(name, payload):
        status, value = post(config["origin"] + "/rest/v1/rpc/" + name,
                             {"apikey": role, "authorization": "Bearer " + role}, payload)
        if status != 200:
            raise RuntimeError("activity database unavailable")
        return value

    def send(payload):
        return post("https://api.brevo.com/v3/smtp/email", {"api-key": brevo}, payload)

    return rpc, send


def main(env):
    if env.get("LUMEN_ACTIVITY_ENABLED") != "1":
        return 0
    try:
        config = configuration(env)
        rpc, send = clients(config, env)
    except (KeyError, ValueError, OSError):
        print("Lumen activity mail: configuration invalid", file=sys.stderr)
        return 1

    try:
        results = drain(
            lambda payload: rpc("lumen_claim_activity_mail", payload),
            lambda payload: rpc("lumen_finish_activity_mail", payload),
            send,
            config,
        )
    except (RuntimeError, KeyError, TypeError):
        print("Lumen activity mail: processing interrupted", file=sys.stderr)
        return 1
    if results:
        print(json.dumps(results, sort_keys=True))
    return int(any(results.get(outcome) for outcome in ("rejected", "unknown")))


if __name__ == "__main__":
    sys.exit(main(os.environ))
