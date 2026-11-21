// #695: read-only "bilan" of a completed quest, shown on the shared victory
// surface (#682). It only reads saved progress: no reward, badge, time,
// ranking or progression is written, and no celebration effect is started.
import { REWARD_SLOTS } from './victory-celebration.js';
import { recordLabel } from './personal-records.js';
import { createTranslator } from './i18n.js';

const fr = createTranslator().t;

export const NO_OFFICIAL_TIME = fr('results.noTime');

export function questReviewModel({ quest, completed = true, badges = {}, record = {}, lit = 0, count = 0, constellationName = '', format, t = fr }) {
  if (!quest) throw Error('Missing reviewed quest');
  const revision = quest.gridRevision ?? 0;
  // A completed quest always owns its star; badges are the saved ones only.
  const slots = REWARD_SLOTS.map((slot) => ({
    ...slot,
    label: t('results.' + slot.key),
    state: completed && (slot.key === 'star' || badges?.[slot.key]) ? 'owned' : 'missing',
  }));
  return Object.freeze({
    questId: quest.id,
    revision,
    kicker: t('results.reviewQuest', { number: quest.ordinal }),
    title: constellationName || quest.constellationId,
    subtitle: completed ? t('results.bestForPuzzle') : t('results.questWaiting'),
    time: completed ? recordLabel(record, format, revision, t) || t('results.noTime') : t('results.ready'),
    slots,
    lit,
    count,
  });
}
