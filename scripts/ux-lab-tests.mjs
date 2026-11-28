import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUxLab } from '../src/ui/ux-lab.js';

function fixture() {
  let owner = 'owner';
  let active = false;
  let deferred = () => Promise.resolve({ data: true });
  const saved = new Map();
  const client = {
    rpc(name) {
      assert.equal(name, 'lumen_ux_v2_access');
      return deferred();
    },
  };
  const lab = createUxLab({
    getContext: () => (owner ? { owner, client } : null),
    storage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    busy: () => active,
  });
  return {
    lab,
    saved,
    account(value) {
      owner = value;
      lab.syncScope();
    },
    active(value) {
      active = value;
    },
    reply(fn) {
      deferred = fn;
    },
  };
}

test('the default is V1 and a preference needs a fresh successful server grant', async () => {
  const { lab, reply } = fixture();
  assert.equal(lab.preference(), 'v1');
  assert.equal(await lab.select('v2'), false);
  assert.equal(await lab.refresh(), true);
  assert.equal(await lab.select('v2'), true);
  assert.equal(lab.preference(), 'v2');
  reply(async () => ({ data: false }));
  assert.equal(await lab.refresh(), false);
  assert.equal(lab.preference(), 'v1');
  assert.equal(lab.ready(), false);
});

test('an owner response cannot enable a different session, even after returning to the owner', async () => {
  const f = fixture();
  let finish;
  f.reply(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = f.lab.refresh();
  f.account(null);
  f.account('other');
  f.account('owner');
  finish({ data: true });
  assert.equal(await pending, false);
  assert.equal(f.lab.ready(), false);
  assert.equal(f.lab.preference(), 'v1');
});

test('a running or paused attempt blocks changes, including starts while access check is pending', async () => {
  const f = fixture();
  await f.lab.refresh();
  f.active(true);
  assert.equal(await f.lab.select('v2'), false);
  assert.equal(f.saved.size, 0);
  f.active(false);
  let finish;
  f.reply(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = f.lab.select('v2');
  f.active(true);
  finish({ data: true });
  assert.equal(await pending, false);
  assert.equal(f.saved.size, 0);
});

test('account choices stay scoped, guests stay in V1 and network errors remove access', async () => {
  const f = fixture();
  await f.lab.refresh();
  await f.lab.select('v2');
  f.account(null);
  assert.equal(await f.lab.refresh(), false);
  f.account('other');
  await f.lab.refresh();
  assert.equal(f.lab.preference(), 'v1');
  f.account('owner');
  await f.lab.refresh();
  assert.equal(f.lab.preference(), 'v2');
  f.reply(async () => {
    throw Error('network');
  });
  assert.equal(await f.lab.refresh(), false);
  assert.equal(f.lab.preference(), 'v1');
});

test('malformed or error responses cannot grant access', async () => {
  const f = fixture();
  for (const response of [{ data: 'true' }, { data: true, error: { code: 'denied' } }, null]) {
    f.reply(async () => response);
    assert.equal(await f.lab.refresh(), false);
    assert.equal(f.lab.ready(), false);
  }
});
