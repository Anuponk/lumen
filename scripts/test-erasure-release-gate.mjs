// #316: non-destructive static release gate. Run with: node scripts/test-erasure-release-gate.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261101180000_lumen_self_erasure.sql');
const edge=read('supabase/functions/lumen-self-erasure/index.ts');
const ui=read('src/ui/game-screen.js');
const html=read('index.html');
const full=read('supabase/migrations/20261114120000_lumen_full_account_deletion.sql');
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
 ['client clears local Lumen data after success',ui.includes('await clearErasedLumenDeviceData({includeSession:accountDeleted})')],
 ['client sign-out after erasure is time-bounded',ui.includes("Promise.race([signOut(),new Promise(resolve=>setTimeout(")],
 ['stored session removed only for a deleted sign-in account',ui.includes("const accountDeleted=acknowledgement?.accountDeleted===true")],
 ['full deletion SQL never deletes auth.users itself',!/delete\s+from\s+auth\.users/i.test(full)&&!/auth\.users\s+where/i.test(full.replace(/confrelid='auth\.users'::regclass/g,''))],
 ['deletable check is service-role only',full.includes("function public.lumen_account_deletable")&&full.includes('lumen_account_deletable(uuid) from public,anon,authenticated')&&full.includes('lumen_account_deletable(uuid) to service_role')&&full.includes("auth.role()) is distinct from 'service_role'")],
 ['deletion requires the Lumen erasure barrier',full.includes("kind='user' and digest=lumen_privacy.fingerprint(p_user_id::text)")],
 ['accounts used by another app are kept',full.includes('return not lumen_privacy.account_used_elsewhere(p_user_id)')&&full.includes("confrelid='auth.users'::regclass")],
 ['other-app scan fails closed',/exception when others then\s+return true;/.test(full)],
 ['edge deletes the account only after an explicit safe answer',edge.indexOf("operator.rpc('lumen_self_erase'")<edge.indexOf("operator.rpc('lumen_account_deletable'")&&edge.includes('deletable === true')&&edge.indexOf('deletable === true')<edge.indexOf('operator.auth.admin.deleteUser(user.id)')],
 ['erased-status RPC is self-only',full.includes('auth.uid() is not null and exists')&&full.includes('lumen_account_erased() from public,anon')],
 ['client explains erased accounts before the nickname gate',html.includes('id="erasedAccountNotice"')&&ui.indexOf("rpc('lumen_account_erased')")<ui.indexOf("rpc('lumen_ranking_account')")],
 ['client does not claim success before HTTP success',ui.indexOf('if(!response.ok)throw Error') < ui.indexOf('await clearErasedLumenDeviceData(')],
];
for(const [name,ok] of checks){console.log((ok?'PASS':'FAIL')+' '+name);assert.ok(ok,name)}
console.log('Static release gate passed. NOT an authenticated end-to-end erasure test.');
