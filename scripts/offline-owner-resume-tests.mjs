import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {rememberVerifiedOfflineOwner,clearVerifiedOfflineOwner,isVerifiedOfflineOwner} from '../src/persistence/offline-verified-owner.js';
function storage(){const m=new Map();return {setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)??null,removeItem:k=>m.delete(k)}}
test('verified owner resumes offline only for the matching account and bounded age',()=>{
 const s=storage();rememberVerifiedOfflineOwner(s,'alice',100000);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:true,now:100001}),true);
 assert.equal(isVerifiedOfflineOwner(s,'bob',{offline:true,now:100001}),false);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:false,now:100001}),false);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:true,now:100000+31*86400000}),false);
 clearVerifiedOfflineOwner(s);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:true,now:100001}),false);
});

test('live access context persists hydration proof and restores it after page restart',async()=>{
 const source=fs.readFileSync('src/ui/game-screen.js','utf8');
 const s=storage();
 // Resolve the UI's actual imports so a missing runtime binding fails here.
 const bindings={};
 for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]*offline-verified-owner\.js)['"]/g)){
  const module=await import(new URL(match[2],new URL('../src/ui/game-screen.js',import.meta.url)));
  for(const name of match[1].split(',').map(n=>n.trim()))bindings[name]=module[name];
 }
 const context={...bindings,localStorage:s,navigator:{onLine:true},lumenUser:{id:'alice'},cloudProfileReady:true,verifiedOfflineOwnerId:'alice'};
 vm.createContext(context);vm.runInContext(functionSource(source,'offlineQuestAccessContext'),context);
 assert.equal(context.offlineQuestAccessContext().verifiedSession,true);
 context.verifiedOfflineOwnerId=null;context.cloudProfileReady=false;context.navigator.onLine=false;
 assert.equal(context.offlineQuestAccessContext().verifiedSession,true,'Durable proof survives fresh in-memory state');
 context.lumenUser={id:'bob'};
 assert.equal(context.offlineQuestAccessContext().verifiedSession,false,'Account switch cannot inherit proof');
});

