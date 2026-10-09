import {CONTENT_CONSTELLATIONS} from "./content.js";
import {generatedQuestProgress} from "./generated-progression.js";

export function mapConstellationRange(index){
 const entry=CONTENT_CONSTELLATIONS[Number(index)];
 if(!entry)return null;
 return {index:Number(index),id:entry.id,label:entry.label,packId:entry.packId,quests:[...entry.questIndices],count:entry.questCount,generated:entry.packId==="real-adventure-04"};
}
export function generatedMapSummary(index,solved={}){
 const range=mapConstellationRange(index);
 if(!range?.generated)return null;
 const completed=range.quests.filter(i=>!!solved[i]).length;
 return {name:range.label,completed,total:range.count,complete:completed===range.count,next:range.quests.find(i=>!solved[i])??null};
}
