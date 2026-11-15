// #724: admin Adventure access panel model, against the real catalogue metadata.
import assert from 'node:assert/strict';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {lockedAdventures,adventureAccessRows,validReason} from '../src/ui/adventure-access-panel.js';

const locked=lockedAdventures(CONTENT_PACKS);
const expected=CONTENT_PACKS.filter(p=>p.access==='locked');
assert.equal(locked.length,expected.length,'Every locked pack of the catalogue is offered, no hardcoded total');
assert(!locked.some(p=>CONTENT_PACKS.find(c=>c.id===p.id).access==='included'),'The included Adventure is never offered');
for(const p of locked)assert.match(p.id,/^real-adventure-\d{2}$/,'Offered ids match the server validation pattern');
assert.equal(locked[0].label,'Aventure '+(expected[0].order+1)+' · '+expected[0].displayName);

const target=locked[0].id,other=locked[1].id;
const rows=adventureAccessRows(CONTENT_PACKS,{adventures:[
 {adventure:target,active:true,source:'admin',granted_at:'2026-11-15T10:00:00Z',expires_at:null},
 {adventure:other,active:false,source:'admin',granted_at:'2026-11-14T10:00:00Z',expires_at:'2026-11-15T09:00:00Z'},
 {adventure:'unknown-pack',active:true}]});
assert.equal(rows.length,locked.length,'Unknown server ids never add rows');
assert.deepEqual(rows.find(r=>r.id===target).active,true);
assert.deepEqual(rows.find(r=>r.id===other).active,false,'An expired entitlement is shown as revoked, not owned');
assert.equal(rows.find(r=>r.id===other).expiresAt,'2026-11-15T09:00:00Z');
assert(rows.filter(r=>r.id!==target&&r.id!==other).every(r=>!r.active&&!r.expiresAt),'Others stay locked');
assert.equal(adventureAccessRows(CONTENT_PACKS,null).every(r=>!r.active),true,'Missing data never shows an access');

for(const bad of ['','  ','ab',' ab ','x'.repeat(201),null,undefined])assert.equal(validReason(bad),false);
for(const ok of ['abc','  bêta-test  ','x'.repeat(200)])assert.equal(validReason(ok),true);
console.log('adventure-access-tests: '+locked.length+' locked Adventures, rows and reasons OK');

// game-screen.js uses CONTENT_PACKS for the admin panel and for the transient
// all_adventures_access override; both threw ReferenceError when it was not imported.
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const contentImport=screen.match(/import \{([^}]*)\} from "\.\.\/campaign\/content\.js";/);
assert(contentImport&&contentImport[1].split(',').map(s=>s.trim()).includes('CONTENT_PACKS'),'game-screen.js imports CONTENT_PACKS');
const sandbox={CONTENT_PACKS,lumenUser:{id:'admin'},qaActive:false,lumenEntitlements:['real-adventure-02'],lumenCapabilities:['all_adventures_access']};
vm.createContext(sandbox);
for(const fn of ['hasInternalCapability','adventureAccessEntitlements'])vm.runInContext(functionSource(screen,fn),sandbox);
const opened=vm.runInContext('adventureAccessEntitlements()',sandbox);
assert.deepEqual([...opened].sort(),[...new Set(['real-adventure-02',...CONTENT_PACKS.map(p=>p.id)])].sort(),'all_adventures_access opens every catalogued Adventure');
assert.deepEqual(sandbox.lumenEntitlements,['real-adventure-02'],'The override never becomes a stored entitlement');
sandbox.lumenCapabilities=['analytics_cockpit'];
assert.deepEqual(vm.runInContext('adventureAccessEntitlements()',sandbox),['real-adventure-02'],'Cockpit access alone does not open Adventures');
console.log('adventure-access-tests: CONTENT_PACKS import and transient admin override OK');
