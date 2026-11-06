// Independent full replay of the committed candidate set; generation claims are not trusted.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import config from '../content/catalogue/remaining-adventures.json' with {type:'json'};
import source from '../content/generated/remaining-adventures.json' with {type:'json'};
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {qualifyDifficulty} from '../src/campaign/difficulty.js';
import {CAT} from '../src/campaign/catalogue.js';
import {connected,countSolutions,replay,signature,features} from './generate-diverse-grids.mjs';
const packs=new Set(config.adventures.map(p=>p.id)),all=canonicalQuestList();
const seen=new Set([...Object.values(CAT).flat(),...all.filter(q=>!packs.has(q.packId))].map(q=>signature(q.reg)));
assert.equal(source.questCount,380);assert.equal(source.quests.length,380);
const rows=[],stats=[];
for(const q of source.quests){
 const label=q.id,n=q.size;
 assert([8,9,10].includes(n),label);assert.equal(q.reg.length,n,label);assert.equal(q.sol.length,n,label);
 assert(q.reg.every(row=>row.length===n&&row.every(Number.isInteger)),label);
 const regions=new Set(q.reg.flat());assert.equal(regions.size,n,label);
 assert(connected(q.reg),'Connected territories, at least two cells: '+label);
 assert(q.sol.every((c,r)=>Number.isInteger(c)&&c>=0&&c<n&&(r===0||Math.abs(c-q.sol[r-1])>1)),label);
 assert.equal(new Set(q.sol).size,n,label);assert.equal(new Set(q.sol.map((c,r)=>q.reg[r][c])).size,n,label);
 assert.equal(countSolutions(q),1,'Unique solution '+label);
 const key=signature(q.reg);assert(!seen.has(key),'D4/renaming duplicate '+label);seen.add(key);
 const proof=replay(q);assert(proof,'Logical proof without guessing '+label);
 assert.equal(q.audit.proofSteps,proof.proofSteps,label);assert.deepEqual(q.audit.rules,proof.rules,label);
 const measured=features(q,proof);for(const k of Object.keys(q.features))assert.equal(q.features[k],measured[k],label+' '+k);
 const difficulty=qualifyDifficulty(q),runtime=all.find(x=>x.id===q.id);assert(runtime,'Published runtime grid '+label);
 assert.deepEqual(runtime.reg,q.reg);assert.deepEqual(runtime.sol,q.sol);
 rows.push({packId:q.packId,constellationId:q.constellationId,id:q.id,size:n,difficulty:difficulty.label,score:difficulty.score,proofSteps:proof.proofSteps,family:q.family});
}
let lastMax=0;
for(const p of config.adventures){
 const group=rows.filter(q=>q.packId===p.id),scores=group.map(q=>q.score);
 assert.equal(group.length,p.constellations.length*p.questsPerConstellation);
 const min=Math.min(...scores),max=Math.max(...scores);assert(min>=lastMax,'Measured adventure curve');lastMax=max;
 for(const c of p.constellations){const qs=group.filter(q=>q.constellationId===c.id);assert.equal(qs.length,10);for(let i=1;i<qs.length;i++)assert(qs[i].score>=qs[i-1].score,c.id)}
 const grids=source.quests.filter(q=>q.packId===p.id),range=values=>[Math.min(...values),Math.max(...values)];
 const spread=range(grids.map(q=>q.features.regionSpread)),boundaries=range(grids.map(q=>q.features.boundaryEdges));
 const traces=new Set(grids.map(q=>JSON.stringify(q.audit.rules))).size;
 assert(spread[1]>spread[0]&&boundaries[1]>boundaries[0]&&traces>1,'Measured shape and deduction diversity '+p.id);
 const rules={};for(const q of grids)for(const [rule,count] of Object.entries(q.audit.rules))rules[rule]=(rules[rule]||0)+count;
 stats.push({adventure:p.order+1,name:p.displayName,constellations:p.constellations.length,quests:group.length,min,max,mean:Number((scores.reduce((a,b)=>a+b)/scores.length).toFixed(2)),sizes:Object.fromEntries([8,9,10].map(n=>[n,group.filter(q=>q.size===n).length])),families:Object.fromEntries([...new Set(group.map(q=>q.family))].map(f=>[f,group.filter(q=>q.family===f).length])),diversity:{spread,boundaries,traces,rules}});
}
const report='# Validation des 380 nouvelles quêtes\n\nGénéré par `node scripts/validate-iau-completion.mjs --write`. Chaque grille a été recomptée et résolue depuis une grille vide par le moteur de preuves. Les rotations, symétries et renommages des régions sont dédupliqués face au catalogue existant. Aucun singleton dans les nouvelles grilles.\n\nLe score mesure la preuve logique du moteur, pas un temps humain. Les paliers se chevauchent aux égalités ; chaque constellation et chaque aventure suivent une courbe non décroissante. Les tailles candidates sont réparties globalement selon ce score. Les familles décrivent la stratégie de génération ; les formes restent toutes distinctes.\n\n| Aventure | Constellations | Quêtes | Score min–max | Moyenne | Tailles 8/9/10 | Familles |\n|---|---:|---:|---|---:|---|---|\n'+stats.map(s=>`| ${s.adventure} · ${s.name} | ${s.constellations} | ${s.quests} | ${s.min}–${s.max} | ${s.mean} | ${Object.values(s.sizes).join('/')} | ${Object.entries(s.families).map(([k,v])=>k+': '+v).join(', ')} |`).join('\n')+'\n\n| Aventure | Constellation | Quête | Difficulté (score) | Taille | Solution unique | Validation | Anomalies |\n|---|---|---|---|---|---|---|---|\n'+rows.map(q=>`| ${config.adventures.find(p=>p.id===q.packId).order+1} | ${config.adventures.flatMap(p=>p.constellations).find(c=>c.id===q.constellationId).name} | ${q.id} | ${q.difficulty} (${q.score}) | ${q.size} | Oui | Preuve ${q.proofSteps} étapes | Aucune |`).join('\n')+'\n';
const diversity='## Diversité mesurée\n\nLes écarts-types des tailles des régions et les nombres de frontières varient dans chaque aventure. Les profils de règles sont les mélanges distincts de déductions effectivement rejouées ; les comptes par règle sont cumulés. Toute disparition de cette variété fait échouer le contrôle.\n\n| Aventure | Écart-type des tailles des régions | Frontières | Profils de règles distincts | Déductions cumulées |\n|---|---|---|---:|---|\n'+stats.map(s=>`| ${s.adventure} | ${s.diversity.spread.join('–')} | ${s.diversity.boundaries.join('–')} | ${s.diversity.traces} | ${Object.entries(s.diversity.rules).map(([k,v])=>k+': '+v).join(', ')} |`).join('\n');
const completeReport=report.replace('\n\n| Aventure | Constellation | Quête |','\n\n'+diversity+'\n\n| Aventure | Constellation | Quête |');
const path='docs/validation/iau-completion.md';
if(process.argv.includes('--write'))fs.writeFileSync(path,completeReport);else assert.equal(fs.readFileSync(path,'utf8'),completeReport,'Committed validation report must match independently recomputed results');
console.log(JSON.stringify({validated:rows.length,stats}));
