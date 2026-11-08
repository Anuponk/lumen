// Offline reference metadata only. Never connects to a database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import previous from '../content/generated/logical-grids-v1.json' with {type:'json'};
import current from '../content/generated/logical-grids-v2.json' with {type:'json'};
const quote=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const old=Object.fromEntries(previous.quests.map(q=>[q.id,q.gridRevision]));
const changes=Object.fromEntries(current.quests.map(q=>[q.id,{previous:q.previousGridRevision,current:q.gridRevision}]));
const prepared=`do $seed$ declare expected jsonb:=${quote(old)};begin
 update lumen_commands.quest_rules q set grid_revision=(e.value #>> '{}')::integer from jsonb_each(expected) e where q.quest_id=e.key and q.grid_revision=0;
 if exists(select 1 from jsonb_each(expected) e left join lumen_commands.quest_rules q on q.quest_id=e.key where q.quest_id is null or q.legacy_index is not null or q.grid_revision<>(e.value #>> '{}')::integer) then raise exception 'Historical grid registry does not match manifest';end if;
end $seed$;`;
const activation=`-- Reference metadata activation only. Player reset is a separately authorized operation.\ndo $activate$ declare expected jsonb:=${quote(changes)};begin
 if exists(select 1 from jsonb_each(expected) e left join lumen_commands.quest_rules q on q.quest_id=e.key where q.quest_id is null or q.legacy_index is not null or q.grid_revision not in ((e.value->>'previous')::integer,(e.value->>'current')::integer)) then raise exception 'Active registry diverges from reviewed grid history';end if;
 update lumen_commands.quest_rules q set grid_revision=(e.value->>'current')::integer from jsonb_each(expected) e where q.quest_id=e.key and q.grid_revision is distinct from (e.value->>'current')::integer;
end $activate$;`;
const index=process.argv.indexOf('--write-seed');
if(index>=0){
 const path=process.argv[index+1];assert.match(path,/^supabase\/migrations\/\d+_[a-z0-9_]+\.sql$/);
 const source=fs.readFileSync(path,'utf8'),start='-- BEGIN PREVIOUS GRID REVISIONS',end='-- END PREVIOUS GRID REVISIONS';
 assert(source.includes(start)&&source.includes(end));
 fs.writeFileSync(path,source.slice(0,source.indexOf(start)+start.length)+'\n'+prepared+'\n'+source.slice(source.indexOf(end)));
 console.log('Seeded immutable prior registry; no revision-2 activation');
}else if(process.argv.includes('--json'))console.log(JSON.stringify(changes));
else if(process.argv.includes('--output'))fs.writeFileSync(process.argv[process.argv.indexOf('--output')+1],activation+'\n');
else process.stdout.write(activation+'\n');
