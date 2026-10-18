import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,collect} from './ci-metrics.mjs';

const job=(start,end,skip=false)=>({name:'quality',started_at:start,completed_at:end,
 steps:[{name:'Unified quality gate',conclusion:skip?'skipped':'success'}]});
const run=(id,event='pull_request',extra={})=>({id,path:'.github/workflows/quality.yml',
 event,sha:'abc',prs:[7],status:'completed',conclusion:'success',attempt:1,
 jobs:[job('2026-10-18T00:00:00Z','2026-10-18T00:02:00Z')],...extra});
test('keeps scheduled reuse out of full validation averages and counts reruns separately',()=>{
 const report=summarize({scope:{truncated:true},runs:[run(1),run(2,'pull_request',{attempt:3}),
  run(3,'schedule',{jobs:[job('2026-10-18T00:00:00Z','2026-10-18T00:00:07Z',true)]}),
  run(4,'pull_request',{status:'in_progress',jobs:[]})]});
 assert.deepEqual(report.groups['quality.yml/pull_request/executed/success'].executionSeconds,{n:2,mean:120,median:120});
 assert.equal(report.groups['quality.yml/schedule/reused/success'].executionSeconds.mean,7);
 assert.equal(report.perPR[7].runs,3);
 assert.equal(report.perPR[7].rerunAttempts,2);
 assert.equal(report.perPR[7].distinctHeads,1);
 assert.match(report.unavailable.avoidableFailures,/manual/);
});
test('missing durations stay unavailable, not zero; multi-job wall time differs from runner sum',()=>{
 const report=summarize({runs:[run(1,'push',{jobs:[]}),run(2,'push',{
  jobs:[job('2026-10-18T00:00:00Z','2026-10-18T00:02:00Z'),job('2026-10-18T00:01:00Z','2026-10-18T00:03:00Z')]})]});
 const group=report.groups['quality.yml/push/executed/success'];
 assert.equal(group.executionSeconds.n,1);
 assert.equal(group.executionSeconds.mean,180);
 assert.equal(group.jobSeconds.mean,120);
 assert.equal(summarize({runs:[run(1,'push',{jobs:[]})]}).groups['quality.yml/push/executed/success'].executionSeconds.mean,null);
});
test('invalid collection bounds fail before network access',async()=>{
 await assert.rejects(collect({pages:0}));
 await assert.rejects(collect({repository:'other/repo'}));
});
