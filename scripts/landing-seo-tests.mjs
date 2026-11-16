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

// #758: « Comment jouer » — a public, script-free page whose example is the real first quest.
const howTo=read('comment-jouer.html');
{
 const description=meta(howTo,'name','description');assert(description&&description.length>=70&&description.length<=170,'How-to description length');
 for(const p of ['og:title','og:description','og:image','og:url'])assert(meta(howTo,'property',p),'How-to Open Graph '+p);
 assert.match(howTo,/<link rel="canonical" href="https:\/\/lumen\.nopuna\.fr\/comment-jouer\.html">/);
 assert.match(howTo,/<h1>Comment jouer à Lumen<\/h1>/);
 assert.doesNotMatch(howTo,/<script\b(?![^>]*application\/ld\+json)/,'No executable script on the how-to page');
 const howLd=JSON.parse(howTo.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(howLd['@type'],'HowTo');assert.equal(howLd.step.length,3);
 assert.match(howTo,/<a class="play" href="\/">Jouer gratuitement<\/a>/,'Play CTA');
 assert(howTo.includes('href="/decouvrir.html"')&&page.includes('href="/comment-jouer.html"'),'Cross-links with the presentation page');
 // Rules as in GAMEPLAY.md, and the in-game interaction cycle.
 assert.match(howTo,/Un Gardien par ligne<\/strong> et <strong>un Gardien par colonne/);assert.match(howTo,/Un Gardien par territoire/);
 assert.match(howTo,/deux Gardiens ne se touchent jamais, même en diagonale/);
 assert.match(howTo,/la marque d’une croix \(case impossible\) ; un deuxième toucher y place un Gardien ; un troisième la vide/,'empty → excluded → Guardian → empty');
 // The worked example is derived from the catalogue and the rules.
 const {exampleModel,illustrations,SVG_FILES}=await import('./how-to-play.mjs');
 const ex=exampleModel(),drawn=illustrations(ex);
 const colourNames={'#8b70d7':'violet','#d38a54':'orange'},colours=JSON.parse(read('src/ui/game-screen.js').match(/const TERRITORY_COLORS=(\[[^\]]+\]);/)[1]);
 assert(howTo.includes('Le <strong>territoire '+colourNames[colours[ex.firstTerritory]]+'</strong> ne contient qu’une case ('+ex.label(ex.first)+')'),'Step 1 matches the grid');
 assert(howTo.includes('<strong>territoire '+colourNames[colours[ex.secondTerritory]]+'</strong> : après l’étape 1, il ne lui reste qu’une case libre ('+ex.label(ex.second)+')'),'Step 2 matches the grid');
 const rest=ex.sol.map((c,r)=>[r,c]).filter(([r,c])=>![ex.first,ex.second].some(p=>p[0]===r&&p[1]===c)).map(ex.label).join(' ; ').replace(/ ; ([^;]*)$/,' ; et $1');
 assert(howTo.includes('Les trois derniers vont en '+rest+'.'),'Remaining Gardiens match the unique solution: '+rest);
 for(const [name,file] of Object.entries(SVG_FILES)){
  assert.equal(read(file).replace(/\r\n/g,'\n'),drawn[name],file+' is up to date (node scripts/how-to-play.mjs)');
  assert(howTo.includes('src="/'+file+'"'),'Illustration used: '+file);assert(fs.statSync(file).size<20000,'Light SVG: '+file);
 }
}

// #769: « Apprendre les constellations en jouant » — facts from the catalogue, honest sky notes.
{
 const learn=read('apprendre-constellations.html');
 const description=meta(learn,'name','description');assert(description&&description.length>=70&&description.length<=170,'Learn description length');
 for(const p of ['og:title','og:description','og:image','og:url'])assert(meta(learn,'property',p),'Learn Open Graph '+p);
 assert(learn.includes('<link rel="canonical" href="https://lumen.nopuna.fr/apprendre-constellations.html">'),'Canonical');
 assert(learn.includes('<h1>Apprendre les constellations en jouant</h1>'),'H1');
 assert.doesNotMatch(learn,/<script/,'No script on the learn page');
 const names=CONTENT_CONSTELLATIONS.filter(c=>c.packId===first.id).map(c=>c.label);
 const listed=names.slice(0,-1).join(', ')+' et '+names.at(-1);
 assert(learn.includes('<span id="first-constellations">'+listed+'</span>'),'First Adventure constellations from the catalogue: '+listed);
 assert(learn.includes('<strong>'+quests.filter(q=>q.packId===first.id).length+' quêtes</strong> réparties sur <strong>'+names.length+' constellations</strong>'),'First Adventure size from the catalogue');
 assert(learn.includes('<strong>'+CONTENT_CONSTELLATIONS.length+' constellations officielles</strong>'));
 if(names.some(n=>/Croix du Sud/.test(n)))assert.match(learn,/ne se voit pas depuis la France métropolitaine/,'Honest note: the Southern Cross is not visible from France');
 assert.match(learn,/Stellarium/);assert.match(learn,/CC BY-SA/);assert.match(learn,/Hipparcos/);
 assert(learn.includes('href="/comment-jouer.html"')&&learn.includes('href="/decouvrir.html"')&&page.includes('href="/apprendre-constellations.html"'),'Cross-links');
 assert(learn.includes('<a class="play" href="/">Jouer gratuitement</a>'),'Play CTA');
}
// robots.txt and sitemap.
assert.match(robots,/^User-agent: \*$/m);assert.match(robots,/^Disallow: \/admin\/$/m);
assert.doesNotMatch(robots,/Disallow: \/src\//,'Never hide the code and styles Google needs to render the game');
assert.match(robots,/^Sitemap: https:\/\/lumen\.nopuna\.fr\/sitemap\.xml$/m);
const locs=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
assert.deepEqual(locs,['https://lumen.nopuna.fr/','https://lumen.nopuna.fr/decouvrir.html','https://lumen.nopuna.fr/comment-jouer.html','https://lumen.nopuna.fr/apprendre-constellations.html']);
for(const l of locs){const path=new URL(l).pathname;assert(fs.existsSync(path==='/'?'index.html':path.slice(1)),'Sitemap URL exists: '+l)}

// Every new public file is published and verified by both release paths.
for(const file of ['decouvrir.html','comment-jouer.html','apprendre-constellations.html','robots.txt','sitemap.xml']){
 assert.match(read('scripts/o2switch-cron-publish.sh'),new RegExp('PUBLIC_PAGES=\\([^)]*'+file.replace('.','\\.')),'Cron publisher: '+file);
 assert.match(read('scripts/o2switch-safe-release.sh'),new RegExp('for page in [^;]*'+file.replace('.','\\.')),'Safe release: '+file);
 assert.match(read('scripts/o2switch-deploy-tests.py'),new RegExp('PUBLIC_PAGES = \\([^)]*"'+file.replace('.','\\.')+'"'),'Deploy tests: '+file);
}
console.log('landing-seo-tests: head, page facts, structured data, images, robots, sitemap and release lists OK');
