import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList,canonicalQuestById} from '../src/campaign/canonical-quests.js';
import {challengeSnapshot,createChallengeClient,challengeAttemptClosed} from '../src/campaign/social-challenge.js';
import {resolveChallengeQuest,challengeQuestLabel} from '../src/campaign/canonical-challenges.js';

// #883 (Lot 0, EPIC #881): the RPC chosen by the client for each challenge kind
// must exist in the migrations with compatible parameters and guest grants.
// The real server execution of the same matrix is fixtures/challenge-rpc-matrix.sql.
const migrations=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()
 .map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8'));
function lastPublicDefinition(name){
 let found=null;
 for(const sql of migrations){
  const re=new RegExp('create (?:or replace )?function public\\.'+name+'\\s*\\(([\\s\\S]*?)\\)\\s*returns[\\s\\S]*?(\\$\\$|\\$)([\\s\\S]*?)\\2','gi');
  for(const m of sql.matchAll(re))found={params:m[1],body:m[3]};
 }
 assert(found,'No public definition for '+name);
 const params=found.params.split(',').map(p=>p.trim()).filter(Boolean).map(p=>({name:p.split(/\s+/)[0],optional:/\bdefault\b/i.test(p)}));
 return {...found,params};
}
function granted(name){
 return migrations.some(sql=>new RegExp('grant execute on function[^;]*public\\.'+name+'\\([^;]*to anon,authenticated','i').test(sql));
}
function recorder(){
 const calls=[];
 const client=createChallengeClient({rpc:async(name,args)=>{calls.push({name,args});return {data:[{challenge_id:'fixture'}],error:null}}},{getAnonymousId:()=>'guest-contract-883',getDisplayName:()=>'Contract'});
 return {calls,client};
}

const quests=canonicalQuestList();
const kinds={
 legacy:quests.find(q=>q.legacyIndex!==null&&!q.gridRevision),
 'legacy-soft-revision':canonicalQuestById('base-q003'),
 'stable-zero':quests.find(q=>q.legacyIndex===null&&!q.gridRevision),
 'stable-revised':quests.find(q=>q.legacyIndex===null&&q.gridRevision>0)
};
const expected={
 // #889: one versioned writer for every kind; start/finish routes unchanged.
 legacy:['lumen_create_qualifying_challenge','lumen_start_social_challenge','lumen_finish_social_challenge'],
 // #887: a numbered quest on a soft revision pins the board its sender played.
 'legacy-soft-revision':['lumen_create_qualifying_challenge','lumen_start_quest_challenge_v2','lumen_finish_quest_challenge_v2'],
 'stable-zero':['lumen_create_qualifying_challenge','lumen_start_social_challenge','lumen_finish_social_challenge'],
 'stable-revised':['lumen_create_qualifying_challenge','lumen_start_quest_challenge_v2','lumen_finish_quest_challenge_v2']
};
const matrix=[];
for(const [kind,quest] of Object.entries(kinds)){
 assert(quest,'fixture quest for '+kind);
 const {calls,client}=recorder();
 const snapshot=challengeSnapshot({quest,seconds:61,run:{autonomy:true,speed:true,mastery:true,qualifying:true},firstPlay:kind!=='stable-zero'});
 await client.create(snapshot);
 // The recipient resolves the server row shape returned by lumen_get_quest_challenge_v2.
 const row={challenge_id:'fixture',puzzle_id:quest.legacyIndex===null?null:quest.legacyIndex+1,stable_quest_id:quest.id,
  grid_revision:calls[0].args.p_grid_revision};
 assert.equal(calls[0].args.p_qualifying,true,kind+': only qualifying runs are declared');
 assert.equal(calls[0].args.p_first_play,kind!=='stable-zero',kind+': provenance is never forced to first play');
 assert.equal(calls[0].args.p_quest_id===null,quest.legacyIndex!==null,kind+': historical numbers keep their numeric identity');
 await client.get('fixture');
 await client.start('fixture',false,row.grid_revision);
 await client.finish('fixture',{status:'completed',durationSeconds:58,gridRevision:row.grid_revision});
 await client.sent();
 assert.deepEqual([calls[0].name,calls[2].name,calls[3].name],expected[kind],kind+': create/start/finish route');
 assert.equal(calls[1].name,'lumen_get_quest_challenge_v2',kind+': canonical read');
 assert.equal(calls[4].name,'lumen_list_quest_challenges_v2',kind+': canonical inbox');
 for(const call of calls){
  const definition=lastPublicDefinition(call.name),names=definition.params.map(p=>p.name);
  for(const arg of Object.keys(call.args))assert(names.includes(arg),kind+': '+call.name+' has no parameter '+arg);
  for(const p of definition.params)if(!p.optional)assert(p.name in call.args,kind+': '+call.name+' requires '+p.name);
  assert(granted(call.name),kind+': '+call.name+' is executable by guests and accounts');
 }
 // Same grid on both sides: what the sender played is what the recipient resolves.
 const resolved=resolveChallengeQuest(row);
 assert.equal(resolved.id,quest.id,kind+': same quest');
 // #887: also for historical numbers (quests 3-7 moved to revision 1).
 assert.deepEqual(resolved.reg,quest.reg,kind+': same revision board');
 assert.deepEqual(resolved.sol,quest.sol,kind+': same solution');
 assert.equal(row.grid_revision,quest.gridRevision??0,kind+': the played revision is pinned');
 assert.equal(challengeQuestLabel(row),'Quête '+quest.ordinal,kind+': inbox shows the visible quest number');
 matrix.push({kind,quest:quest.id,revision:row.grid_revision,rpc:calls.map(c=>c.name)});
}

