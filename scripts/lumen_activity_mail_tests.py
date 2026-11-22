"""Local tests use synthetic payloads and never initialize an external transport."""
import unittest
from io import BytesIO
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from lumen_activity_mail import brevo_outcome, configuration, drain, format_notice, main, post
from lumen_activity_mail_receipt import host_receipt


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

    def test_error_diagnostics_are_opt_in_and_redacted(self):
        for raw, label in (
            (b'{"code":"unauthorized","message":"Unrecognised IP address 192.0.2.1"}', "ip_not_authorized"),
            (b'{"code":"unauthorized","message":"sensitive address@example.test"}', "unauthorized"),
            (b'{"code":"secret-provider-text","message":"secret-provider-text"}', "unknown"),
            (b'not json', "unknown"),
        ):
            for enabled in (True, False):
                with self.subTest(label=label, enabled=enabled):
                    error = HTTPError("https://example.test", 401, "Unauthorized", {}, BytesIO(raw))
                    with patch("lumen_activity_mail.build_opener") as opener:
                        opener.return_value.open.side_effect = error
                        expected = {"error": label} if enabled else None
                        self.assertEqual(post("https://example.test", {}, {}, brevo_diagnostics=enabled),
                                         (401, expected))

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

    def test_host_worker_and_receipt_route_digest_to_its_own_mailbox(self):
        env = {
            "LUMEN_ACTIVITY_ENABLED": "1", "LUMEN_ACTIVITY_KINDS": "daily_summary",
            "LUMEN_ACTIVITY_START": "2026-11-21T00:00:00Z",
            "LUMEN_ACTIVITY_SUPABASE_URL": "https://fixture.supabase.co",
            "LUMEN_ACTIVITY_SUPABASE_KEY": "fixture-key",
            "LUMEN_ACTIVITY_SENDER": "app@example.test",
            "LUMEN_ACTIVITY_RECIPIENT": "activity@example.test",
            "LUMEN_DAILY_SUMMARY_RECIPIENT": "digest@example.test",
        }
        with patch("lumen_activity_mail.clients", return_value=(None, None)), \
             patch("lumen_activity_mail.drain", return_value={}) as drain_mail:
            self.assertEqual(main(env), 0)
            self.assertEqual(drain_mail.call_args.args[-1]["digest_recipient"], "digest@example.test")
        with patch.dict("os.environ", env, clear=True), \
             patch("lumen_activity_mail_receipt.verify_supabase"), \
             patch("lumen_activity_mail_receipt.clients") as clients_for_receipt:
            send = Mock(return_value=(201, {"messageId": "x"}))
            clients_for_receipt.return_value = (None, send)
            host_receipt()
            self.assertEqual([call.args[0]["to"][0]["email"] for call in send.call_args_list],
                             ["activity@example.test"] * 3 + ["digest@example.test"])

    def test_config_rejects_non_supabase_destination(self):
        with self.assertRaises(ValueError):
            configuration({"LUMEN_ACTIVITY_SUPABASE_URL": "https://unexpected.example.test"})


if __name__ == "__main__":
    unittest.main()
