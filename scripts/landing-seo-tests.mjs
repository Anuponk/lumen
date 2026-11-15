// #736: presentation page and search-engine basics. Facts on the page are derived from
// the catalogue so that a content change cannot silently make them false.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

const read=p=>fs.readFileSync(p,'utf8');
const index=read('index.html'),page=read('decouvrir.html'),robots=read('robots.txt'),sitemap=read('sitemap.xml');
const meta=(html,attr,name)=>html.match(new RegExp('<meta '+attr+'="'+name+'" content="([^"]*)"'))?.[1];

// Game page head: description and social preview, still without inline logic.
for(const html of [index,page]){
 const description=meta(html,'name','description');assert(description&&description.length>=70&&description.length<=170,'Meta description between 70 and 170 characters');
 for(const p of ['og:title','og:description','og:image','og:url'])assert(meta(html,'property',p),'Open Graph '+p);
 assert.equal(meta(html,'name','twitter:card'),'summary_large_image');
 assert.match(html,/<link rel="canonical" href="https:\/\/lumen\.nopuna\.fr\/[^"]*">/);
 assert.equal(meta(html,'property','og:image'),'https://lumen.nopuna.fr/src/landing/og.jpg');
}
assert.doesNotMatch(index,/application\/ld\+json/,'The game shell keeps no inline script (module-structure contract)');

// Presentation page: readable without JavaScript, structured data, real facts.
assert.match(page,/<h1>[^<]{10,}<\/h1>/);
assert.doesNotMatch(page,/<script\b(?![^>]*application\/ld\+json)/,'No executable script on the presentation page');
const ld=JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
assert.equal(ld['@type'],'VideoGame');assert.equal(ld.name,'Lumen');assert.equal(ld.url,'https://lumen.nopuna.fr/');assert.equal(ld.offers.price,'0');
assert(page.includes('href="/"'),'The page leads to the game');
const quests=canonicalQuestList(),first=CONTENT_PACKS.find(p=>p.access==='included');
assert(page.includes(CONTENT_CONSTELLATIONS.length+' constellations officielles'),'Constellation count from the catalogue');
assert(page.includes(quests.length+' quêtes'),'Quest count from the catalogue');
assert(page.includes(CONTENT_PACKS.length+' aventures'),'Adventure count from the catalogue');
assert(page.includes('('+quests.filter(q=>q.packId===first.id).length+' quêtes) est offerte'),'Free Adventure size from the catalogue');
assert.match(page,/un Gardien par ligne, par colonne et par territoire/i,'In-game terminology');
assert.match(page,/ne se touchent jamais, même en diagonale/,'The adjacency rule of GAMEPLAY.md');
assert.match(page,/Stellarium/);assert.match(page,/CC BY-SA/);assert.match(page,/Hipparcos/,'Astronomy attribution (#740)');
assert.match(page,/petit studio indépendant/);assert.doesNotMatch(page,/pas (pour|à) gagner|sans but lucratif/i,'Intention wording only (#732)');
for(const img of page.matchAll(/<img src="\/([^"]+)" width="(\d+)" height="(\d+)"/g)){
 assert(fs.existsSync(img[1]),'Image exists: '+img[1]);assert(fs.statSync(img[1]).size<250000,'Image stays light: '+img[1]);
}
const og=fs.readFileSync('src/landing/og.jpg');assert.equal(og[0],0xff);assert.equal(og[1],0xd8,'Social image is a JPEG');
let i=2,size=null;while(i<og.length){const marker=og[i+1],len=og.readUInt16BE(i+2);if(marker>=0xc0&&marker<=0xc3){size=[og.readUInt16BE(i+7),og.readUInt16BE(i+5)];break}i+=2+len}
assert.deepEqual(size,[1200,630],'Social image is 1200×630');

// robots.txt and sitemap.
assert.match(robots,/^User-agent: \*$/m);assert.match(robots,/^Disallow: \/admin\/$/m);
assert.doesNotMatch(robots,/Disallow: \/src\//,'Never hide the code and styles Google needs to render the game');
assert.match(robots,/^Sitemap: https:\/\/lumen\.nopuna\.fr\/sitemap\.xml$/m);
const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.deepEqual(locs,['https://lumen.nopuna.fr/','https://lumen.nopuna.fr/decouvrir.html']);
for(const l of locs){const path=new URL(l).pathname;assert(fs.existsSync(path==='/'?'index.html':path.slice(1)),'Sitemap URL exists: '+l)}

// Every new public file is published and verified by both release paths.
for(const file of ['decouvrir.html','robots.txt','sitemap.xml']){
 assert.match(read('scripts/o2switch-cron-publish.sh'),new RegExp('PUBLIC_PAGES=\\([^)]*'+file.replace('.','\\.')),'Cron publisher: '+file);
 assert.match(read('scripts/o2switch-safe-release.sh'),new RegExp('for page in [^;]*'+file.replace('.','\\.')),'Safe release: '+file);
 assert.match(read('scripts/o2switch-deploy-tests.py'),new RegExp('PUBLIC_PAGES = \\([^)]*"'+file.replace('.','\\.')+'"'),'Deploy tests: '+file);
}
console.log('landing-seo-tests: head, page facts, structured data, images, robots, sitemap and release lists OK');
