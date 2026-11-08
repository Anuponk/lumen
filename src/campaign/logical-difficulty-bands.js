// Fixed cutoffs of the audited logic-v1 score. These reproduce the initial
// revision's measured bands; a quest's Adventure never chooses its label.
export const LOGICAL_DIFFICULTY_THRESHOLDS=Object.freeze([133.5,140,149.25]);
export function logicalDifficultyTier(score){
 if(!Number.isFinite(score)||score<0)throw Error('Invalid logical difficulty score');
 return LOGICAL_DIFFICULTY_THRESHOLDS.filter(threshold=>score>=threshold).length;
}
