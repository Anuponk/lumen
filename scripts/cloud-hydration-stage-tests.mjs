import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const part=s.slice(s.indexOf('afterAuthCloudSync:async()=>'),s.indexOf('},holdLegacyMergeForFullRestore'));
for(const stage of ['local_read','cloud_restore','cloud_initialize','daily_rpc','daily_reconcile','daily_cloud_commit','owner_backup','local_install'])assert(part.includes('hydrationStage="'+stage+'"'),stage);
assert.match(part,/stage:String\(e\?\.stage\|\|hydrationStage\)/);
assert.match(part,/reason:e\?\.message\?\.startsWith\("Profil local divergent"\)\?"local_divergence"/);
assert.doesNotMatch(part,/recordCloudDiagnostic\("hydration_failed",\{[^\n]*message:/);
console.log('Hydration failure stage and safe error categorization passed');
