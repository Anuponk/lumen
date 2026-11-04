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
assert(sw.includes('if(!response.ok||response.redirected)throw new Error('),'Mandatory shell HTTP failures and redirects must fail install');
assert(sw.includes('await precacheCompleteShell(cache);'),'All mandatory and transitive assets must be awaited');
assert(sw.indexOf('await precacheCompleteShell(cache);')<sw.indexOf('await self.skipWaiting();'),'Worker must only skip waiting after full cache installation');
assert(sw.includes('if(visited.size>2000)throw'),'Unexpectedly large dependency graphs must abort installation');
assert(sw.includes('staticDependencies(source,'),'Transitive static module dependencies must be discovered');
assert(sw.includes('visited.has(path)'),'Cyclic imports must be handled');
assert(sw.includes("url.search===''"),'Auth or query-bearing navigation must not be cached as public shell');
assert(sw.includes("url.pathname.startsWith('/src/')"));
assert(sw.includes("url.pathname.startsWith('/content/')"));
assert(sw.includes('url.origin!==self.location.origin'),'Never intercept third-party APIs');
console.log('Android/PWA static preflight OK. Offline gameplay still requires real device validation.');

// Budget report is informational; a separate test checks the complete asset graph.
