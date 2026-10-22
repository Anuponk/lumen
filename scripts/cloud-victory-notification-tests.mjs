import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
test('a failed flush with a durable victory cannot open a blocking technical dialog',async()=>{
 let panels=0;const children=[];
 const element=()=>({style:{},setAttribute(){},focus(){},remove(){},append(...nodes){children.push(...nodes)}});
 const ctx={qaActive:false,lumenUser:{id:'synthetic'},lumenSupabase:{},authSessionPending:false,cloudProfileTimer:null,cloudProfileReady:true,cloudProfileFailure:{reason:'network'},
  recordCloudDiagnostic(){},flushCloudProfile:async()=>false,preserveUnsyncedCloudProgress:()=>true,
  syncPresentation:{failed(){},acknowledged(){}},renderSyncStatus(){},clearTimeout,
  document:{createElement:element,body:{append(){panels++;children.find(e=>e.textContent==='Conserver ma progression locale')?.onclick()}}}};
 vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('async function confirmCloudReward('),src.indexOf('\nfunction scheduleCloudProfile(')),ctx);
 assert.equal(await vm.runInContext('confirmCloudReward({durable:true})',ctx),false);
 assert.equal(panels,0,'Recoverable cloud errors must preserve the victory presentation');
});

test('a restored solved board cannot award a guest victory while account restoration is pending',async()=>{
 let rewards=0;
 const ctx={celebrated:false,pendingVictoryView:null,authSessionPending:true,qaActive:false,lumenUser:null,
  socialChallenge:null,canonicalActiveQuest:null,haptic(){},learningReplayActive:()=>false,msg:{textContent:''},
  activeGameSeconds:()=>40,attemptEngine:{snapshot:()=>({})},usedHintThisGame:false,questFailed:false,
  localCalendarDay:()=> '2026-10-22',lumenProgress:{},levelIndex:20,
  applyLegacyVictory(){rewards++;throw Error('Guest reward reached before authentication')}};
 vm.createContext(ctx);
 vm.runInContext(src.slice(src.indexOf('async function celebrateSuccess('),src.indexOf('\nfunction haptic(')),ctx);
 await vm.runInContext('celebrateSuccess()',ctx);
 assert.equal(rewards,0);assert.match(ctx.msg.textContent,/Restauration/);
});
