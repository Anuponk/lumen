// Staging validation for the 100 Adventure 5 candidates, never publishes content.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {CAT} from '../src/campaign/catalogue.js';
import {connected,countSolutions,replay,signature} from './generate-diverse-grids.mjs';
const source=JSON.parse(fs.readFileSync('content/generated/fifth-adventure-candidates.json','utf8'));
const config=JSON.parse(fs.readFileSync('content/fifth-adventure-preview.json','utf8'));
assert.equal(source.quests.length,100);
assert.equal(source.questCount,100);
const known=new Set(Object.values(CAT).flat().map(p=>signature(p.reg)));
const ids=new Set(),signatures=new Set(),codes=new Set(config.constellations.map(c=>c.id));
let proved=0;
for(const q of source.quests){
 assert.ok(!ids.has(q.id),'Duplicate quest ID '+q.id);ids.add(q.id);
 assert.ok(codes.has(q.constellationId),'Unknown constellation '+q.constellationId);
 assert.ok([7,8].includes(q.size),'Unexpected grid size');
 assert.ok(connected(q.reg),'Disconnected territory '+q.id);
 assert.equal(countSolutions(q),1,'Nonunique grid '+q.id);
 const key=signature(q.reg);
 assert.ok(!known.has(key),'Existing catalogue duplicate '+q.id);
 assert.ok(!signatures.has(key),'Adventure 5 duplicate '+q.id);signatures.add(key);
 const proof=replay(q);
 assert.ok(proof,'No explainable proof for '+q.id);proved++;
}
for(const c of config.constellations)assert.equal(source.quests.filter(q=>q.constellationId===c.id).length,10,'Incorrect quest count for '+c.id);
console.log('PASS: 100 unique, connected, logically proved candidate grids; no published catalogue duplicates. Proofs: '+proved);
