"""The probe and notice pipeline are exercised with synthetic responses only."""
import json
import unittest
from lumen_activity_mail import format_notice
from lumen_critical_monitor import KINDS, probe, tick

SHA = "abcdef0" + "1" * 33
VERSION = "1.11.1+741"
BUILD = json.dumps({"sha": SHA, "version": VERSION})


def shell(version=VERSION):
    return (f'<meta name="lumen-build" content="{version} · {SHA[:7]}">'
            '<div id="board"></div><script type="module" src="./src/main.js"></script>')


class CriticalMonitorTest(unittest.TestCase):
    def test_healthy_and_false_http_200(self):
        self.assertEqual(probe(lambda path, *_: shell() if path == "/" else BUILD), "healthy")
        self.assertEqual(probe(lambda path, *_: "<h1>Maintenance</h1>" if path == "/" else BUILD),
                         "invalid_shell")

    def test_publication_overlap_is_rechecked_once(self):
        views = iter([shell("1.11.1+740"), shell()])
        self.assertEqual(probe(lambda path, *_: next(views) if path == "/" else BUILD), "healthy")

    def test_both_dependencies_cannot_be_replaced_by_status_code(self):
        self.assertEqual(probe(lambda *_: '{"sha":null,"version":"unknown"}'), "invalid_build")
        self.assertEqual(probe(lambda *_: "<html>Unavailable</html>"), "unavailable")

    def test_incident_message_excludes_internal_data(self):
        subject, copy = format_notice("incident_open", {
            "signature": "hydration", "severity": "P1", "affected": 1,
            "event_at": "2026-11-21T12:00:00Z", "user_id": "PRIVATE",
        })
        self.assertIn("P1", subject)
        self.assertIn("Joueurs affectés : 1", copy)
        self.assertIn("/admin/analytics?section=sync", copy)
        self.assertNotIn("PRIVATE", copy)

    def test_digest_is_enqueued_after_local_time_and_routes_separately(self):
        from datetime import datetime, timezone
        from lumen_critical_monitor import digest_settings

        settings = digest_settings({
            "LUMEN_DAILY_SUMMARY_ENABLED": "1",
            "LUMEN_DAILY_SUMMARY_ZONE": "Europe/Paris",
            "LUMEN_DAILY_SUMMARY_TIME": "08:15",
            "LUMEN_DAILY_SUMMARY_RECIPIENT": "digest@example.test",
        })
        calls, sent = [], []
        event = {"id": "date", "lease": "lease", "kind": "daily_summary",
                 "payload": {"date": "2026-10-25", "zone": "Europe/Paris",
                             "signup_count": 1, "purchase_count": 2,
                             "currencies": [{"currency": "EUR", "amount": "10.00", "count": 1},
                                            {"currency": "JPY", "amount": "125.5", "count": 1}],
                             "critical_count": 0, "affected_floor": 0, "active": [],
                             "availability": {"state": "healthy"}, "performance": [],
                             "user_id": "PRIVATE"}}

        def rpc(name, payload):
            calls.append((name, payload))
            if name == "lumen_claim_activity_mail":
                return [event] if any(key == "lumen_enqueue_health_digest" for key, _ in calls) else []
            return True

        def send(payload):
            sent.append(payload)
            return 201, {"messageId": "fixture"}

        config = {"sample": 42, "stall_minutes": 15, "failures": 3, "recoveries": 2, "backlog": 20,
                  "since": "2026-10-01T00:00:00Z", "kinds": KINDS, "daily": 120, "batch": 5,
                  "sender": "app@example.test", "recipient": "admin@example.test", "digest": settings}
        self.assertEqual(tick(rpc, send, config, "healthy", datetime(2026, 10, 26, 7, 14, tzinfo=timezone.utc)), {})
        self.assertFalse(sent)
        outcome = tick(rpc, send, config, "healthy", datetime(2026, 10, 26, 7, 19, tzinfo=timezone.utc))
        self.assertEqual(outcome, {"accepted": 1})
        self.assertIn(("lumen_enqueue_health_digest", {"p_date": "2026-10-25", "p_zone": "Europe/Paris"}), calls)
        self.assertEqual(sent[0]["to"], [{"email": "digest@example.test"}])
        self.assertIn("125.5 JPY", sent[0]["textContent"])
        self.assertNotIn("PRIVATE", sent[0]["textContent"])

    def test_tick_reuses_queue_and_holds_ambiguous_transport_outcome(self):
        calls = []
        event = {"id": "event", "lease": "fixture-lease", "kind": "incident_resolved",
                 "payload": {"signature": "availability", "severity": "P0", "affected": 0,
                             "event_at": "2026-11-21T12:00:00Z"}}

        def rpc(name, payload):
            calls.append((name, payload))
            return [event] if name == "lumen_claim_activity_mail" else True

        config = {"sample": 42, "stall_minutes": 15, "failures": 3, "recoveries": 2, "backlog": 20,
                  "since": "2026-11-21T12:00:00Z", "kinds": KINDS, "daily": 120, "batch": 5,
                  "sender": "app@example.test", "recipient": "admin@example.test"}
        self.assertEqual(tick(rpc, lambda _: (503, None), config, "unavailable"), {"unknown": 1})
        self.assertEqual(calls[0][1]["p_sample"], 42)
        self.assertIs(calls[0][1]["p_probe_ok"], False)
        self.assertEqual(calls[-1][1], {"p_id": "event", "p_lease": "fixture-lease", "p_result": "unknown"})


if __name__ == "__main__":
    unittest.main()
