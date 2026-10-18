// Generates ONLY disposable SQL fixture input and catalogue metadata, never
// connects to a database. Current source modules own rules and expected results.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {legacyVictoryRules,applyLegacyVictory} from '../src/campaign/legacy-victory.js';
const rows=legacyVictoryRules(),quote=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const seed=rows.map(row=>`insert into lumen_commands.legacy_rules values ('${row.questId.replaceAll("'","''")}',${row.index},${quote(row)}) on conflict(quest_id) do update set legacy_index=excluded.legacy_index,rules=excluded.rules;`).join('\n');
const start='-- BEGIN CATALOGUE SEED (scripts/legacy-command-fixtures.mjs --write-seed)',end='-- END CATALOGUE SEED';
if(process.argv.includes('--write-seed')){
 const migration=process.argv[process.argv.indexOf('--write-seed')+1];
 assert.match(migration||'',/^supabase\/migrations\/\d+_[a-z0-9_]+\.sql$/,'Pass the NEW migration path created by the Supabase CLI; never rewrite an applied migration');
 const source=fs.readFileSync(migration,'utf8')||start+'\n'+end+'\n';
 assert.ok(source.includes(start)&&source.includes(end),'Migration needs catalogue seed markers');
 fs.writeFileSync(migration,source.slice(0,source.indexOf(start)+start.length)+'\n'+seed+'\n'+source.slice(source.indexOf(end)));
 console.log(`Seeded ${rows.length} catalogue-derived historical rules`);
}
else if(process.argv.includes('--check')){
 const accumulated=new Map();
 for(const file of fs.readdirSync('supabase/migrations').filter(p=>p.endsWith('.sql')).sort()){
  const source=fs.readFileSync('supabase/migrations/'+file,'utf8');if(!source.includes(start))continue;
  for(const match of source.slice(source.indexOf(start),source.indexOf(end)).matchAll(/insert into lumen_commands\.legacy_rules values \('([^']+)',(\d+),'(.*)'::jsonb\)/g)){
   const rule=JSON.parse(match[3].replaceAll("''","'"));assert.equal(rule.questId,match[1]);assert.equal(rule.index,Number(match[2]));accumulated.set(rule.questId,rule);
  }
 }
 const ordered=values=>[...values].sort((a,b)=>a.questId.localeCompare(b.questId));
 assert.deepEqual(ordered(accumulated.values()),ordered(rows),'Server rules drifted: create a new CLI migration and generate its seed; retain applied migrations');
 console.log(`${rows.length} historical rules match cumulative migration seeds`);
}
else{
 const base=()=>({solved:{},badges:{},stars:{},challenges:{},performances:{},noHint:{},xp:42,shards:7,skyHistoryVersion:4,skyScore:0,future:{keep:true}});
 const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-18',qualifiedAt:'2026-10-18T10:00:00.000Z'};
 let sql='-- Generated fixtures; no player records. Requires isolated bootstrap.\n';let n=0;
 function scenario(row,profile,run,label){
  const before=structuredClone(profile),outcome=applyLegacyVictory(profile,row.index,run),uid=`10000000-0000-0000-0000-${String(++n).padStart(12,'0')}`;
  sql+=`do $case$ declare r jsonb;p jsonb;begin\ninsert into auth.users values ('${uid}');insert into lumen.profile_snapshots(user_id,payload) values ('${uid}',${quote(before)});\nperform set_config('request.jwt.claim.sub','${uid}',true);\nr:=public.lumen_commit_legacy_command('fixture','${uid}','${row.questId}',${quote(run)});\np:=r->'profile';\nassert (p-'legacyVictoryRevision'-'daily')=${quote(profile)}, 'profile parity ${label} index ${row.index}: '||p::text;\nassert (r->'outcome')=${quote(outcome)},'outcome parity ${label} index ${row.index}: '||(r->'outcome')::text;\nend $case$;\n`;
 }
 for(const row of rows){const p=base();p.solved=Object.fromEntries(Array.from({length:row.index},(_,i)=>[i,1]));scenario(row,p,facts,'first');}
 for(const row of rows.filter(r=>r.index<8||r.challenge)){
  for(const variant of [{seconds:60,assistanceUsed:true},{seconds:80,mistakeCommitted:true,hintUsed:true,challengeFailed:true},{seconds:10,qualifying:false}]){
   const p=base();p.solved=Object.fromEntries(Array.from({length:row.index+1},(_,i)=>[i,1]));p.performances[row.index]={version:2,badges:{mastery:true},bestTime:18,attempts:4,lastQualifiedAt:facts.qualifiedAt,future:{keep:true}};
   scenario(row,p,{...facts,...variant},'replay');
  }
 }
 process.stdout.write(sql);
}
