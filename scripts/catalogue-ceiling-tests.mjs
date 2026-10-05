import assert from "node:assert/strict";
import fs from "node:fs";

const runtimeFiles=[
 "src/campaign/content.js","src/campaign/progression.js","src/persistence/cloud.js",
 "src/persistence/local.js","src/ui/game-screen.js","src/ui/sky-navigation.js"
];
const sqlFiles=fs.readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).map(x=>"supabase/migrations/"+x);
const activeSql=fs.readFileSync("supabase/migrations/20261005_lumen_remove_catalogue_ceilings.sql","utf8");

// Historical literals are allowed in tests/docs and immutable migration history.
// Current runtime must not use a historical campaign endpoint as a boundary.
for(const path of runtimeFiles){
 const source=fs.readFileSync(path,"utf8");
 assert.doesNotMatch(source,/\b(?:levelIndex|questIndex|puzzleId|puzzle_id)\s*(?:[<>]=?|===?)\s*(?:99|100|134|144)\b/i,path+" contains a fixed catalogue boundary");
}

for(const signature of ["lumen_claim_daily","lumen_save_daily","lumen_create_social_challenge"]){
 assert.match(activeSql,new RegExp(signature),"ceiling-removal migration must own "+signature);
}
assert.doesNotMatch(activeSql,/between\s+1\s+and\s+(?:100|134|144)\b|>\s*(?:100|134|144)\b/i,"active server migration reintroduces a campaign-size ceiling");
assert.match(activeSql,/historical_performance[\s\S]*?between 1 and 10000/i);
assert.match(activeSql,/social_challenges[\s\S]*?between 1 and 10000/i);

// Keep immutable migrations auditable: fixed historical limits may remain there,
// but every known server path must have a later dynamic-ceiling repair.
const historical=sqlFiles.filter(p=>!p.endsWith("20261005_lumen_remove_catalogue_ceilings.sql")).map(p=>fs.readFileSync(p,"utf8")).join("\n");
assert.match(historical,/between 1 and 100|>100/,"guardrail expects the historical ceiling it supersedes");

console.log(JSON.stringify({runtimeFiles:runtimeFiles.length,sqlMigrations:sqlFiles.length,serverCeiling:10000,result:"catalogue growth no longer requires campaign-size edits in runtime/server paths"}));
