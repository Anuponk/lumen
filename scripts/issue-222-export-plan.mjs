// Generate the issue #222 review report locally: node scripts/issue-222-export-plan.mjs
// Read-only. Does not publish grids or change any cloud player profile.
import {writeFileSync,mkdirSync} from "node:fs";
import {buildMigrationPlan,migrationLedger} from "./issue-222-migration-plan.mjs";
const plan=buildMigrationPlan();
const ledger=migrationLedger(plan);
mkdirSync("docs/validation",{recursive:true});
const output="docs/validation/issue-222-migration-ledger.json";
writeFileSync(output,JSON.stringify({generatedFor:"issue-222",schemaVersion:plan.schemaVersion,
 publicationReady:plan.publicationReady,total:plan.total,missing:plan.missing,
 adventures:plan.adventures,ledger},null,2)+"\\n");
console.log(output+": "+plan.total+" slots, "+plan.missing+" require audited puzzles");
