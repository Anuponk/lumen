// #728: the client only *asks* the server to unlock the next Adventure once the previous
// one looks 100% mastered locally. The server recomputes mastery from its own records
// and is the only one that grants (source "mastery"). Pure helpers, no I/O here.
import {questCompleted} from '../campaign/catalogue-access.js';
import {PERFORMANCE_BADGES} from '../campaign/performance.js';

// Match the server's Adventure mastery projection, including older canonical
// victories recorded only as runPerformance and legacy badges from version 2.
export function adventureMastery(quests, progress={}) {
 let missingQuests=0,missingBadges=0;
 for(const quest of quests){
  const legacy=quest.legacyIndex!==null;
  const record=legacy?progress.performances?.[quest.legacyIndex]:progress.canonicalQuestState?.[quest.id];
  if(!questCompleted(quest,progress)&&(legacy||!Object.hasOwn(record??{},'runPerformance')))missingQuests++;
  const badges=legacy&&!(typeof record?.version==='number'&&record.version>=2)?null:record?.badges;
  missingBadges+=PERFORMANCE_BADGES.filter(key=>badges?.[key]!==true).length;
 }
 return {missingQuests,missingBadges,mastered:quests.length>0&&missingQuests===0&&missingBadges===0};
}

const entitlementId=e=>typeof e==='string'?e:e?.entitlement;

// Locked, not yet owned Adventures whose previous Adventure (catalogue order) is
// mastered in the local progress view.
export function masteryUnlockCandidates({packs,quests,progress,entitlements}){
 const owned=new Set((entitlements||[]).map(entitlementId).filter(Boolean));
 const ordered=[...(packs||[])].sort((a,b)=>a.order-b.order);
 const out=[];
 for(let i=1;i<ordered.length;i++){
  const pack=ordered[i],previous=ordered[i-1];
  if(pack.access!=='locked'||owned.has(pack.id))continue;
  if(adventureMastery((quests||[]).filter(q=>q.packId===previous.id),progress||{}).mastered)out.push(pack.id);
 }
 return out;
}

// Calls the server once per candidate; never throws. Returns the Adventures actually unlocked.
export async function claimMasteryUnlocks({client,owner,candidates,stillCurrent=()=>true}){
 const unlocked=[];
 for(const adventure of candidates||[]){
  if(!client||!owner||!stillCurrent())break;
  try{
   const {data,error}=await client.rpc('lumen_claim_mastery_unlock',{p_expected_user_id:owner,p_adventure:adventure});
   if(!stillCurrent())break;
   if(!error&&data?.mastered&&data?.changed)unlocked.push(adventure);
  }catch(_){/* offline or older server: retried at the next launch */}
 }
 return unlocked;
}
