// #695: read-only "bilan" of a completed quest, shown on the shared victory
// surface (#682). It only reads saved progress: no reward, badge, time,
// ranking or progression is written, and no celebration effect is started.
import { REWARD_SLOTS } from './victory-celebration.js';
import { recordLabel } from './personal-records.js';

export const NO_OFFICIAL_TIME = 'Pas encore de temps officiel sur cette version de la grille';

export function questReviewModel({ quest, completed = true, badges = {}, record = {}, lit = 0, count = 0, constellationName = '', format }) {
  if (!quest) throw Error('Missing reviewed quest');
  const revision = quest.gridRevision ?? 0;
  // A completed quest always owns its star; badges are the saved ones only.
  const slots = REWARD_SLOTS.map((slot) => ({
    ...slot,
    state: completed && (slot.key === 'star' || badges?.[slot.key]) ? 'owned' : 'missing',
  }));
  return Object.freeze({
    questId: quest.id,
    revision,
    kicker: 'TON BILAN · QUÊTE ' + quest.ordinal,
    title: constellationName || quest.constellationId,
    subtitle: completed ? 'Tes meilleurs résultats sur cette grille' : 'À jouer · Cette quête t’attend',
    time: completed ? recordLabel(record, format, revision) || NO_OFFICIAL_TIME : 'À jouer',
    slots,
    lit,
    count,
  });
}
