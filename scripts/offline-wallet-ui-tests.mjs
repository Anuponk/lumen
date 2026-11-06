import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {queueOfflineWalletSpend} from '../src/persistence/offline-wallet.js';
import {walletSpendIdentity,walletCommandsSupported} from '../src/persistence/wallet-command.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
const source=fs.readFileSync('src/ui/game-screen.js','utf8');
function fixture(error=new TypeError('Failed to fetch')){
 const data=new Map(),storage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const box=createDurableCanonicalVictoryOutbox(storage,{namespace:'Wallet',fallback:{entries:async()=>[],put:async()=>{throw Error('no IDB')},remove:async()=>{}}});
 const client={rpc:async()=>{throw error}},attempt={attemptId:'active-run',resetCount:0};
 const c={navigator:{onLine:true,locks:{request:async(_key,_options,fn)=>fn()}},localStorage:storage,
  hintCost:()=>1,verifyCost:()=>1,lumenUser:{id:'player'},lumenSupabase:client,qaActive:false,unlimitedShardsEnabled:()=>false,
  walletSpendInFlight:false,legacyCommandInFlight:false,legacyVictoryBusy:false,canonicalOutboxRetryInFlight:false,cloudProfileFailure:null,
  attemptEngine:{snapshot:()=>attempt},hintUsesThisGame:1,verifyUsesThisGame:1,authSessionPending:false,cloudProfileReady:true,
  offlineQuestAccessContext:()=>({verifiedSession:true}),verifiedOfflineWallet:()=>80,walletOutbox:box,walletPaidPermit:null,
  pendingWalletReservations:[],walletSpendIdentity,walletCommandsSupported,queueOfflineWalletSpend:(box,options)=>queueOfflineWalletSpend(box,{...options,locks:c.navigator.locks}),
  msg:{},recordCloudDiagnostic(){},refreshCanonicalOutboxNotice:async()=>{},lumenProgress:{shards:80},cloudHydrationGeneration:1};
 vm.createContext(c);vm.runInContext(functionSource(source,'authorizeWalletSpend'),c);return {c,box,attempt};
}
test('verified 80-shard account can purchase when transport is down but navigator still says online',async()=>{
 const {c,box}=fixture();assert.equal(await c.authorizeWalletSpend('hint'),true);
 assert.equal(c.walletPaidPermit,'hint');assert.equal((await box.pending('player')).length,1);assert.equal(c.lumenProgress.shards,80);
});
test('Auth, business refusals and unverified offline balance never grant a paid hint',async()=>{
 for(const error of [Object.assign(Error('auth'),{code:'PGRST301'}),Object.assign(Error('balance'),{code:'P0001'}),Object.assign(Error('permission'),{code:'42501'})]){
  const {c,box}=fixture(error);assert.equal(await c.authorizeWalletSpend('hint'),false);assert.equal((await box.pending('player')).length,0);
 }
 const {c}=fixture();c.verifiedOfflineWallet=()=>null;assert.equal(await c.authorizeWalletSpend('hint'),false);
});
