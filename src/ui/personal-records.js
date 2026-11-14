import { validRecordTime } from '../campaign/personal-records.js';
import { officialRecordTime, officialResult } from '../campaign/official-time.js';
export function recordLabel(record, format, revision = 0) {
  const best = officialRecordTime(record, revision);
  return validRecordTime(best) ? 'Record : ' + format(best) : '';
}
export function renderRecordResult(
  element,
  previous,
  confirmed,
  facts,
  format,
  { reused = false } = {},
) {
  if (!element) return;
  const revision = facts?.timing?.gridRevision ?? 0;
  const best = officialRecordTime(confirmed, revision);
  const before = officialRecordTime(previous, revision);
  const seconds = officialResult(facts).score;
  // A raw receipt, or a public ranking improvement, is not proof of a private record.
  const improved =
    !reused && !!facts.timing && best === seconds && (!validRecordTime(before) || seconds < before);
  const label = recordLabel(confirmed, format, revision);
  element.hidden = !label;
  element.classList.toggle('personal-record-new', improved);
  const message = improved ? 'Nouveau record !' : '';
  const delta = validRecordTime(best) && !!facts.timing ? seconds - best : null;
  element.textContent = [
    message,
    label,
    !message && delta !== null
      ? delta === 0
        ? 'Record égalé'
        : 'Écart : ' + (delta > 0 ? '+' : '−') + format(Math.abs(delta))
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
