// Read-only GitHub API collector; no dependencies, services or player telemetry.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const core=new Set(['quality.yml','cloud-persistence-contract.yml','cloud-reconciliation-matrix.yml','canonical-ledger.yml']);
const workflow=run=>run.path.split('/').pop();
const seconds=(start,end)=>start&&end?(Date.parse(end)-Date.parse(start))/1000:null;
const stats=values=>{
 const sorted=values.filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
 return {n:sorted.length,mean:sorted.length?sorted.reduce((a,b)=>a+b,0)/sorted.length:null,
  median:sorted.length?(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2:null};
};

export function summarize(snapshot) {
 const completed=snapshot.runs.filter(run=>run.status==='completed');
 const groups={};
 const prs={};
 for(const run of completed) {
  const name=workflow(run),jobs=run.jobs||[];
  const reuse=jobs.some(job=>job.steps.some(step=>step.name==='Unified quality gate'&&step.conclusion==='skipped'));
  const key=[name,run.event,reuse?'reused':'executed',run.conclusion].join('/');
  const group=groups[key]||={runs:0,attempts:0,durations:[],jobSeconds:[],jobsObserved:0};
  group.runs++;group.attempts+=run.attempt;
  // Completed jobs only: exclude cancelled/in-progress work from timing means.
  const starts=jobs.map(j=>j.started_at).filter(Boolean).sort();
  const ends=jobs.map(j=>j.completed_at).filter(Boolean).sort();
  if(starts.length&&ends.length===jobs.length)group.durations.push(seconds(starts[0],ends.at(-1)));
  for(const job of jobs)if(job.started_at&&job.completed_at){
   group.jobSeconds.push(seconds(job.started_at,job.completed_at));group.jobsObserved++;
  }
 }
 for(const run of snapshot.runs.filter(run=>run.event==='pull_request'&&core.has(workflow(run)))) {
  for(const number of run.prs||[]) {
   const pr=prs[number]||={runs:0,reruns:0,heads:new Set()};
   pr.runs++;pr.reruns+=run.attempt-1;pr.heads.add(run.sha);
  }
 }
 return {schema:1,collectedAt:snapshot.collectedAt,scope:snapshot.scope,
  runsObserved:snapshot.runs.length,completedRuns:completed.length,
  groups:Object.fromEntries(Object.entries(groups).map(([key,value])=>[key,{
   runs:value.runs,rerunAttempts:value.attempts-value.runs,
   executionSeconds:stats(value.durations),jobSeconds:stats(value.jobSeconds)}])),
  perPR:Object.fromEntries(Object.entries(prs).map(([key,value])=>[key,{
   runs:value.runs,rerunAttempts:value.reruns,distinctHeads:value.heads.size,
   note:'Distinct heads are revisions, not bug correction cycles. Counts cover this window only.'}])),
  unavailable:{avoidableFailures:'Requires manual root-cause classification; failures are not automatically avoidable.',
   bugCorrectionCycles:'Requires a bug ID and a manually linked sequence of corrective attempts.',
   codexTokens:'GitHub has no Codex token counters. Import attributable session usage separately; never add cached input twice.',
   previousAttempts:'Job timings are latest-attempt only; rerun counts use run_attempt.',
   localBefore:'No comparable historical local timing series.'}};
}

export async function collect({repository='Anuponk/lumen',pages=1}={}) {
 if(repository!=='Anuponk/lumen'||!Number.isInteger(pages)||pages<1||pages>10)throw Error('Expected Anuponk/lumen and 1..10 pages');
 const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 if(process.env.GH_TOKEN)headers.Authorization='Bearer '+process.env.GH_TOKEN;
 async function get(route) {
  const response=await fetch('https://api.github.com/repos/'+repository+route,{headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`GitHub ${response.status} at ${route.split('?')[0]}; collection incomplete`);
  return response.json();
 }
 const raw=[];
 let truncated=true;
 for(let page=1;page<=pages;page++) {
  const result=await get(`/actions/runs?per_page=100&page=${page}`);
  raw.push(...result.workflow_runs);
  if(result.workflow_runs.length<100){truncated=false;break}
 }
 const runs=[];
 const linkedPRs=new Map();
 // Serial collection keeps API pressure low. No retry/rerun/dispatch mutations.
 for(const run of raw) {
  const jobs=[];
  for(let page=1;;page++) {
   const batch=await get(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100&page=${page}`);
   jobs.push(...batch.jobs);
   if(batch.jobs.length<100)break;
  }
  let prs=(run.pull_requests||[]).map(pr=>pr.number);
  if(run.event==='pull_request'&&!prs.length) {
   if(!linkedPRs.has(run.head_sha))linkedPRs.set(run.head_sha,
    (await get(`/commits/${run.head_sha}/pulls?per_page=100`)).map(pr=>pr.number));
   prs=linkedPRs.get(run.head_sha);
  }
  runs.push({id:run.id,path:run.path,event:run.event,sha:run.head_sha,prs,
   created_at:run.created_at,status:run.status,conclusion:run.conclusion,attempt:run.run_attempt,
   jobs:jobs.map(job=>({name:job.name,started_at:job.started_at,completed_at:job.completed_at,
    conclusion:job.conclusion,steps:job.steps.map(step=>({name:step.name,conclusion:step.conclusion,
     started_at:step.started_at,completed_at:step.completed_at}))}))});
 }
 return {schema:1,collectedAt:new Date().toISOString(),
  scope:{repository,pages,truncated,jobAttempts:'latest only',
   oldest:raw.at(-1)?.created_at,newest:raw[0]?.created_at,
   note:'Bounded latest-run window; not a random sample or a complete PR lifetime.'},runs};
}

async function main(args) {
 const [command,input,output]=args;
 if(command==='collect'&&input) {
  const snapshot=await collect({pages:Number(output||1)});
  fs.writeFileSync(input,JSON.stringify(snapshot,null,2)+'\n');
  console.log(`Collected ${snapshot.runs.length} runs; truncated=${snapshot.scope.truncated}`);
 }else if(command==='summarize'&&input) {
  const report=JSON.stringify(summarize(JSON.parse(fs.readFileSync(input,'utf8'))),null,2)+'\n';
  if(output)fs.writeFileSync(output,report);else process.stdout.write(report);
 }else throw Error('Usage: node scripts/ci-metrics.mjs collect SNAPSHOT.json [PAGES=1] | summarize SNAPSHOT.json [REPORT.json]');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1});
}
