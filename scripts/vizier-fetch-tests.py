"""No network or astronomy packages: verify the real fetch boundary's failure policy."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("hipparcos_fetch", Path(__file__).with_name("fetch-hipparcos-line-stars.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
PRIMARY = "vizier.cds.unistra.fr"
MIRROR = "vizier.cfa.harvard.edu"


class MirrorFetchTests(unittest.TestCase):
    def factory(self, responses):
        self.calls = []

        def create(**options):
            self.calls.append(options)
            response = responses[len(self.calls) - 1]

            class Query:
                def get_catalogs(inner, catalogue):
                    self.assertEqual(catalogue, "I/311/hip2")
                    if isinstance(response, Exception):
                        raise response
                    return response

            return Query()

        return create

    def test_network_timeout_uses_official_mirror_same_catalogue(self):
        table = object()
        actual = module.fetch_hipparcos_table(self.factory([ConnectionError("timeout"), [table]]), (ConnectionError,))
        self.assertIs(actual, table)
        self.assertEqual([call["vizier_server"] for call in self.calls], [PRIMARY, MIRROR])
        for call in self.calls:
            self.assertEqual(call["columns"], ["*"])
            self.assertEqual(call["row_limit"], -1)
            self.assertLessEqual(call["timeout"], 60)

    def test_primary_success_never_calls_another_server(self):
        table = object()
        self.assertIs(module.fetch_hipparcos_table(self.factory([[table]]), (ConnectionError,)), table)
        self.assertEqual(len(self.calls), 1)

    def test_all_network_failures_still_fail_the_audit(self):
        with self.assertRaisesRegex(RuntimeError, "No VizieR mirror reachable"):
            module.fetch_hipparcos_table(self.factory([ConnectionError("first"), ConnectionError("second")]), (ConnectionError,))
        self.assertEqual(len(self.calls), 2)

    def test_empty_or_malformed_scientific_data_cannot_trigger_fallback(self):
        with self.assertRaisesRegex(RuntimeError, "no Hipparcos"):
            module.fetch_hipparcos_table(self.factory([[]]), (ConnectionError,))
        self.assertEqual(len(self.calls), 1)
        with self.assertRaisesRegex(ValueError, "invalid coordinates"):
            module.fetch_hipparcos_table(self.factory([ValueError("invalid coordinates")]), (ConnectionError,))
        self.assertEqual(len(self.calls), 1)


if __name__ == "__main__":
    unittest.main()
