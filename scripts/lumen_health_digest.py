from datetime import date
from decimal import Decimal, InvalidOperation
import re


METRICS = {"load": "Chargement", "grid_render": "Construction de la grille",
           "grid_input": "Interaction", "long_task": "Traitement bloquant",
           "victory_gap": "Fluidité de la victoire", "cloud_rpc": "Appel cloud",
           "sync_rpc": "Appel de sauvegarde", "hydration_error_rate": "Échecs de restauration"}
INCIDENTS = {"availability": "Disponibilité", "hydration": "Restauration du compte",
             "outbox": "Sauvegarde cloud", "backlog": "File de sauvegardes",
             "purchase": "Achat sans accès"}
AVAILABILITY = {"unknown": "en attente de sonde", "stale": "dernière sonde trop ancienne",
                "outage": "incident ouvert", "unstable": "échecs récents", "healthy": "disponible"}


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
