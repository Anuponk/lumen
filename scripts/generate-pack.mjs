#!/usr/bin/env node
// Issue #98 - read-only adventure planning. No catalogue or save data is modified.
import fs from "node:fs";
import {generateAuditedPack} from "./pack-generation-audit.mjs";
import {buildDifficultyReport,stageAdventure} from "./pack-staging.mjs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {CONTENT_SKIES,CONTENT_PACKS,BASE_CONSTELLATIONS,baseCampaignQuestCount} from "../src/campaign/content.js";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2);
const fail=message=>{throw new Error(message)};
if(args.includes("--help")){
 console.log("Usage: node scripts/generate-pack.mjs --dry-run|--generate [--config path/to/pack.json] [--seed integer]");
 process.exit(0);
}
const generate=args.includes("--generate");
if(generate===args.includes("--dry-run"))fail("Choose exactly one of --dry-run or --generate. No catalogue writes are supported.");
const valueOf=flag=>{
 const i=args.indexOf(flag);
 if(i<0)return null;
 if(!args[i+1]||args[i+1].startsWith("--"))fail(flag+" requires a value");
 return args[i+1];
};
const allowed=new Set(["--dry-run","--generate","--config","--seed"]);
for(let i=0;i<args.length;i++){
 if(!args[i].startsWith("--"))continue;
 if(!allowed.has(args[i]))fail("Unknown option: "+args[i]);
 if(!["--dry-run","--generate"].includes(args[i]))i++;
}
const configPath=path.resolve(root,valueOf("--config")||"content/pack-example.json");
if(!fs.existsSync(configPath))fail("Configuration not found: "+configPath);
const config=JSON.parse(fs.readFileSync(configPath,"utf8"));
const errors=[];
const check=(ok,message)=>{if(!ok)errors.push(message)};
const idPattern=/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const isPositiveInt=n=>Number.isInteger(n)&&n>0;
const seedRaw=valueOf("--seed")??config.seed??1;
const seed=Number(seedRaw);
check(Number.isSafeInteger(seed)&&seed>=0,"seed must be a non-negative safe integer");
check(typeof config.id==="string"&&idPattern.test(config.id),"id must be a stable kebab-case identifier");
check(typeof config.displayName==="string"&&config.displayName.trim().length>0,"displayName is required");
check(typeof config.skyId==="string"&&CONTENT_SKIES.some(s=>s.id===config.skyId),"skyId must refer to an existing sky");
check(["real","extraordinary","event","expert"].includes(config.type),"type must be real, extraordinary, event or expert");
check(["included","locked","entitlement"].includes(config.access),"access must be included, locked or entitlement");
check(isPositiveInt(config.questsPerConstellation),"questsPerConstellation must be a positive integer");
check(Array.isArray(config.sizes)&&config.sizes.length>0&&config.sizes.every(n=>isPositiveInt(n)&&n>=4),"sizes must contain grid sizes >= 4");
check(Array.isArray(config.constellations)&&config.constellations.length>0,"constellations must be a non-empty array");
check(Number.isInteger(config.order)&&config.order>=0,"order must be a non-negative integer");
const existingIds=new Set([...CONTENT_PACKS.map(p=>p.id),...BASE_CONSTELLATIONS.map(c=>c.id)]);
check(!existingIds.has(config.id),"pack ID collides with published content");
check(!CONTENT_PACKS.some(p=>p.skyId===config.skyId&&p.order===config.order),"pack order collides within the sky");
const constellationIds=new Set();
for(const [i,c] of (Array.isArray(config.constellations)?config.constellations:[]).entries()){
 check(typeof c.id==="string"&&idPattern.test(c.id),"constellation "+(i+1)+" needs a stable kebab-case id");
 check(typeof c.name==="string"&&c.name.trim().length>0,"constellation "+(i+1)+" needs a name");
 check(!existingIds.has(c.id),"constellation ID already published: "+c.id);
 check(!constellationIds.has(c.id),"duplicate constellation ID: "+c.id);
 constellationIds.add(c.id);
}
if(errors.length){console.error(JSON.stringify({ok:false,errors},null,2));process.exitCode=1}
else {
 const start=baseCampaignQuestCount()+1;
 const count=config.constellations.length*config.questsPerConstellation;
 const result=generate?generateAuditedPack({sizes:config.sizes,questCount:count,seed}):null;
 const plan={
  ok:true,mode:generate?"generate-preview":"dry-run",seed,
  pack:{id:config.id,name:config.displayName,skyId:config.skyId,type:config.type,access:config.access,order:config.order},
  baseline:{publishedQuests:baseCampaignQuestCount(),publishedConstellations:BASE_CONSTELLATIONS.length,publishedPacks:CONTENT_PACKS.length},
  proposed:{constellations:config.constellations.map(c=>({id:c.id,name:c.name})),questCount:count,questNumbers:{first:start,last:start+count-1},sizes:config.sizes},
  ...(result?{generation:{quests:result.generated.map((p,i)=>({quest:start+i,...p})),rejections:result.rejections,difficulty:buildDifficultyReport(result.generated,config.difficulty?.distribution)}}:{}),
  safety:{catalogueChanged:false,publishedQuestIdsPreserved:true},
  pending:generate?["apply and persistence regression tests","catalogue publication"]:["grid generation","unique-solution audit","difficulty scoring","deduplication","apply and persistence regression tests"]
 };
 if(result){
  plan.staging=stageAdventure({config,plan,generated:result.generated});
  if(config.difficulty?.distribution&&!plan.generation.difficulty.targetMatches){
   plan.ok=false;plan.warnings=["Generated difficulty distribution differs from configured target by more than 15 percentage points. No catalogue modified."];
  }
 }
 console.log(JSON.stringify(plan,null,2));
 if(!plan.ok)process.exitCode=1;
}