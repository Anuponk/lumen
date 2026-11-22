// #962: the one-tap « Transmettre mon diagnostic » flow over the existing assistance session.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSupportQuickSend } from '../src/ui/support-quick-send.js';
import { createTranslator } from '../src/ui/i18n.js';

function harness({ activates = true, final = 'confirmed', active = false } = {}) {
  const calls = [];
  let clock = 0;
  let view = {
    state: active ? 'ready' : 'disabled',
    dossier: active
      ? { id: 'case-1', state: 'active', expires_at: new Date(86400000).toISOString() }
      : null,
  };
  const session = {
    view: () => view,
    async activate(consent) {
      calls.push(['activate', consent]);
      if (activates)
        view = {
          state: 'ready',
          dossier: { id: 'case-1', state: 'active', expires_at: new Date(86400000).toISOString() },
        };
    },
    discard() {
      calls.push(['discard']);
    },
    async send(code) {
      calls.push(['send', code]);
      view = { ...view, state: 'sending' };
      setImmediate(() => {
        view = { ...view, state: final };
      });
    },
  };
  let opened = null;
  const dialog = {
    open(options) {
      opened = options;
    },
  };
  const status = { textContent: '', hidden: true },
    button = { disabled: false };
  const { t } = createTranslator();
  const quick = createSupportQuickSend({
    session: () => session,
    dialog: () => dialog,
    t,
    button,
    status,
    now: () => clock,
    schedule: (fn, ms) => {
      clock += ms;
      setImmediate(fn);
    },
    timeoutMs: 5000,
    pollMs: 100,
  });
  return {
    quick,
    calls,
    status,
    button,
    opened: () => opened,
    setView: (v) => {
      view = v;
    },
  };
}

test('opening asks for consent and sends nothing until confirmed', () => {
  const h = harness();
  h.quick.open();
  const o = h.opened();
  assert.match(o.title, /Transmettre mon diagnostic/);
  assert.match(o.copy, /24 heures/);
  assert.match(o.copy, /sept jours/);
  assert.equal(o.confirm, 'Accepter et transmettre');
  assert.equal(h.calls.length, 0, 'nothing before confirmation');
  o.onCancel?.();
  assert.equal(h.calls.length, 0, 'cancel sends nothing');
});
test('confirmation activates the dossier, sends one manual capture and shows the reference', async () => {
  const h = harness();
  h.quick.open();
  await h.quick.run();
  assert.deepEqual(h.calls, [
    ['activate', true],
    ['send', 'manual'],
  ]);
  assert.match(h.status.textContent, /Référence à communiquer : case-1/);
  assert.equal(h.status.hidden, false);
  assert.equal(h.button.disabled, false);
});
test('an already active dossier is reused and a pending review is replaced', async () => {
  const h = harness({ active: true });
  h.setView({
    state: 'review',
    dossier: { id: 'case-1', state: 'active', expires_at: new Date(86400000).toISOString() },
  });
  await h.quick.run();
  assert.deepEqual(h.calls, [['discard'], ['send', 'manual']]);
});
test('offline, refused activation and unconfirmed sends are reported honestly', async () => {
  let h = harness({ final: 'offline' });
  await h.quick.run();
  assert.match(h.status.textContent, /Hors connexion/);
  h = harness({ activates: false });
  await h.quick.run();
  assert.deepEqual(h.calls, [['activate', true]]);
  assert.match(h.status.textContent, /n’a pas pu être envoyé/);
  h = harness({ final: 'failed' });
  await h.quick.run();
  assert.match(
    h.status.textContent,
    /n’a pas pu être envoyé/,
    'never claims receipt without confirmation',
  );
});
test('the copy exists in French, English and Spanish', () => {
  for (const locale of ['fr', 'en', 'es']) {
    const { t } = createTranslator({ locale });
    for (const key of [
      'quickButton',
      'quickTitle',
      'quickCopy',
      'quickAccept',
      'quickSending',
      'quickDone',
      'quickOffline',
      'quickFailed',
    ])
      assert.notEqual(t('support.' + key, { reference: 'r' }), 'support.' + key);
  }
});
