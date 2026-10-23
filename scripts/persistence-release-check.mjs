import fs from 'node:fs/promises';
import {evaluatePersistenceRollout} from '../src/persistence/rollout-gates.js';
const [input,stage='activate']=process.argv.slice(2);
if(!input||!['activate','retire'].includes(stage))throw Error('Usage: node scripts/persistence-release-check.mjs private-evidence.json [activate|retire]');
const result=evaluatePersistenceRollout(JSON.parse(await fs.readFile(input,'utf8')));
console.log(JSON.stringify(result,null,2));
if(!result[stage])process.exitCode=1;
