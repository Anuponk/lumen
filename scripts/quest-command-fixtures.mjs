// Source-owned seed and disposable PostgreSQL parity input. Never connects.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {questRewardDefinition} from '../src/campaign/quest-rewards.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
const migration='supabase/migrations/20261023181850_quest_contract_convergence.sql';
const quests=canonicalQuestList(),quote=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const rules=quests.map(q=>({questId:q.id,ordinal:q.ordinal,legacyIndex:q.legacyIndex,...questRewardDefinition(q)}));
const seed=rules.map(q=>`insert into lumen_commands.quest_rules values ('${q.questId.replaceAll("'","''")}',${q.legacyIndex??'null'},${quote(q)});`+
 (q.legacyIndex===null?`\ninsert into lumen.canonical_quest_allowlist values ('${q.questId.replaceAll("'","''")}') on conflict do nothing;`:'')).join('\n');
const start='-- BEGIN QUEST RULES',end='-- END QUEST RULES';
if(process.argv.includes('--write-seed')){
 const source=fs.readFileSync(migration,'utf8');assert(source.includes(start)&&source.includes(end));
 fs.writeFileSync(migration,source.slice(0,source.indexOf(start)+start.length)+'\n'+seed+'\n'+source.slice(source.indexOf(end)));
 console.log(`Seeded ${rules.length} quest contracts in the pending migration`);
}else if(process.argv.includes('--check')){
 const source=fs.readFileSync(migration,'utf8').replace(/\r\n/g,'\n');
 assert.equal(source.slice(source.indexOf(start)+start.length,source.indexOf(end)).trim(),seed);
 console.log(`${rules.length} server quest contracts match source`);
}else{
 const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-22',qualifiedAt:'2026-10-22T10:00:00.000Z'};
 const base=()=>({catalogueOrigin:currentCatalogueOrigin,xp:42,shards:7,autonomousWins:2,solved:{},performances:{},badges:{},stars:{},challenges:{},canonicalQuestState:{},skyScore:0,skyHistoryVersion:4,future:{keep:true}});
 let n=0,sql='-- Disposable only. All identities below are synthetic.\n';
 function scenario(q,p,f,label){
  const before=structuredClone(p),out=applyQuestVictory(p,q,f),uid=`52200000-0000-0000-0000-${String(++n).padStart(12,'0')}`;
  sql+=`do $case$ declare result jsonb;latest jsonb;begin
insert into auth.users values ('${uid}');insert into lumen.profile_snapshots(user_id,payload) values ('${uid}',${quote(before)});
perform set_config('request.jwt.claim.sub','${uid}',true);
result:=public.lumen_commit_quest_command('fixture','${uid}','${q.id}',${quote(f)});
latest:=result->'profile';
assert (latest-'legacyVictoryRevision'-'walletRevision'-'daily')=${quote(p)},'quest profile parity ${label} ${q.id}: '||latest::text;
assert result->'outcome'=${quote(out)},'quest outcome parity ${label} ${q.id}: '||(result->'outcome')::text;
assert public.lumen_commit_quest_command('fixture','${uid}','${q.id}',${quote(f)})=result,'same operation is idempotent';
end $case$;\n`;
 }
 for(const q of quests.filter(q=>q.legacyIndex===null)){
  scenario(q,base(),facts,'first');
  const p=base();p.canonicalQuestState[q.id]={solved:true,stars:1,badges:{mastery:true},performance:{seconds:80,bestTime:80},future:{keep:true}};
  scenario(q,p,{...facts,seconds:20,assistanceUsed:true,hintUsed:false,qualifying:false},'grandfathered replay');
 }
 const early=quests.find(q=>q.legacyIndex===null);
 for(const assistanceUsed of [false,true]){
  const p=base();delete p.autonomousWins;
  scenario(early,p,{...facts,assistanceUsed},'old profile without autonomy counter');
 }
 process.stdout.write(sql);
}
