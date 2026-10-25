import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_CONSTELLATIONS,CONTENT_PACKS} from '../src/campaign/content.js';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
export async function verifyCelestialUX({send,evaluate},url){
 const all=canonicalQuestList(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
 const until=async expr=>{for(let i=0;i<100;i++){if(await evaluate(expr))return;await sleep(80)}throw Error('Celestial timeout: '+expr)};
 const completed=(quests,badgeCount=0)=>{const badges=Object.fromEntries(['autonomy','speed','noError','mastery'].slice(0,badgeCount).map(k=>[k,true]));return {solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),performances:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,{version:3,badges:{...badges}}])),canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{...badges}}])),shards:7,xp:123,badges:{historical:1},autoCrossUnlockSeen:1,fullBadgeIntroSeen:1}};
 async function seed(progress){await evaluate(`localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.removeItem('lumenQaActiveAttemptV1');localStorage.removeItem('lumenActiveAttemptV1');localStorage.setItem('lumenSound','off')`);await navigateAndWait({send,evaluate},'Page.reload',{ignoreCache:true});await acknowledgeLearningMilestones(evaluate)}
 async function open(entry){await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${entry.packId}"]').click();(()=>{let n=0;while(!document.querySelector('#sectorTabs [data-content-id="${entry.id}"]')&&n++<100)document.getElementById('constellationNext').click()})();document.querySelector('#sectorTabs [data-content-id="${entry.id}"]').click()`)}
 async function play(q,{failVisual=false}={}){const entry=CONTENT_CONSTELLATIONS.find(c=>c.id===q.constellationId);await open(entry);await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]').click()`);await acknowledgeLearningMilestones(evaluate);if(failVisual)await evaluate(`(()=>{const original=document.createElement.bind(document);document.createElement=(tag,...args)=>{if(tag==='p'&&new Error().stack.includes('celestial-celebration.js'))throw Error('Synthetic decorative failure');return original(tag,...args)}})()`);await evaluate(`document.getElementById('attemptMask').click();(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);await until('!document.getElementById("skyReveal").hidden')}
 async function realClick(id,mobile){const p=await evaluate(`(()=>{const e=document.getElementById('${id}'),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);return {x,y,hit:h===e||e.contains(h),bottom:r.bottom,top:r.top}})()`);assert(p.hit&&p.top>=0&&p.bottom<=await evaluate('innerHeight'),id+' reachable: '+JSON.stringify(p));if(mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}else {await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:p.x,y:p.y});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:p.x,y:p.y})}}
 const firstEntry=CONTENT_CONSTELLATIONS[0],members=all.filter(q=>q.constellationId===firstEntry.id),last=members.at(-1),pack=CONTENT_PACKS.find(p=>p.id===last.packId),packQuests=all.filter(q=>q.packId===pack.id),packLast=packQuests.at(-1);
 const qaUrl=new URL(url);qaUrl.searchParams.set('qa','new');
 await navigateAndWait({send,evaluate},'Page.navigate',{url:String(qaUrl)});
 for(const viewport of [{width:320,height:568,mobile:true},{width:360,height:640,mobile:true},{width:390,height:844,mobile:true},{width:844,height:390,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});await send('Emulation.setTouchEmulationEnabled',{enabled:viewport.mobile,maxTouchPoints:1});
  await seed(completed(members.slice(0,-1)));await play(last);
  assert.equal(await evaluate('document.getElementById("skyReveal").dataset.celestial'),'constellation');
  assert.match(await evaluate('document.getElementById("skyRevealTitle").textContent'),/brille à nouveau/);
  assert.equal(await evaluate('document.getElementById("skyRevealNext").textContent'),'Constellation suivante','An accessible following legacy quest uses the same access/navigation as its map card');
  assert.equal(await evaluate('document.getElementById("endgameOverlay").hidden&&document.getElementById("adventureNotice").hidden'),true);
  const won=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
  assert.equal(await evaluate('getComputedStyle(document.getElementById("skyRevealTitle")).animationName'),'celestial-conclusion');
  await realClick('celestialSkip',viewport.mobile);assert.equal(await evaluate('document.getElementById("skyReveal").classList.contains("celestial-still")'),true);
  assert.equal(await evaluate('getComputedStyle(document.getElementById("skyRevealTitle")).opacity'),'1','Skip reveals the final narrative immediately');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await evaluate('!!document.activeElement.closest("#skyReveal")'),true,'keyboard stays in the scene');
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`docs/validation/celestial-constellation-${viewport.width}.png`,Buffer.from(shot.data,'base64'));
  await realClick('skyRevealNext',viewport.mobile);assert.equal(await evaluate('document.getElementById("skyReveal").hidden'),true);
  const next=all.find(q=>q.ordinal===last.ordinal+1);assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),next.reg,'The real next constellation board loads');
  assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),won,'Next cannot grant another reward');
  await navigateAndWait({send,evaluate},'Page.reload',{ignoreCache:true});assert.equal(await evaluate('document.getElementById("skyReveal").hidden'),true);
  await seed(completed(packQuests.slice(0,-1)));await play(packLast);
  assert.equal(await evaluate('document.getElementById("skyReveal").dataset.celestial'),'adventure');
  assert.equal(await evaluate('document.querySelectorAll(".celestial-figure").length'),new Set(packQuests.map(q=>q.constellationId)).size);
  assert.match(await evaluate('document.getElementById("skyRevealNext").textContent'),/Admirer mon ciel/,'No promise to open locked next Adventure');
  assert.equal(await evaluate('document.querySelector(".celestial-panorama").getAnimations({subtree:true}).some(a=>a.effect.getTiming().iterations===Infinity)'),false,'No permanent cinematic animation');
  await realClick('celestialSkip',viewport.mobile);
  const adventureShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`docs/validation/celestial-adventure-${viewport.width}.png`,Buffer.from(adventureShot.data,'base64'));
  await realClick('skyRevealNext',viewport.mobile);assert.equal(await evaluate('document.getElementById("adventureNotice").hidden'),true,'No second popup after adventure');
  results.push({viewport,constellation:true,adventure:true,singleScene:true,skip:true,keyboard:true,refreshSilent:true,noRewardOnNavigation:true,lockedNext:true});
 }
 // Compare actual Mon ciel SVGs using the same acquired records as gameplay.
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 const figures=CONTENT_CONSTELLATIONS.map(c=>({entry:c,figure:verifiedAstronomicalFigure(c),total:all.filter(q=>q.constellationId===c.id).length})).filter(x=>x.figure);
 const choices=[figures.toSorted((a,b)=>a.figure.pts.length-b.figure.pts.length)[0],figures.toSorted((a,b)=>b.figure.pts.length-a.figure.pts.length)[0],figures.find(x=>x.total>x.figure.pts.length)];
 const previews=[];
 for(const [type,choice] of ['small','large','additional'].map((type,i)=>[type,choices[i]])){
  assert(choice,'Preview catalogue case '+type);const entry=choice.entry;
  for(const count of [0,1,2,3,4]){
   await seed(completed(all,count));await open(entry);
   const observed=await evaluate(`(()=>{const svg=document.querySelector('#skyCard svg');return {html:svg.innerHTML,ratio:svg.querySelector('.milky-way')?.dataset.ratio??'0',primary:svg.querySelectorAll('.sky-star').length,secondary:svg.querySelectorAll('.quest-secondary-star').length,pulses:document.querySelectorAll('.mastery-pulse').length}})()`);
   assert.equal(Number(observed.ratio),count/4);assert.equal(observed.primary,choice.figure.pts.length);assert.equal(observed.pulses,0,'Restored mastery is static');if(type==='additional')assert(observed.secondary>0);
   const before=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');await evaluate('document.getElementById("closeMap").click()');await open(entry);
   assert.equal(await evaluate('document.querySelector("#skyCard svg").innerHTML'),observed.html,'Deterministic reopen');assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),before);
   const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`docs/validation/milky-way-${type}-${count*25}.png`,Buffer.from(shot.data,'base64'));
   previews.push({type,id:entry.id,ratio:count/4,primary:observed.primary,secondary:observed.secondary});
  }
 }
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await seed(completed(members.slice(0,-1)));await play(last);
 assert.equal(await evaluate('document.getElementById("skyReveal").classList.contains("celestial-still")'),true);
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".celestial-figure .sky-line")).animationName'),'none');
 await send('Emulation.setEmulatedMedia',{features:[]});
 const followingPack=CONTENT_PACKS[CONTENT_PACKS.findIndex(p=>p.id===pack.id)+1],followingQuest=all.find(q=>q.packId===followingPack.id);
 await seed({...completed(packQuests.slice(0,-1)),legacyAdventureAccess:[followingPack.id]});await play(packLast);
 assert.equal(await evaluate('document.getElementById("skyRevealNext").textContent'),'Découvrir l’aventure suivante');
 await realClick('skyRevealNext',true);assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),followingQuest.reg,'An actually acquired next Adventure uses its own real board');
 // Real replay improves the one missing badge; it must not repeat completion.
 await evaluate(`localStorage.setItem('lumenQalumenOnboardingV1:guest',JSON.stringify({auto:false,tips:[]}))`);
 const nearly=completed(members,4);delete nearly.canonicalQuestState[last.id].badges.mastery;
 await seed(nearly);await play(last);
 assert.equal(await evaluate('document.getElementById("skyReveal").dataset.celestial??null'),null,'Replay improves mastery without another completion scene');
 await evaluate('document.getElementById("skyRevealSky").click()');
 assert(await evaluate('document.querySelectorAll(".mastery-arrival").length')>0,'A genuine acquired 100% badge crossing has a short revelation');
 await sleep(1750);await evaluate('document.getElementById("closeMap").click()');await open(firstEntry);
 assert.equal(await evaluate('document.querySelectorAll(".mastery-arrival").length'),0,'Reopening after the pulse cannot restart it');
 await seed(completed(members.slice(0,-1)));await play(last,{failVisual:true});
 assert.equal(await evaluate('document.getElementById("skyReveal").dataset.celestial??null'),null,'Decoration failure returns to ordinary controls');
 assert.equal(await evaluate(`!!lumenDiagnostics.snapshot().progress.canonicalQuestState['${last.id}'].solved`),true,'Victory persists independently from animation');
 assert.equal(await evaluate('document.getElementById("skyRevealNext").hidden'),false);
 return {results,previews,reducedMotion:true,replayMasteryOnce:true,accessibleNextAdventure:true,visualFailurePreservesVictory:true};
}
