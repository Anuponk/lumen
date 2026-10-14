// Single deterministic difficulty contract for all canonical quests.
// Derived from puzzle proof complexity, never from a mutable player rating.
export const DIFFICULTY_LABELS=Object.freeze(["Facile","Intermédiaire","Difficile","Expert"]);
export function qualifyDifficulty(quest){
 const size=Number(quest?.size??quest?.reg?.length);
 const proof=Number(quest?.audit?.proofSteps);
 const rules=quest?.audit?.rules||{};
 const locked=Number(rules.locked)||0,group=Number(rules.group)||0;
 const regions=new Set((quest?.reg||[]).flat()).size;
 // Proof length and advanced deduction dominate; board size is secondary.
 // Missing historical proofs use a reproducible structural estimate.
 const hasProof=Number.isFinite(proof)&&proof>=0;
 const workload=hasProof?proof:Math.max(0,(size||6)*2+regions);
 const score=Math.round(workload+group*1.4+locked*0.7+Math.max(0,(size||6)-5)*3);
 const label=score<25?"Facile":score<45?"Intermédiaire":score<75?"Difficile":"Expert";
 return Object.freeze({label,score,version:"canonical-proof-v1",calibrated:hasProof});
}
