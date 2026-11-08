// Source-owned seed and disposable PostgreSQL parity input. Never connects.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {canonicalQuestList,canonicalQuestListForRevision} from '../src/campaign/canonical-quests.js';
import {questRewardDefinition} from '../src/campaign/quest-rewards.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
const migration=process.argv[process.argv.indexOf('--write-seed')+1];
const revisionIndex=process.argv.indexOf('--grid-revision');
const quests=revisionIndex<0?canonicalQuestList():canonicalQuestListForRevision(Number(process.argv[revisionIndex+1])),quote=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const rules=quests.map(q=>({questId:q.id,ordinal:q.ordinal,legacyIndex:q.legacyIndex,...questRewardDefinition(q)}));
const seed=rules.map(q=>`insert into lumen_commands.quest_rules values ('${q.questId.replaceAll("'","''")}',${q.legacyIndex??'null'},${quote(q)});`+
 (q.legacyIndex===null?`\ninsert into lumen.canonical_quest_allowlist values ('${q.questId.replaceAll("'","''")}') on conflict do nothing;`:'')).join('\n');
const start='-- BEGIN QUEST RULES',end='-- END QUEST RULES';
if(process.argv.includes('--write-seed')){
 assert.match(migration||'',/^supabase\/migrations\/\d+_[a-z0-9_]+\.sql$/,'Pass the new CLI-generated migration path');
 const source=fs.readFileSync(migration,'utf8');assert(source.includes(start)&&source.includes(end));
 const prior=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&'supabase/migrations/'+f!==migration).map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8')).join('\n');
 const existing=new Set([...prior.matchAll(/insert into lumen_commands\.quest_rules values \('([^']+)'/g)].map(m=>m[1]));
 const missing=rules.filter(q=>!existing.has(q.questId));
 const additions=missing.map(q=>`insert into lumen_commands.quest_rules values ('${q.questId.replaceAll("'","''")}',${q.legacyIndex??'null'},${quote(q)});`+(q.legacyIndex===null?`\ninsert into lumen.canonical_quest_allowlist values ('${q.questId.replaceAll("'","''")}') on conflict do nothing;`:'')).join('\n');
 fs.writeFileSync(migration,source.slice(0,source.indexOf(start)+start.length)+'\n'+additions+'\n'+source.slice(source.indexOf(end)));
 console.log(`Seeded ${missing.length} new quest contracts; prior migrations unchanged`);
}else if(process.argv.includes('--check')){
 const accumulated=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort().map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8').replace(/\r\n/g,'\n')).filter(s=>s.includes(start)).map(s=>s.slice(s.indexOf(start)+start.length,s.indexOf(end)).trim()).join('\n');
 assert.equal(accumulated,seed,'Cumulative append-only server rules must exactly match the published catalogue');
 console.log(`${rules.length} server quest contracts match source`);
}else{
 const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-22',qualifiedAt:'2026-10-22T10:00:00.000Z'};
 const base=()=>({catalogueOrigin:currentCatalogueOrigin,xp:42,shards:7,autonomousWins:2,solved:{},performances:{},badges:{},stars:{},challenges:{},canonicalQuestState:{},skyScore:0,skyHistoryVersion:4,future:{keep:true}});
 let n=0,sql='-- Disposable only. All identities below are synthetic.\n';
 const prefixIndex=process.argv.indexOf('--fixture-prefix'),prefix=prefixIndex<0?'52200000':process.argv[prefixIndex+1];
 assert.match(prefix,/^[0-9a-f]{8}$/);
 function scenario(q,p,f,label){
  const before=structuredClone(p),out=applyQuestVictory(p,q,f),uid=`${prefix}-0000-0000-0000-${String(++n).padStart(12,'0')}`,operation=q.gridRevision>1?'gv'+q.gridRevision+'.fixture':'fixture';
  const entry=before.canonicalQuestState[q.id];
  const trustedSeed=q.gridRevision>1&&entry?.solved?`insert into lumen_commands.quest_run_authority(user_id,quest_id,projection) values('${uid}','${q.id}',${quote(entry)});`:'';
  sql+=`do $case$ declare result jsonb;latest jsonb;begin
insert into auth.users values ('${uid}');${trustedSeed}insert into lumen.profile_snapshots(user_id,payload) values ('${uid}',${quote(before)});
perform set_config('request.jwt.claim.sub','${uid}',true);
result:=public.lumen_commit_quest_command('${operation}','${uid}','${q.id}',${quote(f)});
latest:=result->'profile';
assert (latest-'legacyVictoryRevision'-'walletRevision'-'daily')=${quote(p)},'quest profile parity ${label} ${q.id}: '||latest::text;
assert result->'outcome'=${quote(out)},'quest outcome parity ${label} ${q.id}: '||(result->'outcome')::text;
assert public.lumen_commit_quest_command('${operation}','${uid}','${q.id}',${quote(f)})=result,'same operation is idempotent';
end $case$;\n`;
 }
 for(const q of quests.filter(q=>q.legacyIndex===null&&(!process.argv.includes('--changed-only')||q.gridRevision>1))){
  scenario(q,base(),facts,'first');
  const p=base();p.canonicalQuestState[q.id]={solved:true,...(q.gridRevision>1?{gridRevision:q.gridRevision}:{}),stars:1,badges:{mastery:true},performance:{seconds:80,bestTime:80},future:{keep:true}};
  scenario(q,p,{...facts,seconds:20,assistanceUsed:true,hintUsed:false,qualifying:false},'grandfathered replay');
 }
 const early=quests.find(q=>q.legacyIndex===null);
 for(const assistanceUsed of [false,true]){
  const p=base();delete p.autonomousWins;
  scenario(early,p,{...facts,assistanceUsed},'old profile without autonomy counter');
 }
 process.stdout.write(sql);
}
