import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {changedFiles,selectTests} from './test-affected.mjs';

const available=['cloud-profile-tests.mjs','performance-badge-tests.mjs','unlocked-adventure-progress.test.mjs','test-affected-tests.mjs','admin-catalogue.test.mjs','generated-adventure-map.test.mjs','extended-boundary.test.mjs','staged-adventure.test.mjs','pack-publication-validation.test.mjs'];
test('critical edits include persistence, badge and progression neighbors',()=>{
 for(const file of ['src/persistence/cloud-profile.js','src/campaign/performance.js','src/campaign/content.js','scripts/performance-badge-tests.mjs']){
  const plan=selectTests([file],available);
  assert.equal(plan.mode,'critical');
  for(const suite of available.slice(0,-1))assert.ok(plan.suites.includes(suite),file+' must select '+suite);
 }
});
test('uncertain impact widens, never silently skips',()=>{
 for(const file of ['src/ui/game-screen.js','src/game/rules.js','content/generated/new.json','supabase/migrations/new.sql','package.json','scripts/removed-tests.mjs','src/new-module.js','src/persistence/new-module.js','sw.js']){
  const plan=selectTests([file],available);
  assert.equal(plan.mode,'full',file);
  assert.ok(plan.suites.includes('quality-gate.mjs'));
  assert.ok(plan.suites.includes('pack-publication-validation.test.mjs'));
 }
});
test('documentation and clean trees skip runtime checks; explicit full still runs',()=>{
 assert.equal(selectTests([],available).mode,'none');
 assert.equal(selectTests(['AGENTS.md','docs/TESTING.md'],available).mode,'none');
 assert.equal(selectTests([],available,{full:true}).mode,'full');
});
test('Git detection includes branch, index, worktree, renames, deletions and untracked Unicode paths',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'lumen-affected-git-'));
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 try{
  git('init','-q');git('config','user.name','Lumen isolated fixture');git('config','user.email','fixture@example.invalid');
  for(const file of ['committed.js','staged.js','unstaged.js','deleted.js','old name.js','reverted.js'])writeFileSync(path.join(dir,file),'base');
  git('add','.');git('commit','-qm','base');git('branch','reference');
  writeFileSync(path.join(dir,'committed.js'),'branch');git('add','.');git('commit','-qm','branch change');
  writeFileSync(path.join(dir,'staged.js'),'staged');writeFileSync(path.join(dir,'reverted.js'),'staged');git('add','.');
  writeFileSync(path.join(dir,'reverted.js'),'base');writeFileSync(path.join(dir,'unstaged.js'),'working');
  rmSync(path.join(dir,'deleted.js'));renameSync(path.join(dir,'old name.js'),path.join(dir,'nouveau été.js'));git('add','old name.js','nouveau été.js');
  writeFileSync(path.join(dir,'untracked space.js'),'new');
  assert.deepEqual(changedFiles(dir,'reference'),['committed.js','deleted.js','nouveau été.js','old name.js','reverted.js','staged.js','unstaged.js','untracked space.js'].sort());
  assert.throws(()=>changedFiles(dir,'missing-base'));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
