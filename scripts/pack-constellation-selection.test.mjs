import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeConstellations,validatePackConstellations} from './pack-constellation-selection.mjs';
test('does not invent verified constellations',()=>{
 assert.throws(()=>proposeConstellations({count:1}),/eligible unused constellations/);
});
test('rejects unknown and already published constellations',()=>{
 assert.equal(validatePackConstellations([{id:'made-up',name:'Invented'}]).ok,false);
 assert.equal(validatePackConstellations([{id:'real-01',name:'Grande Ourse'}]).ok,false);
});
test('selects verified unused entries',()=>{
 const registry=[{id:'new-01',nameFr:'Test',astronomyVerified:true,silhouette:{points:[[0,0]],edges:[]},provenance:'fixture'}];
 assert.equal(proposeConstellations({count:1,registry})[0].id,'new-01');
});
