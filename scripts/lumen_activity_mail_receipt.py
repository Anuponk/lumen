"""Verify the queue in disposable PostgreSQL or send synthetic previews from o2switch."""
import argparse
import json
import os
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, build_opener
from uuid import UUID

from lumen_activity_mail import NoRedirect, brevo_outcome, clients, configuration, drain, format_notice, secret

KINDS = ("signup", "purchase", "incident_open", "daily_summary")
SETUP = (
    "scripts/fixtures/admin-activity-mail-bootstrap.sql",
    "supabase/migrations/20261122200000_admin_activity_mail_950.sql",
    "scripts/fixtures/critical-incidents-bootstrap.sql",
    "supabase/migrations/20261122210000_critical_incidents_947.sql",
    "scripts/fixtures/performance-monitor-bootstrap.sql",
    "supabase/migrations/20261122220000_performance_monitor_948.sql",
    "supabase/migrations/20261122230000_health_cockpit_949.sql",
    "scripts/fixtures/activity-mail-receipt.sql",
)


def sql(statement):
    container = os.environ["PG_CONTAINER"]
    if not re.fullmatch(r"[a-f0-9]{64}", container):
        raise ValueError("expected the disposable PostgreSQL container ID")
    return subprocess.run(
        ["docker", "exec", "-i", "--user", "postgres", container,
         "psql", "-XqAt", "-v", "ON_ERROR_STOP=1"],
        input=statement, text=True, encoding="utf-8", stdout=subprocess.PIPE,
        check=True,
    ).stdout.strip()


def verify_supabase(config, key):
    request = Request(config["origin"] + "/rest/v1/", headers={
        "apikey": key, "Authorization": "Bearer " + key,
        "Accept": "application/openapi+json",
    })
    try:
        with build_opener(NoRedirect()).open(request, timeout=10) as response:
            paths = json.load(response)["paths"]
    except (OSError, ValueError, KeyError):
        raise RuntimeError("cannot verify the SoldeZen API schema") from None
    for name in (
        "lumen_claim_activity_mail", "lumen_finish_activity_mail",
        "lumen_observe_critical_incidents", "lumen_observe_performance",
        "lumen_enqueue_health_digest",
    ):
        if f"/rpc/{name}" not in paths:
            raise RuntimeError(f"SoldeZen API schema is missing {name}")
    print("SoldeZen API schema verified")


def host_receipt():
    reference = datetime.now(timezone.utc)
    timestamp = reference.isoformat(timespec="seconds")
    yesterday = (reference - timedelta(days=1)).date().isoformat()
    config = configuration({**os.environ, "LUMEN_ACTIVITY_KINDS": ",".join(KINDS)})
    verify_supabase(config, secret(os.environ, "LUMEN_ACTIVITY_SUPABASE_KEY"))
    _, send = clients(os.environ, brevo_diagnostics=True)
    fixtures = {
        "signup": {"method": "email", "email_confirmed": True, "created_at": timestamp},
        "purchase": {"provider": "stripe", "product": "fixture-adventure", "amount": "1.00",
                     "currency": "EUR", "access": "verified", "event_at": timestamp},
        "incident_open": {"signature": "availability", "severity": "P0", "affected": 0,
                          "event_at": timestamp},
        "daily_summary": {"date": yesterday, "zone": "Europe/Paris", "signup_count": 1,
                          "purchase_count": 1, "currencies": [{"currency": "EUR", "amount": "1.00", "count": 1}],
                          "availability": {"state": "outage"}, "critical_count": 1, "affected_floor": 0,
                          "active": [{"signature": "availability", "severity": "P0"}], "performance": []},
    }
    for kind, fixture in fixtures.items():
        subject, copy = format_notice(kind, fixture)
        recipient = config["digest_recipient"] if kind == "daily_summary" else config["recipient"]
        status, response = send({
            "sender": {"email": config["sender"], "name": "Lumen"},
            "to": [{"email": recipient}],
            "subject": "[RECETTE] " + subject,
            "textContent": "Test synthetique, sans activite ni incident reel.\n\n" + copy,
            "tags": ["lumen-recette", kind.replace("_", "-")],
        })
        if brevo_outcome(status, response) != "accepted":
            label = (response or {}).get("error", "unknown") if status >= 400 else "unknown"
            raise RuntimeError(f"Brevo rejected {kind}: HTTP {status}, category {label}")
        print(f"Brevo accepted {kind}", flush=True)


def simulate_queue():
    since = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat(timespec="seconds")
    config = {"since": since, "kinds": list(KINDS), "batch": 4, "daily": 8,
              "sender": "sender@example.invalid", "recipient": "test@example.invalid"}
    sql("\n".join(Path(path).read_text(encoding="utf-8") for path in SETUP))
    kinds = ", ".join(f"'{kind}'" for kind in KINDS)

    def claim(_payload):
        return json.loads(sql(
            "set role service_role; select coalesce(json_agg(c), '[]') "
            f"from public.lumen_claim_activity_mail('{since}', array[{kinds}], 4, 8) c;"
        ))

    def finish(payload):
        event, lease = UUID(payload["p_id"]), UUID(payload["p_lease"])
        result = payload["p_result"]
        if result not in {"accepted", "rejected", "retry", "unknown"}:
            raise ValueError("unexpected transport outcome")
        return sql(
            "set role service_role; "
            f"select public.lumen_finish_activity_mail('{event}', '{lease}', '{result}');"
        ) == "t"

    submitted = []

    def send(payload):
        submitted.append(payload["tags"][1].replace("-", "_"))
        return 201, {"messageId": "simulated"}

    first = drain(claim, finish, send, config)
    if first != {"accepted": 4} or sorted(submitted) != sorted(KINDS):
        raise RuntimeError(f"expected one acceptance per scenario, got {first}")
    print("Four scenarios accepted: inscription, achat, incident, bilan")

    sql("""
        insert into lumen_commands.purchase_events values (2,1,'paid',now());
        set role service_role;
        select public.lumen_observe_critical_incidents(3,false);
        select public.lumen_enqueue_health_digest(
            (now() at time zone 'Europe/Paris')::date-1,'Europe/Paris');
    """)
    if drain(claim, finish, send, config) or len(submitted) != 4:
        raise RuntimeError("replay submitted an additional message")
    print("Replay submitted no additional messages")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="send four synthetic previews from o2switch")
    if parser.parse_args().live:
        host_receipt()
    else:
        simulate_queue()
