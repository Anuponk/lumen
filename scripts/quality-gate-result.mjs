import {fileURLToPath} from 'node:url';
import path from 'node:path';

// GitHub aggregates all matrix children into browser. Fail closed on missing
// outputs and skipped/cancelled dependencies, including classification failures.
export function assertQualityResults({prepare,runFull,node,browser}) {
 if(prepare!=='success')throw Error('Quality scope classification did not succeed');
 if(runFull==='false') {
  if(node!=='skipped'||browser!=='skipped')throw Error('Unexpected runtime results for documentation-only PR');
 } else if(runFull==='true') {
  if(node!=='success'||browser!=='success')throw Error(`Quality incomplete: node=${node}, browser=${browser}`);
 } else throw Error('Quality scope output is missing or invalid');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 assertQualityResults({prepare:process.env.PREPARE_RESULT,runFull:process.env.RUN_FULL,
  node:process.env.NODE_RESULT,browser:process.env.BROWSER_RESULT});
 console.log(process.env.RUN_FULL==='false'?'Documentation-only PR; runtime validation not required.':'All Node and browser shards passed.');
}
