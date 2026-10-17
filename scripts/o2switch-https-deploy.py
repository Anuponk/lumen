#!/usr/bin/env python3
"""Authenticated HTTPS deployment, with completion + exact public SHA checks."""
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HOOK = 'https://lumen.nopuna.fr/lumen-deploy.php'
PUBLIC = 'https://lumen.nopuna.fr/build-info.json'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward authentication to another URL/host.


def request(action, sha, secret):
    body = json.dumps({'action': action, 'sha': sha}, separators=(',', ':')).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), timestamp.encode() + b'\n' + body, hashlib.sha256).hexdigest()
    req = urllib.request.Request(HOOK, data=body, headers={
        'Content-Type': 'application/json', 'X-Lumen-Timestamp': timestamp,
        'X-Lumen-Signature': 'sha256=' + signature, 'User-Agent': 'lumen-release'})
    with urllib.request.build_opener(NoRedirect).open(req, timeout=20) as response:
        result = json.load(response)
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
    except (urllib.error.URLError, TimeoutError):
        print('Trigger response unavailable; checking job status')
    for _ in range(108):
        try:
            state = request('status', sha, secret).get('state')
        except urllib.error.HTTPError as exc:
            raise RuntimeError('HTTPS status rejected request (HTTP ' + str(exc.code) + ')') from None
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5)
            continue
        if state == 'failed':
            raise RuntimeError('Server publication failed; inspect private deploy-jobs log')
        if state == 'success':
            with urllib.request.build_opener(NoRedirect).open(PUBLIC + '?release=' + sha, timeout=20) as response:
                if json.load(response).get('sha') != sha:
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
