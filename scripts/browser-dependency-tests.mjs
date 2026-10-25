import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
assert(!scripts.some(src=>/^(https?:)?\/\//.test(src)),'the application must not load executable scripts from third-party CDNs');
const manifest=JSON.parse(fs.readFileSync('content/legal/browser-dependencies.json','utf8'));
assert.equal(manifest.schema,1);
assert.deepEqual(manifest.libraries.map(item=>item.name).sort(),['@supabase/supabase-js','qrcodejs']);
for(const library of manifest.libraries){
 assert.match(library.version,/^\d+\.\d+\.\d+$/,'library versions must be exact');
 assert.match(library.path,/^src\/vendor\/[a-z0-9./-]+\.js$/);
 assert(!library.path.includes('..'));
 assert(scripts.includes('./'+library.path),'the app must use the inventoried asset');
 const bytes=fs.readFileSync(library.path);
 assert.equal(bytes.length,library.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),library.sha256,'bundled bytes must match the reviewed inventory');
 assert.match(library.source,/^https:\/\//);
 assert(library.source.includes('@'+library.version)||library.source.includes('/'+library.version+'/'),'source must name the pinned version');
 assert.match(fs.readFileSync(library.licensePath,'utf8'),/permission is hereby granted/i);
 assert.equal(library.license,'MIT');
}
assert(scripts.indexOf('./'+manifest.libraries[0].path)<scripts.indexOf('./src/main.js'),'SDK must be available before application startup');
console.log('Browser dependencies: no CDN execution; pinned assets, hashes and license copies verified.');
