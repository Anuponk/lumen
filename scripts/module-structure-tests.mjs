import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {functionSource} from './source-tools.mjs';

const baseline='dcd9f3c872e623541be698edc212b64589d3b164';
const original=(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8'})).replace(/\r/g,'');
const html=fs.readFileSync('index.html','utf8');
assert(!/<style\b|\sonclick\s*=/i.test(html),'Shell contains inline CSS or handlers');
for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 assert(/\bsrc=/.test(script[1])&&!script[2].trim(),'Shell contains inline logic');
}
assert(html.includes('src="./src/main.js"'),'Module bootstrap missing');
// The modularization baseline guards the original regression cases below. CSS is now
// intentionally evolved by #27/#28 and later UX work, so compare structure instead of
// requiring byte-for-byte equality with the pre-responsive stylesheet.
const currentStyles=fs.readFileSync('src/ui/styles.css','utf8').replace(/\r/g,'').trim();
const primaryCTA='.success-actions #successNew.success-primary{background:linear-gradient(135deg,#68e7ff,#8b7cff);color:#07111d;border-color:transparent;box-shadow:0 0 22px rgba(104,231,255,.2)}';
assert(currentStyles.includes(primaryCTA),'Primary CTA styling missing');
assert(currentStyles.includes('max-height:calc(100dvh - 48px);overflow-y:auto;'),'Success card cannot scroll on small screens');
assert(currentStyles.includes('@media (min-width:1100px)'),'Common wide responsive layout missing');
assert(currentStyles.includes('@media (max-width:700px)'),'Common compact responsive layout missing');
assert(currentStyles.includes('.attempt-mask'),'Attempt lifecycle mask styling missing');
const labels=source=>[...source.matchAll(/\btest\("([^"\n]+)"/g)].map(match=>match[1]);
const tests=labels(fs.readFileSync('src/testing/hint-tests.js','utf8'));
const originalTests=labels(functionSource(original,'runHintTests'));
const additionalTests=["UX : Quête suivante est le CTA principal après réussite","UX : les règles sont accessibles à la demande","Vocabulaire : les indices n'utilisent plus l'ancien thème de l'eau","UX : fermer Mon ciel après réussite enchaîne sur la quête suivante","UX : la prochaine quête débloquée est visible comme Nouvelle dans Mon ciel","UX : Mon ciel reste au-dessus du masque de tentative","UX mobile : les contrôles de tentative ne recouvrent pas le raccourci Mon ciel","Navigation : Quête suivante après rejeu reste relative à la quête jouée","Navigation : le rejeu conserve séparément la progression maximale","Apprentissage : poser un Gardien utilise le vrai cycle à deux touchers","Apprentissage : les cinq premières quêtes imposent le jeu manuel","Apprentissage : le Marquage auto se débloque à la quête 6 sans s’activer seul","Apprentissage : après la quête 2 Mon ciel propose une visite contextuelle"];
assert.equal(originalTests.length,66);
assert.equal(tests.length,originalTests.length+additionalTests.length);
const intentionalRenames=new Map([["Indice : bouton Revoir la quête présent","Indice : fermeture contextuelle remplace Revoir la quête"]]);
const normalizedTests=tests.filter(label=>!additionalTests.includes(label)).map(label=>[...intentionalRenames].find(([,next])=>next===label)?.[0]||label);
assert.deepEqual(normalizedTests,originalTests,'Regression cases removed or renamed');
assert.deepEqual(tests.filter(label=>additionalTests.includes(label)).sort(),[...additionalTests].sort(),'UX regression cases missing');
const graph=new Map();
function visit(filename,stack=[]){
 const file=path.resolve(filename);
 assert(!stack.includes(file),'Module import cycle: '+[...stack,file].join(' -> '));
 if(graph.has(file))return;
 const source=fs.readFileSync(file,'utf8');
 const imports=[...source.matchAll(/\bimport\s+(?:[\s\S]*?\s+from\s+)?["'](\.[^"']+)["']/g)].map(match=>path.resolve(path.dirname(file),match[1]));
 graph.set(file,imports);
 for(const target of imports){assert(fs.existsSync(target),'Missing import '+target);visit(target,[...stack,file])}
}
visit('src/main.js');
console.log(JSON.stringify({baseline,modules:graph.size,acyclic:true,shell:true,css:'structural responsive and attempt guards passing',originalRegressionCases:originalTests.length,additionalRegressionCases:additionalTests.length,regressionCases:tests.length}));
