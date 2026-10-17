#!/usr/bin/env python3
"""Exercise the real PHP HTTP receiver in a disposable private directory."""
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parent
PHP = os.environ.get('LUMEN_PHP') or shutil.which('php')
SHA = 'a' * 40
SECRET = 'b' * 64


@unittest.skipUnless(PHP, 'PHP required')
class ReceiverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.private = self.root / 'lumen-private'
        self.private.mkdir()
        self.jobs = self.private / 'deploy-jobs'
        self.jobs.mkdir()
        shutil.copyfile(SCRIPTS / 'o2switch-deploy-hook.php', self.private / 'hook.php')
        (self.private / 'deploy-webhook-secret').write_text(SECRET)
        public = self.root / 'public'
        public.mkdir()
        (public / 'index.php').write_text("<?php require " + json.dumps(str(self.private / 'hook.php').replace('\\', '/')) + ';')
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        self.url = f'http://127.0.0.1:{port}/index.php'
        self.server = subprocess.Popen([PHP, '-S', f'127.0.0.1:{port}', '-t', str(public)],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.addCleanup(self.stop_server)
        for _ in range(100):
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=.1):
                    break
            except OSError:
                if self.server.poll() is not None:
                    self.fail('PHP server failed to start')
                time.sleep(.03)

    def stop_server(self):
        self.server.terminate()
        self.server.wait(timeout=5)

    def call(self, action='status', sha=SHA, timestamp=None, secret=SECRET, raw=None, method='POST'):
        body = raw if raw is not None else json.dumps({'sha': sha, 'action': action}).encode()
        timestamp = str(int(time.time()) if timestamp is None else timestamp)
        sig = hmac.new(secret.encode(), timestamp.encode() + b'\n' + body, hashlib.sha256).hexdigest()
        req = urllib.request.Request(self.url, data=body if method == 'POST' else None, method=method,
                                     headers={'X-Lumen-Timestamp': timestamp, 'X-Lumen-Signature': 'sha256=' + sig})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as exc:
            return exc.code, json.load(exc)

    def test_authentication_and_expiry_never_start_job(self):
        # Leave margin for crossing a wall-clock second during HTTP execution.
        for params in [dict(secret='c'*64), dict(timestamp=int(time.time())-600),
                       dict(timestamp=int(time.time())+600), dict(method='GET')]:
            with self.subTest(params=params):
                self.assertIn(self.call(action='deploy', **params)[0], [401, 405])
        self.assertEqual(list(self.jobs.iterdir()), [])

    def test_payload_validation_and_missing_secret(self):
        for params in [dict(sha=SHA+';touch /tmp/pwned'), dict(action='shell'),
                       dict(raw=b'not json'), dict(raw=b'x'*1025), dict(sha=[SHA])]:
            self.assertIn(self.call(**params)[0], [400, 413])
        (self.private / 'deploy-webhook-secret').unlink()
        self.assertEqual(self.call()[0], 503)
        self.assertEqual(list(self.jobs.iterdir()), [])

    def test_status_is_authenticated_and_does_not_launch(self):
        self.assertEqual(self.call(), (200, {'sha': SHA, 'state': 'unknown'}))
        state = {'sha': SHA, 'state': 'failed', 'exit_code': 75}
        (self.jobs / (SHA+'.json')).write_text(json.dumps(state))
        self.assertEqual(self.call(), (200, state))

    @unittest.skipUnless(shutil.which('curl'), 'curl required')
    def test_real_curl_fallback_sends_valid_signature(self):
        with patch.object(client, 'HOOK', self.url), \
             patch.object(client.urllib.request, 'build_opener') as opener:
            opener.return_value.open.side_effect = client.http.client.RemoteDisconnected()
            self.assertEqual(client.request('status', SHA, SECRET), {'sha': SHA, 'state': 'unknown'})
        self.assertEqual(list(self.jobs.iterdir()), [])

    @unittest.skipIf(os.name == 'nt', 'Linux background worker')
    def test_real_background_worker_success_failure_and_replay(self):
        shutil.copyfile(SCRIPTS / 'o2switch-webhook-worker.sh', self.private / 'lumen-webhook-worker.sh')
        source = self.root / 'lumen-staging' / 'scripts'
        source.mkdir(parents=True)
        publisher = source / 'o2switch-cron-publish.sh'
        # Observe only the exact SHA, HOME and fixed --deploy contract.
        publisher.write_text('#!/bin/bash\n[[ "$1" == --deploy ]] || exit 9\nprintf "%s\\n" "$2" >> "$HOME/calls"\nexit 0\n')
        timestamp = int(time.time())
        self.assertEqual(self.call('deploy', timestamp=timestamp)[0], 202)
        for _ in range(100):
            state = self.call()[1]
            if state['state'] != 'pending':
                break
            time.sleep(.03)
        self.assertEqual(state, {'sha': SHA, 'state': 'success', 'exit_code': 0})
        self.assertEqual(self.call('deploy', timestamp=timestamp)[0], 202)
        time.sleep(.05)
        self.assertEqual((self.root / 'calls').read_text().splitlines(), [SHA])
        publisher.write_text('exit 75\n')
        other = 'd'*40
        self.assertEqual(self.call('deploy', sha=other)[0], 202)
        for _ in range(100):
            state = self.call(sha=other)[1]
            if state['state'] != 'pending':
                break
            time.sleep(.03)
        self.assertEqual(state, {'sha': other, 'state': 'failed', 'exit_code': 75})


