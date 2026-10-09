#!/usr/bin/env node
// Generate a reproducible, reviewable 100-quest manifest. Never publish.
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {validateStagedAdventure} from "./pack-publication-validation.mjs";
import {BASE_CONSTELLATIONS,CONTENT_PACKS,baseCampaignQuestCount} from "../src/campaign/content.js";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const config="content/first-adventure-preview.json";
const out=path.join(root,"artifacts","first-adventure-generated.json");
const command=spawnSync(process.execPath,["scripts/generate-pack.mjs","--generate","--config",config],{cwd:root,encoding:"utf8",maxBuffer:64*1024*1024});
if(command.status!==0){
 console.error(command.stderr||command.stdout||"Generator failed");
 process.exit(1);
}
let plan;
try{plan=JSON.parse(command.stdout)}catch{throw Error("Generator did not return valid JSON")}
const manifest=plan.staging;
const review=validateStagedAdventure(manifest,{
 existingPacks:CONTENT_PACKS,existingConstellations:BASE_CONSTELLATIONS,publishedQuestCount:baseCampaignQuestCount()
});
if(!plan.ok||!review.ok||manifest?.constellations?.length!==10||manifest?.quests?.length!==100)throw Error("Generated adventure did not pass the 10-constellation / 100-quest review gate: "+review.errors.join("; "));
if(manifest.quests.some(q=>q.audit?.solutions!==1||q.audit?.ok!==true))throw Error("Quest without proof of uniqueness");
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify({generatedAt:null,config,seed:plan.seed,review,manifest,difficulty:plan.generation.difficulty,curve:plan.generation.curve},null,2)+"\n");
console.log("Generated and audited 100 quests: "+out);
