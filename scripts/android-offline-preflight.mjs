import assert from 'node:assert/strict';
import fs from 'node:fs';

// Static preflight only: no claim that gameplay works in airplane mode.
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
const sw=fs.readFileSync('sw.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.equal(manifest.start_url,'/');
assert.equal(manifest.scope,'/');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.orientation,'portrait-primary');
assert(html.includes('rel="manifest"'));
assert(html.includes('src="./src/main.js"'));
assert(html.includes('src="./src/vendor/supabase-2.118.0.js"'));
assert(sw.includes('lumen-assets-'));
assert(sw.includes('caches.open(CACHE)'));
assert(sw.includes("url.pathname.startsWith('/src/')"));
assert(sw.includes('url.search===\'\''),'OAuth or other query-bearing navigation must not be cached as shell');
assert(!sw.includes('cache.addAll(["/src/'), 'Do not assume application modules are pre-cached at install');

const initialShell=sw.match(/const SHELL=\[([^\]]+)\]/)?.[1]||'';
assert(!initialShell.includes('/src/main.js'),'Current install shell does not pre-cache main module');
assert(!initialShell.includes('/src/vendor/supabase-2.118.0.js'),'Current install shell does not pre-cache vendor');

console.log('Android/PWA static preflight OK. Offline gameplay is NOT certified: modules are cached only after fetch; a cold install in airplane mode may fail.');
