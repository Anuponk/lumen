import assert from 'node:assert/strict';
import fs from 'node:fs';

// Static checks only. Real Android airplane-mode gameplay remains a separate acceptance test.
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

const match=sw.match(/const SHELL=\[([^\]]+)\]/);
assert(match,'Missing public shell declaration');
const shell=JSON.parse('['+match[1]+']');
const required=['/','/manifest.webmanifest','/icon.svg','/icon-maskable.svg','/src/main.js','/src/ui/game-screen.js','/src/vendor/supabase-2.118.0.js'];
for(const asset of required){
 assert(shell.includes(asset),'Missing mandatory offline entrypoint: '+asset);
 assert(fs.existsSync(asset.slice(1)||'index.html'),'Offline entrypoint missing from repository: '+asset);
}
assert(sw.includes('if(!response.ok)throw new Error('),'Mandatory shell HTTP failures must fail install');
assert(sw.includes('await Promise.all(SHELL.map('),'All mandatory assets must be awaited');
assert(sw.includes("url.search===''"),'Auth or query-bearing navigation must not be cached as public shell');
assert(sw.includes("url.pathname.startsWith('/src/')"));
assert(sw.includes("url.pathname.startsWith('/content/')"));
assert(sw.includes('url.origin!==self.location.origin'),'Never intercept third-party APIs');
console.log('Android/PWA static preflight OK. Offline gameplay still requires real device validation.');
