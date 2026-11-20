// #744: CI scope classification and its wiring into the required workflows.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {classifyScope} from './ci-scope.mjs';

// Documentation only keeps the existing rule.
assert.equal(classifyScope(['docs/TESTING.md','AGENTS.md']),'docs');
assert.equal(classifyScope(['docs/validation/ci-browser.json']),'full','Validation artefacts are not documentation');
// Presentation page only, alone or with docs.
assert.equal(classifyScope(['decouvrir.html']),'landing');
assert.equal(classifyScope(['discover.html','src/landing/og-en.jpg']),'landing');
assert.equal(classifyScope(['how-to-play.html','learn-constellations.html']),'landing','#754 English guides');
assert.equal(classifyScope(['apprendre-constellations.html']),'landing','#769 page');
assert.equal(classifyScope(['comment-jouer.html','scripts/how-to-play.mjs','src/landing/how-to-play-grid.svg']),'landing','#758 page and its generator');
assert.equal(classifyScope(['src/landing/landing.css','src/landing/og.jpg','robots.txt','sitemap.xml','docs/TESTING.md']),'landing');
assert.equal(classifyScope(['scripts/landing-seo-tests.mjs','scripts/landing-browser.mjs','scripts/landing-browser-tests.mjs','scripts/landing-assets.mjs']),'landing');
// Anything that belongs to the game or to its release runs everything.
for(const shared of ['index.html','sw.js','manifest.webmanifest','src/ui/game-screen.js','src/landing/sub/x.css','src/landing/../ui/x.js',
 'scripts/o2switch-cron-publish.sh','scripts/o2switch-deploy-tests.py','scripts/quality-gate.mjs','scripts/ci-scope.mjs',
 '.github/workflows/quality.yml','supabase/migrations/x.sql','android/app/build.gradle','package.json','landing.html'])
 assert.equal(classifyScope(['decouvrir.html',shared]),'full','Full gate for '+shared);
// Ambiguity fails closed.
assert.equal(classifyScope([]),'full');assert.equal(classifyScope(null),'full');assert.equal(classifyScope(['decouvrir.html','']),'full');

// CLI: GitHub output, and an unreadable diff runs the full gate.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lumen-ci-scope-'));
const cli=(file)=>{const out=path.join(dir,'out-'+Math.random());fs.writeFileSync(out,'');
 const r=spawnSync(process.execPath,['scripts/ci-scope.mjs',file],{env:{...process.env,GITHUB_OUTPUT:out},encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return fs.readFileSync(out,'utf8')};
fs.writeFileSync(path.join(dir,'landing'),'decouvrir.html\r\nsrc/landing/og.jpg\n');
assert.equal(cli(path.join(dir,'landing')),'scope=landing\nrun_full=true\n');
fs.writeFileSync(path.join(dir,'docs'),'docs/UX_AND_VISUAL_DIRECTION.md\n');
assert.equal(cli(path.join(dir,'docs')),'scope=docs\nrun_full=false\n');
assert.equal(cli(path.join(dir,'missing')),'scope=full\nrun_full=true\n');
fs.rmSync(dir,{recursive:true,force:true});

// Wiring: the quality job runs the page checks and skips the game suites; the other
// required workflows skip their job (a skipped required job reports success).
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const quality=read('.github/workflows/quality.yml'),suites=read('scripts/quality-gate-browser-suites.mjs'),gate=read('scripts/quality-gate.mjs');
assert.match(quality,/git show "\$BASE_SHA:scripts\/ci-scope\.mjs" > \/tmp\/ci-scope\.mjs[^\n]*\n\s+node \/tmp\/ci-scope\.mjs \/tmp\/lumen-changed-paths/,'The base classifier decides');
assert.match(quality,/      scope: \$\{\{ steps\.scope\.outputs\.scope \}\}/);
assert.equal(quality.match(/LUMEN_QUALITY_SCOPE: \$\{\{ needs\.prepare\.outputs\.scope \|\| 'full' \}\}/g).length,2,'Node and browser jobs receive the scope');
for(const step of ['Complete cloud profile backup regression','Cross-device cloud persistence regression matrix','Guest save migration recovery regression','OAuth redirect regression'])
 assert.match(quality,new RegExp('name: '+step+"\\n\\s+if: needs\\.prepare\\.outputs\\.scope != 'landing'"),step);
assert.match(quality,/name: Validate o2switch release script syntax\n\s+run:/,'Release tests still run for the page');
assert.match(suites,/"script": "landing-browser-tests\.mjs",\n\s+"output": "ci-landing\.json",\n\s+"port": 9261/);
assert.match(gate,/plan\.scope==='landing'\?\['landing-seo-tests\.mjs'\]:nodeSuites/);
for(const [file,job] of [['.github/workflows/canonical-ledger.yml','ledger-sql'],['.github/workflows/cloud-reconciliation-matrix.yml','reconciliation']]){
 const w=read(file);
 assert.match(w,/git show "\$BASE_SHA:scripts\/ci-scope\.mjs" > \/tmp\/ci-scope\.mjs[^\n]*\n\s+node \/tmp\/ci-scope\.mjs \/tmp\/lumen-changed-paths/,file);
 assert.match(w,new RegExp('  '+job+':\\n    needs: scope\\n    if: needs\\.scope\\.outputs\\.scope != \'landing\'\\n'),file);
}
console.log('ci-scope-tests: docs, landing and full scopes, fail-closed CLI and workflow wiring OK');
