"""Drain the private Lumen activity mail queue from the existing host cron."""

import json
import os
import re
import sys
from collections import Counter
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


METRICS = {"load": "Chargement", "grid_render": "Construction de la grille",
           "grid_input": "Interaction", "long_task": "Traitement bloquant",
           "victory_gap": "Fluidité de la victoire", "cloud_rpc": "Appel cloud",
           "sync_rpc": "Appel de sauvegarde", "hydration_error_rate": "Échecs de restauration"}
INCIDENTS = {"availability": "Disponibilité", "hydration": "Restauration du compte",
             "outbox": "Sauvegarde cloud", "backlog": "File de sauvegardes",
             "purchase": "Achat sans accès"}
AVAILABILITY = {"unknown": "en attente de sonde", "stale": "dernière sonde trop ancienne",
                "outage": "incident ouvert", "unstable": "échecs récents", "healthy": "disponible"}


SUBJECTS = {
    "daily_summary": "Bilan de santé quotidien",
    "signup": "Nouveau compte joueur",
    "purchase": "Achat confirmé",
    "purchase_missing_access": "P0 · Achat confirmé sans accès",
    "purchase_access_restored": "P0 résolu · Accès à l’achat vérifié",
    "refund": "Achat remboursé",
    "revocation": "Achat contesté · vérifier le droit d’accès",
    "incident_open": "Incident ouvert",
    "performance_regression": "P1 · Dégradation de performance",
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


def integer(value, maximum=None):
    if type(value) is not int or value < 0 or (maximum is not None and value > maximum):
        raise ValueError("invalid count")
    return value


def format_digest(payload):
    day = date.fromisoformat(payload["date"]).isoformat()
    zone = payload["zone"]
    if not re.fullmatch(r"[A-Za-z0-9_/+.-]{1,64}", zone):
        raise ValueError("invalid timezone")
    lines = [
        f"Journée du {day} ({zone})",
        f"Nouveaux comptes réels : {integer(payload['signup_count'])}",
        f"Achats confirmés : {integer(payload['purchase_count'])}",
    ]
    for row in payload["currencies"]:
        currency = row["currency"]
        if not re.fullmatch(r"[A-Z]{3}", currency):
            raise ValueError("invalid currency")
        try:
            amount = Decimal(row["amount"])
        except InvalidOperation as error:
            raise ValueError("invalid amount") from error
        if not amount.is_finite() or not 0 <= amount < 1_000_000_000_000:
            raise ValueError("invalid amount")
        lines.append(f"  {amount:f} {currency} ({integer(row['count'])})")
    lines.extend([
        f"Alertes ouvertes sur la journée : {integer(payload['critical_count'])}",
        f"Joueurs affectés à la génération du bilan : au moins {integer(payload['affected_floor'])}",
        f"Disponibilité à la génération du bilan : {AVAILABILITY[payload['availability']['state']]}",
        "Alertes non résolues à la génération du bilan :",
    ])
    for row in payload["active"]:
        if row["severity"] not in ("P0", "P1", "P2"):
            raise ValueError("invalid severity")
        lines.append(f"  {row['severity']} · {INCIDENTS[row['signature']]}")
    if not payload["active"]:
        lines.append("  Aucune.")
    lines.append("Comparaisons de performance sur 14 jours :")
    for row in payload["performance"]:
        versions = [row["version"], row["reference"]]
        if any(not re.fullmatch(r"\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}", value) for value in versions):
            raise ValueError("invalid release")
        reading = " · régression" if row["regression"] is True else ""
        lines.append(
            f"  {METRICS[row['metric']]} · {versions[0]} / {versions[1]} · "
            f"{integer(row['p90'], 60000)} / {integer(row['reference_p90'], 60000)} ms · "
            f"{integer(row['samples'])} / {integer(row['reference_samples'])} comptes{reading}"
        )
    if not payload["performance"]:
        lines.append("  Aucune comparaison disponible.")
    rate = payload.get("error_rate")
    if rate:
        current = integer(rate["rate"], 10000) / 100
        prior = integer(rate["reference_rate"], 10000) / 100
        lines.append(f"  Échecs de restauration : {current:.2f} % contre {prior:.2f} % · régression")
    return day, lines


def format_notice(kind, payload):
    subject = "[Lumen] " + SUBJECTS[kind]
    if kind == "daily_summary":
        day, lines = format_digest(payload)
        return subject + " · " + day, "\n".join([*lines, "", COCKPIT_URL + "?section=sync"])
    if kind == "performance_regression":
        metric = METRICS[payload["metric"]]
        version, reference = payload["version"], payload["reference"]
        if any(not re.fullmatch(r"\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}", entry) for entry in [version, reference]):
            raise ValueError("invalid release")
        samples, prior_samples = payload["samples"], payload["reference_samples"]
        if any(type(value) is not int or value < 1 for value in [samples, prior_samples]):
            raise ValueError("invalid sample")
        if payload["metric"] == "hydration_error_rate":
            rate, previous = payload["rate"], payload["reference_rate"]
            if any(type(value) is not int or not 0 <= value <= 10000 for value in [rate, previous]):
                raise ValueError("invalid failure rate")
            change = f"Échecs : {rate / 100:.2f} % contre {previous / 100:.2f} %"
        else:
            p90, previous = payload["p90"], payload["reference_p90"]
            if any(type(value) is not int or not 1 <= value <= 60000 for value in [p90, previous]):
                raise ValueError("invalid duration")
            change = f"P90 : {p90} ms contre {previous} ms"
        lines = [f"Mesure : {metric}", f"Version : {version} · référence {reference}",
                 change,
                 f"Comptes échantillonnés : {samples} contre {prior_samples}"]
        return subject, "\n".join([*lines, "", COCKPIT_URL + "?section=sync"])
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
            recipient = config.get("digest_recipient", config["recipient"]) if event["kind"] == "daily_summary" else config["recipient"]
            result = brevo_outcome(*send({
                "sender": {"email": config["sender"], "name": "Lumen"},
                "to": [{"email": recipient}],
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
