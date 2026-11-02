import test from 'node:test';
import assert from 'node:assert/strict';
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
