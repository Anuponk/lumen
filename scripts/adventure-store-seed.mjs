// #728: source-owned store seed. The client catalogue owns Adventures, quest
// membership and badge keys; the server receives an exact, checked copy.
//   node scripts/adventure-store-seed.mjs --write-seed <migration>  (rewrites the delimited block)
//   node scripts/adventure-store-seed.mjs --check                   (cumulative migrations == source)
// Prices are product decisions (#725): EUR cents, TTC.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {PERFORMANCE_BADGES} from '../src/campaign/performance.js';

import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,SKY_PRODUCT_ID} from '../src/campaign/store-catalogue.js';
export {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,SKY_PRODUCT_ID};
const START='-- BEGIN STORE SEED',END='-- END STORE SEED';
const q=v=>"'"+String(v).replaceAll("'","''")+"'";

export function storeSeed(){
 const packs=[...CONTENT_PACKS].sort((a,b)=>a.order-b.order);
 const quests=canonicalQuestList();
 for(const p of packs)assert(quests.some(x=>x.packId===p.id),'Every Adventure has quests: '+p.id);
 const locked=packs.filter(p=>p.access==='locked');
 const lines=[];
 for(const p of packs)lines.push(`insert into lumen_commands.adventure_packs values (${q(p.id)},${p.order},${q(p.access==='locked'?'locked':'included')}) on conflict (pack_id) do update set sort_order=excluded.sort_order,access=excluded.access;`);
 for(const x of quests)lines.push(`insert into lumen_commands.quest_packs values (${q(x.id)},${q(x.packId)},${x.legacyIndex??'null'}) on conflict (quest_id) do update set pack_id=excluded.pack_id,legacy_index=excluded.legacy_index;`);
 for(const p of locked)lines.push(`insert into lumen_commands.store_products values (${q(p.id)},'adventure',${q(p.id)},${ADVENTURE_PRICE_CENTS},'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;`);
 lines.push(`insert into lumen_commands.store_products values (${q(SKY_PRODUCT_ID)},'sky',null,${SKY_PRICE_CENTS},'EUR',true) on conflict (product_id) do update set kind=excluded.kind,pack_id=excluded.pack_id,price_cents=excluded.price_cents,currency=excluded.currency,active=excluded.active;`);
 lines.push(`insert into lumen_commands.store_settings values (true,${SKY_PRICE_CENTS},array[${PERFORMANCE_BADGES.map(q).join(',')}]::text[]) on conflict (singleton) do update set cap_cents=excluded.cap_cents,badge_keys=excluded.badge_keys;`);
 return lines.join('\n');
}
function latestBlock(){
 const blocks=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort()
  .map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8').replace(/\r\n/g,'\n')).filter(s=>s.includes(START))
  .map(s=>s.slice(s.indexOf(START)+START.length,s.indexOf(END)).trim());
 return blocks.at(-1);
}
if(process.argv.includes('--write-seed')){
 const migration=process.argv[process.argv.indexOf('--write-seed')+1];
 assert.match(migration||'',/^supabase\/migrations\/\d+_[a-z0-9_]+\.sql$/,'Pass the migration path');
 const source=fs.readFileSync(migration,'utf8').replace(/\r\n/g,'\n');assert(source.includes(START)&&source.includes(END));
 fs.writeFileSync(migration,source.slice(0,source.indexOf(START)+START.length)+'\n'+storeSeed()+'\n'+source.slice(source.indexOf(END)));
 console.log('Store seed written');
}else if(process.argv.includes('--check')){
 // Each seed is a full upsert of the current catalogue, so the latest block must equal the source.
 assert.equal(latestBlock(),storeSeed(),'The latest store seed migration must match the catalogue; run --write-seed in a new migration');
 console.log('Store seed matches the catalogue');
}
