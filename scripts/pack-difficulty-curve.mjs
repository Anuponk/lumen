// Stable deterministic ordering: preserve the constellation slots and grid identities,
// while reducing large difficulty jumps within each constellation.
export function balanceDifficultyCurve(quests,questsPerConstellation){
 if(!Number.isSafeInteger(questsPerConstellation)||questsPerConstellation<1)throw Error("Invalid questsPerConstellation");
 if(!Array.isArray(quests)||quests.length%questsPerConstellation!==0)throw Error("Incomplete constellation groups");
 const balanced=[];
 for(let offset=0;offset<quests.length;offset+=questsPerConstellation){
  const group=quests.slice(offset,offset+questsPerConstellation);
  if(group.some(q=>!Number.isFinite(q.audit?.score)))throw Error("Missing audited difficulty score");
  // Sort easier -> harder, with original order as stable tie breaker.
  const sorted=group.map((quest,index)=>({quest,index})).sort((a,b)=>
   a.quest.audit.score-b.quest.audit.score||a.index-b.index);
  balanced.push(...sorted.map(x=>x.quest));
 }
 return balanced;
}
export function compareDifficultyCurves(before,after){
 const jumps=quests=>quests.slice(1).map((q,i)=>q.audit.score-quests[i].audit.score);
 const metrics=quests=>({maxPositiveJump:Math.max(0,...jumps(quests)),
  jumpsOver20:jumps(quests).filter(d=>d>20).length});
 return {before:metrics(before),after:metrics(after)};
}
