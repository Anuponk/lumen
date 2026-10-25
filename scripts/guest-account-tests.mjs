import assert from 'node:assert/strict';
import {guestAccountSeed,preserveGuestBeforeHydration,guestNeedsReconciliation} from '../src/persistence/guest-account.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
const guest={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{earned:1},stars:{bonus:1},performances:{0:{badges:{speed:true}}},xp:30,shards:2,legacyAdventureAccess:['kept']};
const fresh={solved:{},badges:{},xp:0,shards:3};
assert.deepEqual(guestAccountSeed(guest,null,'a',fresh),guest,'New accounts inherit actual guest achievements and net currency');
assert.equal(guestAccountSeed(guest,'b','a',fresh),fresh,'A signed-out account cannot donate its cache');
assert.equal(guestAccountSeed(guest,'a','a',fresh),guest);
assert.throws(()=>guestAccountSeed({...guest,walletRevision:1},null,'a',fresh));
assert.equal(guestAccountSeed({solved:{},badges:{}},null,'a',fresh).shards,3,'An untouched guest retains the existing starting reserve');
assert.throws(()=>guestAccountSeed({...guest,shards:-1},null,'a',fresh));
const data=new Map([['lumenProgressV1',JSON.stringify(guest)]]),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const raw=preserveGuestBeforeHydration(storage,{accountId:'a'});
assert.equal(raw,JSON.stringify(guest));
assert.equal(preserveGuestBeforeHydration(storage,{accountId:'a'}),raw,'Retry/reload reuses the exact original');
assert.equal(preserveGuestBeforeHydration(storage,{accountId:'b',currentOwner:'a'}),null);
assert.equal(guestNeedsReconciliation(guest,structuredClone(guest)),false);
assert.equal(guestNeedsReconciliation(guest,fresh),true,'An existing empty profile must never erase the guest');
const starter={solved:{},badges:{},stars:{},performances:{},challenges:{},daily:{dates:{},rewards:{}},xp:0,shards:3,catalogueOrigin:currentCatalogueOrigin};
for(const balance of [0,2,99]){
 const existing={...structuredClone(guest),shards:balance,walletRevision:7};delete existing.catalogueOrigin;
 assert.equal(guestNeedsReconciliation(starter,existing),false,'A virgin browser starter reserve is not an acquisition or debit against an existing account');
 assert.equal(guestNeedsReconciliation({...starter,skyScore:null},existing),false,'The unset score before first rendering is also a starter default');
 const start={questIndex:9,lastQualifiedDay:'2026-01-15',lastQualifiedAt:'2026-01-15T12:00:00.000Z'};
 assert.equal(guestNeedsReconciliation({...starter,performances:{9:start}},existing),false,'A first gesture writes cooldown metadata, not an acquired performance');
 for(const addition of [{time:40},{bestTime:20},{attempts:1},{badges:{speed:true}},{stars:1},{unknown:'preserve'}])
  assert.equal(guestNeedsReconciliation({...starter,performances:{9:{...start,...addition}}},existing),true,'Real or unknown performance evidence remains protected');
 for(const invalid of [{...start,questIndex:8},{...start,lastQualifiedDay:'invalid'},{...start,lastQualifiedAt:'invalid'}])
  assert.equal(guestNeedsReconciliation({...starter,performances:{9:invalid}},existing),true,'Malformed or mismatched starts are not silently ignored');
 assert.equal(guestNeedsReconciliation({...starter,shards:2},existing),true,'Actual guest spending remains protected');
 assert.equal(guestNeedsReconciliation({...starter,shards:4},existing),true,'Nonstarter guest funds remain protected');
 assert.equal(guestNeedsReconciliation({...starter,solved:{9:1}},existing),true,'A guest victory cannot be treated as a virgin cache');
 assert.equal(guestNeedsReconciliation({...starter,performances:{9:{time:40}}},existing),true,'Guest performance evidence remains protected');
 assert.equal(guestNeedsReconciliation({...starter,daily:{dates:{'2026-10-25':1},rewards:{}}},existing),true,'Actual guest daily evidence remains protected');
 assert.equal(guestNeedsReconciliation({...starter,oldUnknown:'preserve'},existing),true,'Unclassified guest evidence retains conservative coverage');
}
const failed={getItem:k=>k==='lumenProgressV1'?raw:null,setItem:()=>{}};
assert.throws(()=>preserveGuestBeforeHydration(failed,{accountId:'a'}),/non vérifiée/);
assert.equal(failed.getItem('lumenProgressV1'),raw);
console.log('Guest/account ownership, original backup, retry and divergent cloud protection passed');
