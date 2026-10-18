import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = path => fs.readFileSync(path, "utf8");
const fail = message => { console.error("DOC CONTRACT: " + message); process.exitCode = 1; };
const check = (condition, message) => { if (!condition) fail(message); };

const performance = read("src/campaign/performance.js");
const progression = read("docs/PROGRESSION.md");
const gameplay = read("docs/GAMEPLAY.md");
const agents = read("AGENTS.md");
const map = read("docs/architecture/feature-map.md");
const pkg = JSON.parse(read("package.json"));

const badges = performance.match(/PERFORMANCE_BADGES=Object\.freeze\(\[([^\]]+)\]\)/)?.[1]?.match(/"[^"]+"/g)?.map(x => JSON.parse(x)) || [];
check(badges.length > 0, "Cannot parse performance badge definitions; update checker if source format changed");
const labels = {autonomy:"Autonomie",speed:"Rapidité",noError:"Sans erreur",mastery:"Maîtrise"};
for (const id of badges) check(progression.includes(labels[id] || ("UNMAPPED_" + id)), "PROGRESSION missing badge " + id);
check(progression.includes("four badges") === (badges.length === 4), "Badge count in PROGRESSION differs from source");
const speed = performance.match(/return\s+(\d+);\s*\n\}/)?.[1];
check(!!speed, "Cannot parse speed target; review check after refactor");
if (speed) check(progression.includes(speed + " seconds"), "PROGRESSION speed target differs from source");
check(gameplay.includes("no wallet cap") && progression.includes("no wallet cap"), "Shard cap descriptions disagree");
check(pkg.scripts?.["test:affected"] && pkg.scripts?.["test:full"], "Missing documented test commands");
check(map.includes("package.json"), "Feature map must mention package.json");
check(agents.includes("docs/architecture/feature-map.md"), "AGENTS must link feature map");

const base = process.env.DOCS_BASE_REF;
if (base) {
  let changed = [];
  try { changed = execFileSync("git", ["diff", "--name-only", base + "...HEAD"], {encoding:"utf8"}).trim().split("\n").filter(Boolean); }
  catch { fail("Unable to diff against " + base + "; cannot verify documentation coverage"); }
  const groups = [
    {code:/^src\/campaign\/(performance|progression|daily-engagement)\.js$/,docs:["docs/PROGRESSION.md"]},
    {code:/^src\/game\/|^src\/campaign\/data\.js$/,docs:["docs/GAMEPLAY.md","docs/GRID_CATALOG.md"]},
    {code:/^src\/persistence\/|^supabase\/migrations\//,docs:["docs/DATA_AND_ARCHITECTURE.md"]},
    {code:/^scripts\/test-affected\.mjs$|^\.github\/workflows\//,docs:["docs/TESTING.md","docs/architecture/test-map.md"]},
  ];
  for (const group of groups) if (changed.some(p => group.code.test(p)) && !group.docs.some(p => changed.includes(p))) {
    fail("Changed code requires updating/reviewing one owning document: " + group.docs.join(" or "));
  }
}
if (!process.exitCode) console.log("Documentation source-of-truth and change coverage checks passed.");
