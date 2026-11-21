// #908 · Abandon closes a qualifying run; the 15-minute window runs from its start.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAttemptEngine,ATTEMPT_STATES} from '../src/game/attempt-engine.js';
import {BADGE_COOLDOWN_MS,badgeCooldownRemaining} from '../src/campaign/performance.js';
import {QUALIFYING_STARTS_KEY,qualifyingStartedAt,recordQualifyingStart,withQualifyingStart,cooldownMinutes,abandonConfirmModel} from '../src/campaign/qualification-window.js';
import {createTranslator} from '../src/ui/i18n.js';

const fr=createTranslator({locale:'fr'}).t,en=createTranslator({locale:'en'}).t;
function memory(){const data=new Map();return {data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}}
const T0=Date.parse('2026-11-21T10:00:00.000Z'),MIN=60000;
const quest='planned-real-01-q07';

// A qualifying start blocks the next qualification for 15 minutes from that start.
{
 const storage=memory();
 assert.equal(qualifyingStartedAt(storage,'u1',quest),null,'nothing consumed before the first move');
 assert.equal(badgeCooldownRemaining(withQualifyingStart({},null),T0),0,'no record, no window');
 assert.equal(recordQualifyingStart(storage,'u1',quest,T0,T0),true);
 const record=withQualifyingStart({},qualifyingStartedAt(storage,'u1',quest));
 assert.equal(badgeCooldownRemaining(record,T0+MIN),14*MIN,'T+1 min: still 14 min, the abandon does not reset the window');
 assert.equal(cooldownMinutes(badgeCooldownRemaining(record,T0+MIN)),14);
 assert.equal(badgeCooldownRemaining(record,T0+BADGE_COOLDOWN_MS),0,'T+15 min: a new qualifying run is possible');
 assert.equal(badgeCooldownRemaining(record,T0+16*MIN),0);
}
// The latest of victory and start wins; an older start never shortens a window.
{
 const victory=new Date(T0+5*MIN).toISOString();
 assert.equal(withQualifyingStart({lastQualifiedAt:victory},new Date(T0).toISOString()).lastQualifiedAt,victory);
 assert.equal(withQualifyingStart({lastQualifiedAt:new Date(T0).toISOString()},new Date(T0+5*MIN).toISOString()).lastQualifiedAt,new Date(T0+5*MIN).toISOString());
 const storage=memory();recordQualifyingStart(storage,'u1',quest,T0+5*MIN,T0+5*MIN);recordQualifyingStart(storage,'u1',quest,T0,T0+5*MIN);
 assert.equal(qualifyingStartedAt(storage,'u1',quest),new Date(T0+5*MIN).toISOString(),'a late replayed start cannot move the window back');
}
// Per player, pruned, corruption-tolerant, never throwing.
{
 const storage=memory();
 recordQualifyingStart(storage,'u1',quest,T0,T0);
 assert.equal(qualifyingStartedAt(storage,'u2',quest),null,'another account on the same device is not blocked');
 assert.equal(qualifyingStartedAt(storage,null,quest),null,'a guest is distinct from an account');
 recordQualifyingStart(storage,'u1','other-quest',T0+20*MIN,T0+20*MIN);
 assert.equal(qualifyingStartedAt(storage,'u1',quest),null,'expired entries are pruned on the next write');
 storage.setItem(QUALIFYING_STARTS_KEY,'{broken');
 assert.equal(qualifyingStartedAt(storage,'u1',quest),null);
 assert.equal(recordQualifyingStart(storage,'u1',quest,T0,T0),true,'a corrupt store is replaced, not fatal');
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
 assert.equal(recordQualifyingStart(denied,'u1',quest,T0,T0),false,'storage failure is reported, the game continues');
 storage.setItem(QUALIFYING_STARTS_KEY,JSON.stringify({u1:{[quest]:'not a date'}}));
 assert.equal(qualifyingStartedAt(storage,'u1',quest),null,'a malformed timestamp is ignored');
}
// Reload: the window lives in storage, not in memory.
{
 const storage=memory();recordQualifyingStart(storage,'u1',quest,T0,T0);
 const reloaded={getItem:k=>storage.getItem(k)};
 assert.equal(qualifyingStartedAt(reloaded,'u1',quest),new Date(T0).toISOString());
}

