"""Local tests use synthetic payloads and never initialize an external transport."""
import unittest
from lumen_activity_mail import brevo_outcome, configuration, drain, format_notice


class ActivityMailTest(unittest.TestCase):
    def test_formats_only_server_allowlisted_fields(self):
        subject, content = format_notice("signup", {
            "created_at": "2026-11-21T12:00:00+00:00", "method": "google",
            "email": "private@example.test", "user": "secret",
        })
        self.assertIn("Nouveau compte", subject)
        self.assertIn("Google", content)
        self.assertNotIn("private", content)
        self.assertNotIn("secret", content)
        with self.assertRaises(ValueError):
            format_notice("signup", {"created_at": "2026-11-21T12:00:00+00:00",
                                     "method": "email", "email_confirmed": False})

    def test_critical_purchase_uses_exact_settlement(self):
        subject, content = format_notice("purchase_missing_access", {
            "product": "real-adventure-02", "provider": "play", "amount": "125.5",
            "currency": "JPY", "access": "missing", "event_at": "2026-11-21T12:00:00Z",
            "provider_ref": "secret",
        })
        self.assertIn("P0", subject)
        self.assertIn("125.5 JPY", content)
        self.assertIn("Droit d’accès : Manquant", content)
        self.assertNotIn("secret", content)

    def test_formats_performance_units(self):
        common = {"version": "1.11.1+743", "reference": "1.11.1+742", "samples": 20,
                  "reference_samples": 22, "url": "private"}
        _, content = format_notice("performance_regression", {
            **common, "metric": "load", "p90": 1800, "reference_p90": 900,
        })
        self.assertIn("1800 ms contre 900 ms", content)
        self.assertNotIn("private", content)
        _, content = format_notice("performance_regression", {
            **common, "metric": "hydration_error_rate", "rate": 2500, "reference_rate": 0,
        })
        self.assertIn("25.00 % contre 0.00 %", content)

    def test_reports_acceptance_retry_and_ambiguous_result(self):
        self.assertEqual(brevo_outcome(201, {"messageId": "fake"}), "accepted")
        for status, result in [(201, "unknown"), (429, "retry"), (403, "rejected"),
                               (503, "unknown"), (0, "unknown"), (302, "unknown")]:
            self.assertEqual(brevo_outcome(status, None), result)

    def test_drain_acknowledges_each_lease_and_never_retries_ambiguous_send(self):
        delivered, completions = [], []
        events = [{"id": str(i), "lease": "lease-" + str(i), "kind": "signup",
                   "payload": {"created_at": "2026-11-21T12:00:00Z", "method": "email",
                               "email_confirmed": True}} for i in range(3)]

        def send(data):
            delivered.append(data)
            return [(201, {"messageId": "fake"}), (0, None), (429, None)][len(delivered) - 1]

        def finish(result):
            completions.append(result)
            return True

        config = {"since": "2026-11-21T00:00:00Z", "kinds": ["signup"], "batch": 3,
                  "daily": 100, "recipient": "admin@example.test", "sender": "app@example.test"}
        outcomes = drain(lambda _: events, finish, send, config)
        self.assertEqual(outcomes, {"accepted": 1, "unknown": 1, "retry": 1})
        self.assertEqual([row["p_lease"] for row in completions], ["lease-0", "lease-1", "lease-2"])
        self.assertEqual(delivered[0]["to"], [{"email": "admin@example.test"}])
        self.assertEqual(len(delivered), 3)

    def test_config_rejects_non_supabase_destination(self):
        with self.assertRaises(ValueError):
            configuration({"LUMEN_ACTIVITY_SUPABASE_URL": "https://unexpected.example.test"})


if __name__ == "__main__":
    unittest.main()
