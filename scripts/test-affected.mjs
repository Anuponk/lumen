import {execFileSync, spawnSync} from 'node:child_process';
import {readdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {nodeSuites} from './quality-gate-suites.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testFile=name=>/(?:-tests?|\.test)\.mjs$/.test(name);
// The UI reads sources dynamically and orchestrates several persistence domains.
// A static import graph alone would miss these contracts. Keep this tier broad.
const critical=name=>/^(?:cloud-|canonical-|performance-|hint-assistance-|attempt-engine-|account-|auth-|oauth-return|persistence-|guest-transfer|campaign-|late-game-|content-architecture-|unlocked-adventure-progress|playable-navigation|generated-progression|generated-rewards|daily-|social-challenge-|issue-222-challenge-|sky-navigation-|intro-flags-|reward-conflict-|test-affected-tests|admin-catalogue|generated-adventure-map|extended-boundary|staged-adventure)/.test(name)
 && !/(?:browser|ux-cleanup)/.test(name);

export function changedFiles(cwd=root, base='origin/main') {
 const git=(...args)=>execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']});
 const ancestor=git('merge-base', 'HEAD', base).trim();
 // All tracked changes relative to the fork point, plus untracked files.
 // Separate index/worktree diffs also retain staged changes undone in the worktree.
 return [...new Set([
  ...git('diff','--no-renames','--name-only','-z',ancestor,'HEAD').split('\0'),
  ...git('diff','--no-renames','--name-only','-z','--cached').split('\0'),
  ...git('diff','--no-renames','--name-only','-z').split('\0'),
  ...git('ls-files','--others','--exclude-standard','-z').split('\0')
 ].filter(Boolean))].sort();
}

export function selectTests(files, available, {full=false}={}) {
 const criticalSuites=available.filter(name=>(testFile(name)&&critical(name))||name==='cloud-contract-check.mjs');
 const selected=new Set();
 const reasons=[];
 for(const file of files) {
  if(/^(?:docs\/.*\.md|README\.md|AGENTS\.md)$/.test(file))continue;
  if(file.startsWith('scripts/')&&testFile(file.slice(8))&&available.includes(file.slice(8))
    &&!/(?:browser|ux-cleanup)/.test(file)) {
   selected.add(file.slice(8));
  } else if(!/^(?:src\/persistence\/(?:local|guest-transfer|daily-hydration|cloud|cloud-profile|canonical-progress|canonical-profile|canonical-outbox)\.js|src\/campaign\/(?:performance|progression|canonical-quests|content|social-challenge|canonical-challenges|daily-engagement)\.js|src\/game\/attempt-engine\.js)$/.test(file)) {
   full=true;reasons.push(file);
  }
  for(const suite of criticalSuites)selected.add(suite);
 }
 // Unknown/deleted files, content, shared engine/UI, SQL, tooling or setup changes:
 // run the existing gate, supplemented by standalone suites it does not include.
 if(full)return {mode:'full',reasons,suites:['quality-gate.mjs',...available.filter(name=>(testFile(name)&&!nodeSuites.includes(name)&&!/(?:browser|ux-cleanup)/.test(name))||name==='cloud-contract-check.mjs')]};
 return {mode:selected.size?'critical':'none',reasons,suites:[...selected].sort()};
}

export function main(args=process.argv.slice(2)) {
 let base='origin/main',full=false,list=false;
 for(let i=0;i<args.length;i++) {
  if(args[i]==='--base'&&args[i+1])base=args[++i];
  else if(args[i]==='--full')full=true;
  else if(args[i]==='--list')list=true;
  else throw Error('Usage: node scripts/test-affected.mjs [--base REF] [--full] [--list]');
 }
 let files=[],detectionError;
 if(!full)try{files=changedFiles(root,base)}catch(error){full=true;detectionError=error.message.split('\n')[0]}
 const available=readdirSync(path.join(root,'scripts'));
 const plan=selectTests(files,available,{full});
 if(list)console.log(JSON.stringify({...plan,files,base,...(detectionError?{detectionError}:{})},null,2));
 else {
  console.log(`Affected tests: ${plan.mode}; ${files.length} changed files; ${plan.suites.length} suites; base ${base}`);
  if(plan.reasons.length)console.log('Widened for: '+plan.reasons.join(', '));
  if(detectionError)console.log('Git detection unavailable; running full suite: '+detectionError);
 }
 if(list||!plan.suites.length)return 0;
 const logDir=mkdtempSync(path.join(tmpdir(),'lumen-tests-'));
 console.log('Detailed logs: '+logDir);
 let failures=0;
 for(const suite of plan.suites) {
  const started=Date.now();
  const result=spawnSync(process.execPath,[path.join('scripts',suite)],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
  const output=(result.stdout||'')+(result.stderr||'')+(result.error?.message||'');
  writeFileSync(path.join(logDir,suite+'.log'),output);
  const ok=result.status===0;
  console.log(`${ok?'PASS':'FAIL'} ${suite} ${((Date.now()-started)/1000).toFixed(2)}s`);
  if(!ok){failures++;console.error(output.slice(-12000))}
 }
 console.log(`${plan.suites.length} suites; ${failures} failed`);
 return failures?1:0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 try{process.exitCode=main()}catch(error){console.error(error.message);process.exitCode=1}
}