// Attempt engine: abandon is terminal; cancel leaves the attempt untouched; the
// server ranking window can demote a live run, never promote one.
{
 const storage=memory();let wall=T0,mono=0;
 const engine=createAttemptEngine({storage,now:()=>wall,perfNow:()=>mono});
 const ready=engine.create({questId:quest,mode:'replay',qualifying:true,board:[[0]]});
 assert.equal(ready.state,ATTEMPT_STATES.READY);
 const started=engine.start();wall+=MIN;mono+=MIN;
 const before=JSON.stringify(engine.snapshot());
 // « Continuer la partie »: nothing is called on the engine.
 assert.equal(JSON.stringify(engine.snapshot()),before,'a cancelled confirmation changes nothing');
 const abandoned=engine.abandon();
 assert.equal(abandoned.state,ATTEMPT_STATES.ABANDONED);
 assert.equal(JSON.parse(storage.getItem(engine.storageKey)).state,'ABANDONED','ABANDONED is persisted before the slot is cleared');
 assert.equal(engine.disqualify(started.attemptId).qualifying,true,'a closed run is never rewritten');
 engine.clear();
 assert.equal(storage.getItem(engine.storageKey),null,'no resumable abandoned attempt');
 assert.equal(createAttemptEngine({storage}).restore({questId:quest}),null,'reload cannot resume it');
}
{
 const storage=memory(),engine=createAttemptEngine({storage});
 const a=engine.create({questId:quest,mode:'campaign',qualifying:true,board:[[0]]});engine.start();
 assert.equal(engine.disqualify('other-run').qualifying,true,'only the run the server answered for');
 assert.equal(engine.disqualify(a.attemptId).qualifying,false,'server window on another device demotes the live run');
 assert.equal(JSON.parse(storage.getItem(engine.storageKey)).qualifying,false,'the demotion is persisted (reload keeps it)');
 assert.equal(engine.requalify(true).qualifying,false,'a started run is never promoted back');
 const c=createAttemptEngine({storage:memory()});c.create({questId:quest,mode:'challenge',qualifying:true,board:[[0]]});c.start();
 assert.equal(c.disqualify().qualifying,true,'challenges keep their own one-shot rules');
}

// Confirmation copy, FR and EN, per mode.
{
 const m=abandonConfirmModel({mode:'campaign',qualifying:true,startedAt:T0,now:T0+MIN},fr);
 assert.equal(m.title,'Abandonner cette tentative ?');
 assert.match(m.copy,/Mon Ciel/);assert.match(m.copy,/14 min/);
 assert.equal(m.confirm,'Abandonner et revenir au ciel');assert.equal(m.cancel,'Continuer la partie');assert.equal(m.sky,true);
 const e=abandonConfirmModel({mode:'replay',qualifying:true,startedAt:T0,now:T0+MIN},en);
 assert.equal(e.title,'Abandon this attempt?');assert.match(e.copy,/My Sky/);assert.match(e.copy,/14 min/);
 assert.equal(e.confirm,'Abandon and return to the sky');assert.equal(e.cancel,'Keep playing');
 const late=abandonConfirmModel({mode:'campaign',qualifying:true,startedAt:T0,now:T0+20*MIN},fr);
 assert.equal(late.minutes,0);assert.doesNotMatch(late.copy,/min/,'a run older than 15 min frees the next attempt');
 const outside=abandonConfirmModel({mode:'replay',qualifying:false,startedAt:T0+10*MIN,cooldownMs:3*MIN,now:T0+12*MIN},fr);
 assert.match(outside.copy,/3 min/,'a non-qualifying replay shows the remaining window of the earlier qualifying start');
 const challenge=abandonConfirmModel({mode:'challenge'},fr);
 assert.equal(challenge.sky,false);assert.match(challenge.copy,/seconde tentative officielle/);
 const daily=abandonConfirmModel({mode:'challenge',daily:true},en);
 assert.equal(daily.sky,false);assert.match(daily.copy,/Daily Challenge/);
 for(const t of [fr,en])for(const key of ['board.abandonContinue','board.abandonConfirmSky','board.abandonCooldownCopy','board.abandonFreeCopy'])assert.notEqual(t(key),key,key+' is translated');
}

// Wiring contract in the game screen.
{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 assert.match(source,/if\(started\?\.qualifying&&!socialChallenge\)recordQualifyingStart\(/,'the window starts at the first move of a qualifying run');
 assert.match(source,/result\?\.eligible===false\)demoteForServerWindow\(started\.attemptId\)/,'the server ranking window demotes the run');
 assert.match(source,/questCooldownRemaining\(activeQuest\(\)\)===0\}/,'qualification reads the merged window');
 assert.doesNotMatch(source,/badgeCooldownRemaining\(questPerformanceRecord\(/,'no cooldown reader bypasses qualifying starts');
 assert.doesNotMatch(source,/attemptMode\(\)==="campaign"\|\|!\[ATTEMPT_STATES/,'Abandonner is available in campaign');
 assert.match(source,/attemptEngine\.clear\(\);init\(\);\r?\n openJourneyMap\(false,\{constellationId:/,'campaign/replay abandon returns to Mon Ciel on its constellation');
 assert.ok(source.includes('if(socialChallenge){trackAttemptEvent("challenge_abandoned",{reason:"explicit"});await finishSocialChallenge("abandoned");return}'),'challenges and the Défi du jour keep their recorded abandon');
 assert.doesNotMatch(source,/confirm\(t\("board\.abandonConfirm"\)\)/,'the native confirm is replaced by the explicit dialog');
}
console.log('abandon-attempt-908-tests: window from start, T+1/T+15, reload, owners, demotion, cancel, FR/EN copy OK');
