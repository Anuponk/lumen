import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
for(const key of ['function recordCloudDiagnostic','function cloudDiagnosticReport','flush_blocked','flush_failed','flush_conflict','victory_preflight','victory_dialog','hydration_failed','hydration_ready','Copier le diagnostic'])assert(src.includes(key),key);
const section=src.slice(src.indexOf('function recordCloudDiagnostic'),src.indexOf('async function flushCloudProfile'));
assert(!/JSON\.stringify\(lumenProgress\)|lumenUser\?\.id|email|access_token|refresh_token/.test(section),'Diagnostics must not leak progress, identity or tokens');
assert(src.includes('previous.slice(-39)'),'Local log storage stays bounded');
console.log('Privacy-safe cloud diagnostics contract passed');
