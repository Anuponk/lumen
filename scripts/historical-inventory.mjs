import fs from 'node:fs/promises';
import {inventoryHistoricalProfiles} from '../src/persistence/historical-inventory.js';
// The output contains original saves: use a private destination outside Git.
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/historical-inventory.mjs private-input.json private-output.json');
const report=await inventoryHistoricalProfiles(JSON.parse(await fs.readFile(input,'utf8')));
await fs.writeFile(output,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify({sources:report.sources.length,mutations:0}));
