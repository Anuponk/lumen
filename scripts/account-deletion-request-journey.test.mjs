import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { accountDeletionMailto, wireAccountDeletionForm } from '../src/privacy/account-deletion.js';

const page = readFileSync(new URL('../supprimer-compte.html', import.meta.url), 'utf8');

test('public deletion request is available without login and states manual send', () => {
  assert.match(page, /id="accountDeletionRequest"/);
  assert.match(page, /id="deletionConfirmation"/);
  assert.match(page, /type="email"/);
  assert.match(page, /Aucune demande n.est envoyée automatiquement/);
  assert.match(page, /uniquement les données associées à Lumen/i);
  assert.doesNotMatch(page, /SoldeZen|Supabase/i);
  assert.match(page, /mailto:valente\.cedric@gmail\.com/);
  assert.doesNotMatch(page, /type="password"/);
});

test('request email contains only account identifier and explicit Lumen scope', () => {
  const url = accountDeletionMailto('  joueur@example.org  ');
  assert.ok(url.startsWith('mailto:valente.cedric@gmail.com?'));
  const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
  assert.match(params.get('subject'), /suppression.*Lumen/i);
  assert.match(params.get('body'), /joueur@example\.org/);
  assert.match(params.get('body'), /pas mes autres services/);
  assert.doesNotMatch(params.get('body'), /mot de passe|token|jwt/i);
});

test('invalid and injected addresses are rejected', () => {
  for (const value of ['', 'invalid', 'a@example.org\r\nBcc:evil@example.org', 'a@example.org?bcc=evil', 'a@example.org#x', 'a@example.org&x']) {
    assert.throws(() => accountDeletionMailto(value));
  }
});

test('form prepares but does not send, and accurately reports manual action', () => {
  const status = { textContent: '' };
  const form = { reportValidity: () => true, onsubmit: null };
  const elements = {
    accountDeletionRequest: form,
    deletionRequestStatus: status,
    deletionAccountAddress: { value: 'joueur@example.org' }
  };
  const opened = [];
  wireAccountDeletionForm({ getElementById: id => elements[id] }, url => opened.push(url));
  let prevented = false;
  form.onsubmit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(opened.length, 1);
  assert.match(opened[0], /^mailto:/);
  assert.match(status.textContent, /Envoie ce message/);
  assert.match(status.textContent, /aucune suppression ni aucun envoi automatique/);
});

test('invalid form never opens messaging client', () => {
  const status = { textContent: '' };
  const form = { reportValidity: () => false, onsubmit: null };
  const elements = { accountDeletionRequest: form, deletionRequestStatus: status, deletionAccountAddress: { value: 'invalid' } };
  const opened = [];
  wireAccountDeletionForm({ getElementById: id => elements[id] }, url => opened.push(url));
  form.onsubmit({ preventDefault() {} });
  assert.equal(opened.length, 0);
});
