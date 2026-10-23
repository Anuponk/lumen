import assert from 'node:assert/strict';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';

// Real victory DOM and click handlers, synthetic QA campaign and RPC transport.
export async function verifyVictoryChallenge({send,evaluate},url){
 const results=[];
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
 for(const width of [390,1440])for(const mode of ['mastery','assisted','replay-without-performance','adventure-final','stable']){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,mobile:width<700,deviceScaleFactor:1});
  const packQuests=canonicalQuestList().filter(q=>q.packId===CONTENT_PACKS[0].id);
  const questIndex=mode==='adventure-final'?packQuests.filter(q=>q.legacyIndex!==null).at(-1).legacyIndex:38;
  const progress={solved:Object.fromEntries(Array.from({length:questIndex+(mode.startsWith('replay')?1:0)},(_,i)=>[i,1])),performances:{},xp:123,shards:7,badges:{}};
  if(mode==='adventure-final'){
   progress.solved=Object.fromEntries(packQuests.filter(q=>q.legacyIndex!==null&&q.legacyIndex!==questIndex).map(q=>[q.legacyIndex,1]));
   progress.canonicalQuestState=Object.fromEntries(packQuests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}]));
  }
  const stable=mode==='stable'?canonicalQuestList().find(q=>q.legacyIndex===null):null;
  if(stable){progress.solved=Object.fromEntries(canonicalQuestList().filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));progress.canonicalQuestState={}}
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
   localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});
   localStorage.removeItem('lumenQaActiveAttemptV1');localStorage.removeItem('lumenActiveAttemptV1');
   localStorage.setItem('lumenGuestName','Fixture');localStorage.setItem('lumenPushChoice','off');
   for(const k of ['lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');
   window.__challengeCalls=[];
   window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){}},rpc:async(name,args)=>{
    if(name==='lumen_create_social_challenge'||name==='lumen_create_quest_challenge'){window.__challengeCalls.push(args);await new Promise(r=>setTimeout(r,150));return {data:[{challenge_id:'00000000-0000-4000-8000-000000000511'}],error:null}}
    return {data:[],error:null};
   }})};`});
  await navigateAndWait({send,evaluate},'Page.navigate',{url:String(url)});await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  if(stable){await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${stable.packId}"]').click()`);await evaluate(`document.querySelector('#sectorTabs [data-content-id="${stable.constellationId}"]').click()`);await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${stable.id}"]').click()`)}else await evaluate(`lumenDiagnostics.setupQuest(${questIndex})`);await acknowledgeLearningMilestones(evaluate);
  await evaluate(`document.getElementById('attemptMask').click()`);
  if(mode==='assisted')await evaluate(`document.getElementById('hint').click()`);
  await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
  for(let i=0;i<100;i++){if(await evaluate(`!document.getElementById('skyReveal').hidden`))break;await new Promise(r=>setTimeout(r,100));}
  const button=await evaluate(`(()=>{const b=document.getElementById('skyRevealShare'),r=b.getBoundingClientRect();return {hidden:b.hidden,disabled:b.disabled,remarkable:b.classList.contains('remarkable'),inside:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}})()`);
  if(mode.startsWith('replay')){
   assert(button.hidden,'An already solved quest with missing metadata cannot create a first-play challenge');
   assert.match(await evaluate(`document.getElementById('skyRevealChallengeReason').textContent`),/sans rejeu/);
  }else{
   assert(!button.hidden&&!button.disabled&&button.inside,'Eligible victory has a reachable action: '+JSON.stringify(button));
   assert.equal(button.remarkable,mode!=='assisted','Mastery changes emphasis, not availability');
   const saved=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
   // Dispatch actual pointer clicks twice while the simulated RPC is pending.
   const point=await evaluate(`(()=>{const r=document.getElementById('skyRevealShare').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
   for(let i=0;i<2;i++){await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});}
   for(let i=0;i<100;i++){if(await evaluate(`!document.getElementById('challengeShareModal').hidden`))break;await new Promise(r=>setTimeout(r,50));}
   assert.equal(await evaluate(`document.getElementById('challengeShareModal').hidden`),false,'Click opens the challenge share flow');
   const calls=await evaluate('window.__challengeCalls');assert.equal(calls.length,1,'One RPC despite repeated activation');assert.equal(stable?calls[0].p_quest_id:calls[0].p_puzzle_id,stable?stable.id:questIndex+1,'Stable historical identity, never the renumbered ordinal');
   assert.equal(calls[0].p_mastery,mode!=='assisted');assert.equal(calls[0].p_first_play,true);
   await evaluate(`document.getElementById('challengeShareModal').hidden=true;document.getElementById('successShare').click()`);
   await new Promise(r=>setTimeout(r,100));
   assert.equal(await evaluate('window.__challengeCalls.length'),1,'Reopening shares the same challenge');
   assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),saved,'Challenge creation preserves confirmed victory and all rewards');
   if(mode==='adventure-final'){
    await evaluate(`document.getElementById('challengeShareClose').click();document.getElementById('skyRevealNext').click()`);
    assert.equal(await evaluate(`document.getElementById('adventureNotice').hidden`),false,'Sharing does not consume the pending Adventure celebration');
    assert.match(await evaluate(`document.getElementById('adventureNoticeTitle').textContent`),/Aventure terminée/);
   }
  }
  results.push({width,mode,button,simulatedRpc:true});
 }
 return results;
}