spec = importlib.util.spec_from_file_location('https_client', SCRIPTS / 'o2switch-https-deploy.py')
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class ClientTests(unittest.TestCase):
    def test_curl_rejects_redirect_and_keeps_signed_headers_out_of_arguments(self):
        with patch.object(client.urllib.request, 'build_opener') as opener, \
             patch.object(client.subprocess, 'run') as curl:
            opener.return_value.open.side_effect = client.http.client.RemoteDisconnected()
            curl.return_value = subprocess.CompletedProcess([], 0, '{}\n302', '')
            with self.assertRaises(urllib.error.HTTPError):
                client.request('deploy', SHA, SECRET)
            args = curl.call_args.args[0]
            self.assertNotIn('--location', args)
            self.assertFalse(any('X-Lumen' in value or SECRET in value for value in args))
            self.assertNotIn(SECRET, curl.call_args.kwargs['input'])

    def test_interrupted_trigger_response_polls_without_relaunching(self):
        from io import BytesIO
        lost = client.http.client.RemoteDisconnected('connection interrupted')
        with patch.object(client, 'request', side_effect=[lost, lost, {'sha': SHA, 'state': 'success'}]) as request, \
             patch.object(client.time, 'sleep'), \
             patch.object(client.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = BytesIO(json.dumps({'sha': SHA}).encode())
            client.deploy(SHA, SECRET)
            self.assertEqual([call.args[0] for call in request.call_args_list], ['deploy', 'status', 'status'])

    def test_server_failure_and_invalid_secret_fail_closed(self):
        with patch.object(client, 'request', return_value={'sha': SHA, 'state': 'failed'}):
            with self.assertRaisesRegex(RuntimeError, 'Server publication failed'):
                client.deploy(SHA, SECRET)
        with self.assertRaisesRegex(RuntimeError, 'Missing/invalid'):
            client.deploy(SHA, '')

    def test_auth_failure_is_immediate_and_not_logged_as_success(self):
        error = urllib.error.HTTPError(client.HOOK, 401, 'unauthorized', {}, None)
        with patch.object(client, 'request', side_effect=error) as request:
            with self.assertRaisesRegex(RuntimeError, 'HTTP 401'):
                client.deploy(SHA, SECRET)
            self.assertEqual(request.call_count, 1)

    def test_no_redirect_for_signed_request(self):
        self.assertIsNone(client.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.example'))

    def test_public_mismatch_fails_after_successful_job(self):
        from io import BytesIO
        with patch.object(client, 'request', return_value={'sha': SHA, 'state': 'success'}), \
             patch.object(client.urllib.request, 'build_opener') as opener:
            opener.return_value.open.return_value = BytesIO(b'{"sha":"wrong"}')
            with self.assertRaisesRegex(RuntimeError, 'Published SHA mismatch'):
                client.deploy(SHA, SECRET)


if __name__ == '__main__':
    unittest.main(verbosity=2)