// Older server without the #889 writer: first wins use the first-play writers,
// a replay is refused instead of being declared as a first play.
{
 const seen=[];const old=createChallengeClient({rpc:async(name,args)=>{seen.push({name,args});return name==='lumen_create_qualifying_challenge'?{status:404,error:{code:'PGRST202'}}:{data:[{challenge_id:'old-server'}],error:null}}},{getAnonymousId:()=>'guest-contract-883',getDisplayName:()=>'Contract'});
 const first=challengeSnapshot({quest:kinds['stable-zero'],seconds:61,run:{qualifying:true},firstPlay:true});
 assert.equal((await old.create(first)).challenge_id,'old-server');
 assert.deepEqual(seen.map(c=>c.name),['lumen_create_qualifying_challenge','lumen_create_quest_challenge']);assert.equal(seen[1].args.p_first_play,true);
 await assert.rejects(()=>old.create({...first,firstPlay:false}),/challenge_replay_unavailable/);
 assert.equal(seen.filter(c=>c.name==='lumen_create_quest_challenge').length,1,'no replay reaches a first-play writer');
}

// gridRevision=0 (#883 hypothesis 4): the public start/finish wrappers only
// refuse revised rows, so a stable revision-0 challenge is accepted.
for(const name of ['lumen_start_social_challenge','lumen_finish_social_challenge']){
 const body=lastPublicDefinition(name).body.replace(/\s+/g,' ');
 assert.match(body,/grid_revision<>0\) then raise exception 'challenge_grid_update_required'/,name+' only rejects revised grids');
 assert.match(body,/from lumen\.lumen_(start|finish)_social_challenge\(/,name+' delegates to the private one-shot implementation');
}
// Historical soft revision (#650): legacy numbers follow the live board (GRID_CATALOG).
assert.deepEqual(resolveChallengeQuest({puzzle_id:3}).reg,canonicalQuestById('base-q003').reg);

// Terminal status contract is lowercase on the server.
for(const status of ['completed','abandoned','COMPLETED'])assert.equal(challengeAttemptClosed(status),true,status);
for(const status of ['started',null,undefined,''])assert.equal(challengeAttemptClosed(status),false,String(status));

// Inbox labels: legacy numbers are not visible ordinals; stable rows have no number.
const renumbered=quests.find(q=>q.legacyIndex!==null&&q.ordinal!==q.legacyIndex+1);
assert.equal(challengeQuestLabel({puzzle_id:renumbered.legacyIndex+1}),'Quête '+renumbered.ordinal);
assert.equal(challengeQuestLabel({puzzle_id:null,stable_quest_id:'unknown-quest'}),'Quête inconnue');
assert.doesNotMatch(challengeQuestLabel({puzzle_id:null,stable_quest_id:kinds['stable-zero'].id}),/null/);

const ui=fs.readFileSync('src/ui/game-screen.js','utf8');
assert.doesNotMatch(ui,/Quête '\+row\.puzzle_id/,'Mes défis never prints the raw legacy number');
assert.match(ui,/challengeAttemptClosed\(socialChallenge\.participant_status\)/,'reopened finished links show their result');
console.log('challenge RPC contract: '+JSON.stringify(matrix));
