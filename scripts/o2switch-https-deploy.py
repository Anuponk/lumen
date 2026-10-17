#!/usr/bin/env python3
"""Authenticated HTTPS deployment, with completion + exact public SHA checks."""
import hashlib
import hmac
import http.client
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

HOOK = 'https://lumen.nopuna.fr/lumen-release/'
PUBLIC = 'https://lumen.nopuna.fr/build-info.json'
NETWORK_ERRORS = (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward authentication to another URL/host.


def fetch_json(req):
    try:
        with urllib.request.build_opener(NoRedirect).open(req, timeout=20) as response:
            return json.load(response)
    except urllib.error.HTTPError:
        raise
    except NETWORK_ERRORS:
        # Resend the identical signed request. Server replay receipts prevent a
        # duplicate job if Python lost the response after acceptance. curl uses
        # a different TLS/HTTP stack and never follows redirects here.
        print('Python HTTP connection interrupted; trying curl transport')
        config = ['url = ' + json.dumps(req.full_url)]
        for name, value in req.header_items():
            config.append('header = ' + json.dumps(name + ': ' + value))
        if req.data is not None:
            config.append('data-binary = ' + json.dumps(req.data.decode()))
        result = subprocess.run(['curl', '--disable', '--config', '-', '--silent', '--show-error',
                                 '--connect-timeout', '5', '--max-time', '20', '--write-out', '\n%{http_code}'],
                                input='\n'.join(config) + '\n', text=True, capture_output=True, timeout=25)
        if result.returncode:
            raise ConnectionError('curl connection failed')
        body, _, status = result.stdout.rpartition('\n')
        if not status.isdigit() or not 200 <= int(status) < 300:
            raise urllib.error.HTTPError(req.full_url, int(status) if status.isdigit() else 502,
                                         'HTTPS request rejected', {}, None)
        return json.loads(body)


def request(action, sha, secret):
    body = json.dumps({'action': action, 'sha': sha}, separators=(',', ':')).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), timestamp.encode() + b'\n' + body, hashlib.sha256).hexdigest()
    req = urllib.request.Request(HOOK, data=body, headers={
        'Content-Type': 'application/json', 'X-Lumen-Timestamp': timestamp,
        'X-Lumen-Signature': 'sha256=' + signature, 'User-Agent': 'lumen-release'})
    result = fetch_json(req)
    if result.get('sha') != sha:
        raise RuntimeError('Receiver SHA mismatch')
    return result


def deploy(sha, secret):
    if not re.fullmatch('[0-9a-f]{40}', sha) or not re.fullmatch('[0-9a-f]{64}', secret):
        raise RuntimeError('Missing/invalid DEPLOY_SHA or O2SWITCH_DEPLOY_WEBHOOK_SECRET')
    # One request only: after an ambiguous network error, poll rather than relaunch.
    try:
        request('deploy', sha, secret)
    except urllib.error.HTTPError as exc:
        raise RuntimeError('HTTPS trigger rejected request (HTTP ' + str(exc.code) + ')') from None
    except NETWORK_ERRORS:
        print('Trigger response unavailable; checking job status')
    for _ in range(108):
        try:
            state = request('status', sha, secret).get('state')
        except urllib.error.HTTPError as exc:
            raise RuntimeError('HTTPS status rejected request (HTTP ' + str(exc.code) + ')') from None
        except NETWORK_ERRORS:
            time.sleep(5)
            continue
        if state == 'failed':
            raise RuntimeError('Server publication failed; inspect private deploy-jobs log')
        if state == 'success':
            if fetch_json(urllib.request.Request(PUBLIC + '?release=' + sha)).get('sha') != sha:
                raise RuntimeError('Published SHA mismatch')
            print('Published and verified ' + sha)
            return
        time.sleep(5)
    raise RuntimeError('Publication completion not confirmed; inspect private deploy-jobs log')


if __name__ == '__main__':
    try:
        deploy(os.environ.get('DEPLOY_SHA', ''), os.environ.get('O2SWITCH_DEPLOY_WEBHOOK_SECRET', ''))
    except Exception as exc:
        # Never log headers, secret, signed requests, or server response bodies.
        print('Deployment failed: ' + (str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__), file=sys.stderr)
        sys.exit(1)
