import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const screen = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
const cloud = readFileSync(new URL('../src/persistence/cloud.js', import.meta.url), 'utf8');
const oauthCalls = [...screen.matchAll(/signIn\(([^)]*(?:\([^)]*\))?[^)]*)\)/g)].map(m=>m[0]);
assert.equal((screen.match(/signIn\(new URL\("\/", location\.origin\)\.toString\(\)\)/g)||[]).length, 2, 'Account offer and menu must return to active origin');
assert.ok(!screen.includes('signIn("https://lumen-xi-seven.vercel.app/")'), 'OAuth return must not target Vercel');
assert.match(cloud, /auth\.signInWithOAuth\(\{provider:"google",options:\{redirectTo:target\}\}\)/, 'OAuth API must receive redirectTo');
console.log('OAuth return origin checks passed');
