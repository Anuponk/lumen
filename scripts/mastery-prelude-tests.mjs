// #886 · Mastery celebration: a large golden parade within 6–8 s, skippable,
// absent with reduced motion, attached only to the first real mastery event.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { masteryPreludeTiming, playMasteryPrelude } from '../src/ui/mastery-prelude.js';

test('the parade fits the 6–8 s celebration for every adventure size', () => {
  for (const count of [1, 3, 6, 10, 12, 20]) {
    const { step, total } = masteryPreludeTiming(count);
    assert(step >= 260 && step <= 700, count + ' step ' + step);
    // About 1.5 s more for the gathered mosaic, golden wave and conclusion.
    assert(total + 1500 <= 8000, count + ' constellations: ' + total);
  }
  assert(masteryPreludeTiming(10).total + 1500 >= 6000, 'a full adventure is not rushed');
});

test('reduced motion, no host or no figure: nothing is played', () => {
  const host = { ownerDocument: {} };
  assert.equal(
    playMasteryPrelude(host, { figures: [{ svg: '', label: 'x' }], reducedMotion: true }),
    null,
  );
  assert.equal(playMasteryPrelude(null, { figures: [{ svg: '', label: 'x' }] }), null);
  assert.equal(playMasteryPrelude(host, { figures: [] }), null);
});

test('wiring: mastery only, from the one-shot celestial event, presentation only', () => {
  const source = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  const show = source.slice(
    source.indexOf('function showCelestialVictory('),
    source.indexOf('let mapConstellation=0'),
  );
  assert.match(show, /if\(shown&&mastery\)\{/);
  assert.match(
    show,
    /playMasteryPrelude\(host,\{figures:parade,skipLabel:t\('results\.masterySkip'\),reducedMotion:/,
  );
  assert.match(
    show,
    /copy:mastery\?t\(campaign\?'results\.masteryCampaignCopy':'results\.masteryAdventureCopy'\)/,
  );
  // The event is consumed once: refresh, consultation or sync never replay it.
  assert.match(show, /const event=celestialPending;celestialPending=null;/);
  const module = fs
    .readFileSync('src/ui/mastery-prelude.js', 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('//'))
    .join(' ');
  assert.doesNotMatch(
    module,
    /localStorage|save|progress|badge|reward/i,
    'no persistence or reward in the prelude',
  );
  const clear = fs.readFileSync('src/ui/celestial-celebration.js', 'utf8');
  assert.match(clear, /classList\.remove\('celestial-still','mastery-prelude-playing'\)/);
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.mastery-prelude\{display:none\}/);
  assert.match(css, /#skyReveal\[data-celestial\$="mastery"\] \.sky-line\.on\{stroke:#f4cf78\}/);
});
