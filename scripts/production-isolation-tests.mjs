// #962: browser tests never reach the production Supabase project. Production logs
// showed ~65k anonymous reads a day from HeadlessChrome on http://127.0.0.1:8000/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

delete process.env.LUMEN_TEST_ALLOW_PRODUCTION;
const { PRODUCTION_SUPABASE_BLOCK } = await import('./cdp-client.mjs');
const harness = fs.readFileSync('scripts/cdp-client.mjs', 'utf8');

// The blocked host is exactly the one the game talks to.
const sources = ['src/persistence/config.js', 'src/ui/game-screen.js', 'index.html']
  .filter((file) => fs.existsSync(file))
  .map((file) => fs.readFileSync(file, 'utf8'));
const hosts = new Set(
  sources.flatMap((text) =>
    [...text.matchAll(/https:\/\/([a-z0-9]+)\.supabase\.co/g)].map((m) => m[1]),
  ),
);
assert(hosts.size >= 1, 'the game names its Supabase project');
for (const host of hosts)
  assert.equal(
    PRODUCTION_SUPABASE_BLOCK,
    '*://' + host + '.supabase.co/*',
    'blocked by default: ' + host,
  );

// connectBrowser installs the block and keeps it in every later list a suite sets.
assert.match(
  harness,
  /method==='Network\.setBlockedURLs'\?\{\.\.\.params,urls:\[\.\.\.new Set\(\[\.\.\.\(params\.urls\|\|\[\]\),PRODUCTION_SUPABASE_BLOCK\]\)\]\}/,
);
assert.match(harness, /await send\('Network\.setBlockedURLs',\{urls:\[\]\}\)/);

// The opt-out is explicit and never set by CI.
for (const file of fs.readdirSync('.github/workflows')) {
  assert.doesNotMatch(
    fs.readFileSync(path.join('.github/workflows', file), 'utf8'),
    /LUMEN_TEST_ALLOW_PRODUCTION/,
    file + ' must not reach production from browser tests',
  );
}
process.env.LUMEN_TEST_ALLOW_PRODUCTION = '1';
const optedIn = await import('./cdp-client.mjs?allow-production');
assert.equal(optedIn.PRODUCTION_SUPABASE_BLOCK, null, 'a deliberate production check can opt in');
console.log('production-isolation-tests: browser suites cannot reach production Supabase');
