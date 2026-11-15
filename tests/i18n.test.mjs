import assert from "node:assert/strict";
import test from "node:test";
import {getLocale, normalizeLocale, SUPPORTED_LOCALES, t} from "../src/ui/i18n.js";

test("language support is limited to FR and EN with a safe French fallback", () => {
  assert.deepEqual(SUPPORTED_LOCALES, ["fr", "en"]);
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("fr-CA"), "fr");
  assert.equal(normalizeLocale("de-DE"), "fr");
  assert.equal(normalizeLocale(null), "fr");
});

test("static UI translations can move in both directions", () => {
  assert.equal(t("Se connecter", "en"), "Sign in");
  assert.equal(t("Sign in", "fr"), "Se connecter");
  assert.equal(t("Sign in", "en"), "Sign in");
  assert.equal(t("Mon ciel", "en"), "My sky");
});

test("unknown copy is preserved, never automatically translated", () => {
  assert.equal(t("PlayerNickname271", "en"), "PlayerNickname271");
  assert.equal(t("A new message from a player", "fr"), "A new message from a player");
  assert.equal(getLocale(), "fr");
});
