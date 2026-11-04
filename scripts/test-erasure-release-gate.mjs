// #316: non-destructive end-to-end release gate. Run with: node scripts/test-erasure-release-gate.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261101180000_lumen_self_erasure.sql');
const edge=read('supabase/functions/lumen-self-erasure/index.ts');
const ui=read('src/ui/game-screen.js');
const html=read('index.html');
const checks=[
 ['caller identity derived from JWT', /v_uid\s*:=\s*auth\.uid\(\)/.test(sql)],
 ['confirmation required in SQL',sql.includes("p_confirmation is distinct from 'SUPPRIMER'")],
 ['existing scoped erasure used',sql.includes('lumen_privacy.erase_account(v_uid, v_actors')],
 ['guest actor IDs derived from server data',sql.includes('lumen_privacy.policy()') && sql.includes('v_actors')],
 ['no shared auth.users deletion',!/delete\s+from\s+auth\.users/i.test(sql)],
 ['JWT verified by auth server',edge.includes('client.auth.getUser(token)')],
 ['edge checks explicit confirmation',edge.includes("body?.confirmation !== 'SUPPRIMER'")],
 ['edge handles browser preflight',edge.includes("request.method === 'OPTIONS'")],
 ['account deletion action exists',html.includes('id="eraseLumenExecute"')],
 ['client clears local Lumen data after success',ui.includes('await clearErasedLumenDeviceData()')],
 ['client does not claim success before HTTP success',ui.indexOf('if(!response.ok)throw Error') < ui.indexOf('await clearErasedLumenDeviceData()')],
];
for(const [name,ok] of checks){console.log((ok?'PASS':'FAIL')+' '+name);assert.ok(ok,name)}
console.log('Static release gate passed. NOT an authenticated end-to-end erasure test.');