"""Exercise the Play transaction with a fake service and no Google credentials."""

import hashlib
from pathlib import Path
import runpy
import unittest


release = runpy.run_path(str(Path(__file__).with_name("play-closed-release.py")))
app = release["APP"]
edit = f"{app}/edits/test-edit"
track = "alpha"
target = f"{edit}/tracks/{track}"
bundle = b"synthetic signed bundle"
error = release["ReleaseError"]


class FakePlay:
    def __init__(self):
        self.calls = []
        self.release_status = "completed"
        self.bundle_code = 2
        self.upload_digest = hashlib.sha256(bundle).hexdigest()
        self.fail_validation = False

    def __call__(self, method, path, body=None):
        self.calls.append((method, path, body))
        responses = {
            ("POST", f"{app}/edits"): {"id": "test-edit"},
            ("DELETE", edit): {},
            ("GET", target): {"track": track, "releases": [{"status": self.release_status}]},
            ("GET", f"{edit}/bundles"): {"bundles": [{"versionCode": self.bundle_code}]},
            ("GET", f"{edit}/apks"): {"apks": [{"versionCode": 5}]},
            ("GET", f"{edit}/tracks"): {"tracks": [{"track": "production", "releases": [
                {"status": "completed", "versionCodes": ["6"]},
            ]}]},
            ("POST", f"/upload{edit}/bundles?uploadType=media"): {"versionCode": 7, "sha256": self.upload_digest},
            ("PUT", target): {},
            ("POST", f"{edit}:validate"): {},
            ("POST", f"{edit}:commit"): {},
        }
        if self.fail_validation and path.endswith(":validate"):
            raise error("Validation rejected")
        return responses[method, path]


class ClosedReleaseTests(unittest.TestCase):
    def setUp(self):
        self.api = FakePlay()

    def test_reserves_above_all_visible_codes_without_committing(self):
        self.assertEqual(release["next_code"](self.api, track, 2), 7)
        self.assertEqual(self.api.calls[-1][:2], ("DELETE", edit))

    def test_sets_only_the_closed_track_and_commits_after_validate(self):
        release["publish"](self.api, track, 2, 7, "1.0.2", bundle)
        self.assertEqual(self.api.calls[-4:], [
            ("POST", f"/upload{edit}/bundles?uploadType=media", bundle),
            ("PUT", target, {"track": track, "releases": [
                {"name": "1.0.2", "versionCodes": ["7"], "status": "completed"},
            ]}),
            ("POST", f"{edit}:validate", None),
            ("POST", f"{edit}:commit", None),
        ])

    def test_refuses_other_standard_tracks_and_path_syntax(self):
        for forbidden in ("production", "Beta", "qa", "internal", "wear:alpha", "alpha/../production", ""):
            with self.subTest(track=forbidden), self.assertRaises(error):
                release["closed_track"](forbidden)
        self.assertEqual(release["closed_track"]("lumen-closed_2"), "lumen-closed_2")

    def test_does_not_upload_over_an_existing_code_or_unfinished_release(self):
        with self.assertRaises(error):
            release["publish"](self.api, track, 2, 6, "1.0.2", bundle)
        self.api.release_status = "draft"
        with self.assertRaises(error):
            release["publish"](self.api, track, 2, 7, "1.0.2", bundle)
        self.assertFalse(any(path.startswith("/upload") for _, path, _ in self.api.calls))

    def test_wrong_upload_digest_and_failed_validation_discard_the_edit(self):
        self.api.upload_digest = "wrong"
        with self.assertRaises(error):
            release["publish"](self.api, track, 2, 7, "1.0.2", bundle)
        self.assertEqual(self.api.calls[-1][:2], ("DELETE", edit))
        self.assertFalse(any(method == "PUT" for method, _, _ in self.api.calls))
        self.api.upload_digest = hashlib.sha256(bundle).hexdigest()
        self.api.fail_validation = True
        with self.assertRaises(error):
            release["publish"](self.api, track, 2, 7, "1.0.2", bundle)
        self.assertEqual(self.api.calls[-1][:2], ("DELETE", edit))
        self.assertFalse(any(path.endswith(":commit") for _, path, _ in self.api.calls))


if __name__ == "__main__":
    unittest.main()
