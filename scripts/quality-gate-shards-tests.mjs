import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {browserSuites, selectQualityPlan} from './quality-gate-browser-suites.mjs';
import {assertQualityResults} from './quality-gate-result.mjs';

test('three CI shards cover the local browser inventory exactly once', () => {
 const local=selectQualityPlan([],{});
 assert.equal(local.phase,'full');
 assert.equal(local.suites.length,39);
 const shards=[1,2,3].map(i=>selectQualityPlan([`--browser-shard=${i}/3`],{}));
 const selected=shards.flatMap(plan=>plan.suites.map(s=>s.script));
 assert.equal(new Set(selected).size,39);
 assert.deepEqual(selected.sort(),local.suites.map(s=>s.script).sort());
 for(const field of ['script','output','port'])assert.equal(new Set(browserSuites.map(s=>s[field])).size,browserSuites.length);
 for(const shard of shards)assert.equal(shard.phase,'browser');
 assert.deepEqual(selectQualityPlan(['--node-only'],{}).suites,[]);
});

test('learning selection preserves exactly the same omission in local and CI modes', () => {
 const env={LUMEN_RUN_LEARNING_BROWSER:'false'};
 const local=selectQualityPlan([],env).suites.map(s=>s.script);
 const ci=[1,2,3].flatMap(i=>selectQualityPlan([`--browser-shard=${i}/3`],env).suites.map(s=>s.script));
 assert.equal(local.length,38);
 assert(!ci.includes('learning-browser-tests.mjs'));
 assert.deepEqual(ci.sort(),local.sort());
});

test('#744: a presentation-page-only PR runs only the page suite, on shard 1', () => {
 const env={LUMEN_QUALITY_SCOPE:'landing'};
 assert.deepEqual(selectQualityPlan([],env).suites.map(s=>s.script),['landing-browser-tests.mjs']);
 assert.deepEqual([1,2,3].map(i=>selectQualityPlan([`--browser-shard=${i}/3`],env).suites.map(s=>s.script)),[['landing-browser-tests.mjs'],[],[]]);
 assert.equal(selectQualityPlan(['--node-only'],env).scope,'landing');
 for(const scope of [undefined,'full','docs'])assert.equal(selectQualityPlan([],{LUMEN_QUALITY_SCOPE:scope}).suites.length,39,'Full inventory for '+scope);
 assert.throws(()=>selectQualityPlan([],{LUMEN_QUALITY_SCOPE:'everything-skipped'}),/Unknown LUMEN_QUALITY_SCOPE/);
});

test('invalid or mixed invocations fail instead of silently reducing coverage', () => {
 for(const args of [['--node-onyl'],['--browser-shard=0/3'],['--browser-shard=4/3'],['--browser-shard=1/2'],['--browser-shard=1.5/3'],['--node-only','--browser-shard=1/3']])assert.throws(()=>selectQualityPlan(args,{}));
});

test('required quality rejects failure, cancellation, skipped or missing execution', () => {
 const good={prepare:'success',runFull:'true',node:'success',browser:'success'};
 assert.doesNotThrow(()=>assertQualityResults(good));
 for(const key of ['prepare','node','browser'])for(const result of ['failure','cancelled','skipped',undefined])assert.throws(()=>assertQualityResults({...good,[key]:result}));
 for(const runFull of ['',undefined,'unexpected'])assert.throws(()=>assertQualityResults({...good,runFull}));
});

test('only a successful explicit docs classification permits skipped runtime jobs', () => {
 const docs={prepare:'success',runFull:'false',node:'skipped',browser:'skipped'};
 assert.doesNotThrow(()=>assertQualityResults(docs));
 for(const key of ['node','browser'])for(const result of ['failure','cancelled',undefined])assert.throws(()=>assertQualityResults({...docs,[key]:result}));
 assert.throws(()=>assertQualityResults({...docs,prepare:'failure'}));
});

test('invalid CLI invocation fails and replaces stale reports in the isolated output directory',()=>{
 const directory=mkdtempSync(path.join(tmpdir(),'lumen-quality-shard-test-'));
 try{
  const stale=path.join(directory,browserSuites[0].output);
  writeFileSync(stale,'{"ok":true}');
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./quality-gate.mjs',import.meta.url)),'--browser-shard=4/3'],{
   env:{...process.env,LUMEN_VALIDATION_DIR:directory},encoding:'utf8'});
  if(result.error)throw result.error;
  assert.equal(result.status,1,result.stderr);
  const report=JSON.parse(readFileSync(path.join(directory,'ci-quality-summary.json'),'utf8'));
  assert.equal(report.ok,false);
  assert.match(report.error,/Usage/);
  assert.deepEqual(report.suites,[]);
  assert.equal(existsSync(stale),false);
 }finally{rmSync(directory,{recursive:true,force:true})}
});

test('the checked CI browser inventory retains all prior suites and Play review',()=>{
 assert.deepEqual(browserSuites.map(s=>s.script).sort(),[
  "account-session-browser-tests.mjs",
  "account-switch-browser-tests.mjs",
  "admin-preview-browser-tests.mjs",
  "adventure-05-browser-tests.mjs",
  "adventure-mastery-browser-tests.mjs",
  "analytics-admin-browser-tests.mjs",
  "browser-tests.mjs",
  "campaign-resume-browser-tests.mjs",
  "canonical-replay-browser-tests.mjs",
  "cloud-reset-browser-tests.mjs",
  "credits-browser-tests.mjs",
  "desktop-layout-browser-tests.mjs",
  "drag-cascade-browser-tests.mjs",
  "first-welcome-browser-tests.mjs",
  "iau-completion-browser-tests.mjs",
  "iau-completion-cloud-browser-tests.mjs",
  "incident-investigation-browser-tests.mjs",
  "install-request-browser-tests.mjs",
  "landing-browser-tests.mjs",
  "landscape-layout-browser-tests.mjs",
  "late-game-browser-tests.mjs",
  "learning-browser-tests.mjs",
  "learning-coach-placement-browser-tests.mjs",
  "official-time-browser-tests.mjs",
  "offline-hint-network-browser-tests.mjs",
  "offline-hint-purchase-browser-tests.mjs",
  "offline-network-browser-tests.mjs",
  "owned-adventure-browser-tests.mjs",
  "personal-records-browser-tests.mjs",
  "play-review-navigation-browser-tests.mjs",
  "quest-review-browser-tests.mjs",
  "ranking-browser-tests.mjs",
  "service-worker-update-browser-tests.mjs",
  "sky-navigation-browser-tests.mjs",
  "sky-return-browser-tests.mjs",
  "ux-cleanup-tests.mjs",
  "ux-lot-browser-tests.mjs",
  "victory-layout-browser-tests.mjs",
  "victory-pending-browser-tests.mjs"
]);
});
