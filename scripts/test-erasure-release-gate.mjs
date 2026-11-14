// #316: non-destructive static release gate. Run with: node scripts/test-erasure-release-gate.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261101180000_lumen_self_erasure.sql');
const edge=read('supabase/functions/lumen-self-erasure/index.ts');
const ui=read('src/ui/game-screen.js');
const html=read('index.html');
const checks=[
 ['SQL entrypoint requires service role',sql.includes("auth.role()) is distinct from 'service_role'")],
 ['SQL target passed by server',sql.includes('v_uid := p_user_id')],
 ['client roles denied direct RPC',sql.includes('from public, anon, authenticated')],
 ['server role explicitly granted',sql.includes('to service_role')],
 ['no JWT context manipulation',!sql.includes("set_config('request.jwt")],
 ['service credentials only in Edge',edge.includes("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")],
 ['server target derived from verified user',edge.includes('p_user_id: user.id')],
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
