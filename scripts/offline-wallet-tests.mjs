import test from 'node:test';
import assert from 'node:assert/strict';
import {queueOfflineWalletSpend,walletReservationCost} from '../src/persistence/offline-wallet.js';
import {walletSpendIdentity} from '../src/persistence/wallet-command.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {configureCommandSession,replayWalletCommand} from '../src/persistence/coordinated-command-adapters.js';
const operation=(kind='hint',sequence=1)=>walletSpendIdentity(kind,{attemptId:'attempt'},sequence);
function fixture(){
 const data=new Map(),storage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const fallback={entries:async()=>[],get:async()=>null,put:async()=>{throw Error('IDB unavailable')},remove:async()=>{}};
 const box=()=>createDurableCanonicalVictoryOutbox(storage,{namespace:'Wallet',fallback});
 let tail=Promise.resolve();const locks={request:(_name,_options,fn)=>{const next=tail.then(fn);tail=next.catch(()=>{});return next}};
 return {box,storage,locks};
}
test('durable reservations survive restart, reuse exact identity and never change a confirmed balance',async()=>{
 const f=fixture(),options={userId:'a',balance:3,operation:operation(),locks:f.locks};
 assert.equal((await queueOfflineWalletSpend(f.box(),options)).allowed,true);
 assert.equal((await queueOfflineWalletSpend(f.box(),options)).allowed,true);
 assert.equal((await f.box().pending('a')).length,1);
 assert.equal(walletReservationCost(await f.box().pending('a'),'a'),1);
 assert.equal((await queueOfflineWalletSpend(f.box(),{...options,operation:operation('hint',2)})).allowed,true);
 assert.equal((await queueOfflineWalletSpend(f.box(),{...options,operation:operation('verify',1)})).allowed,false);
 assert.equal(options.balance,3);assert.equal((await f.box().pending('b')).length,0);
});

test('a server refusal retains the offline debit and never changes earned progression',async()=>{
 const f=fixture(),box=f.box(),op=operation();
 await queueOfflineWalletSpend(box,{userId:'a',balance:3,operation:op,locks:f.locks});
 const entry=(await box.pending('a'))[0];
 const profile={solved:{0:1},badges:{mastery:1},shards:0,walletRevision:5},original=JSON.stringify(profile);
 const client={rpc:async name=>name==='lumen_commit_wallet_command'?{error:{code:'P0001'}}:{data:null}};
 configureCommandSession(()=>({userId:'a',client,generation:1}));
 let refusal;try{await replayWalletCommand(client,'a',entry)}catch(error){refusal=error}
 assert.equal(refusal.code,'P0001');await box.pause('a',entry,refusal);
 assert.equal(JSON.stringify(profile),original);assert.deepEqual((await box.pending('a'))[0],entry);
 assert.equal((await box.inspect('a')).paused[0].kind,'review');
 await assert.rejects(queueOfflineWalletSpend(box,{userId:'a',balance:80,operation:operation('hint',2),locks:f.locks}),/requires review/);
});
test('two concurrent tabs cannot reserve beyond the confirmed device balance',async()=>{
 const f=fixture(),common={userId:'a',balance:1,locks:f.locks};
 const results=await Promise.all([queueOfflineWalletSpend(f.box(),{...common,operation:operation()}),queueOfflineWalletSpend(f.box(),{...common,operation:operation('verify')})]);
 assert.equal(results.filter(r=>r.allowed).length,1);
});
test('storage refusal, unreadable inventory, missing lock and account changes never grant an aid',async()=>{
 const f=fixture(),base={userId:'a',balance:3,operation:operation(),locks:f.locks};
 f.storage.setItem=()=>{throw Error('quota')};
 await assert.rejects(queueOfflineWalletSpend(f.box(),base));
 await assert.rejects(queueOfflineWalletSpend(f.box(),{...base,locks:null}));
 await assert.rejects(queueOfflineWalletSpend(f.box(),{...base,sessionValid:()=>false}));
 await assert.rejects(queueOfflineWalletSpend({domain:'Wallet',inspect:async()=>({complete:false,issues:[],pending:[]})},base));
});
