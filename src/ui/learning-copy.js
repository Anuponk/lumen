
import { createTranslator } from './i18n.js';

const intro = ['observe', 'goal', 'oneTerritory', 'oneRowColumn', 'keepApart', 'cycle'];
const phases = new Set(['row', 'column', 'neighbors', 'territory', 'reuse', 'practice']);
const placementLessons = { 2: 'deduce', 3: 'find' };

export function lessonText(t, lesson) {
  return { title: t(`learning.${lesson}.title`), copy: t(`learning.${lesson}.copy`) };
}

export function learningIntro(t) {
  return intro.map(lesson => lessonText(t, lesson));
}

export function learningCopy(step, state, coarse = false, t = createTranslator().t) {
  if (step.dragLesson) {
    const lesson = step.phase === 'place'
      ? (state[0][0] === 1 ? 'dragMarked' : 'dragFirst')
      : (coarse ? 'dragLessonTouch' : 'dragLessonMouse');
    return lessonText(t, lesson);
  }
  if (step.phase === 'place') {
    const [row, col] = step.target;
    const marked = state[row][col] === 1;
    if (step.number === 1) return lessonText(t, marked ? 'firstMarked' : 'first');
    if (marked) return lessonText(t, 'marked');
    return lessonText(t, placementLessons[step.number] ?? 'apply');
  }
  if (step.phase === 'drag') return lessonText(t, coarse ? 'dragTouch' : 'dragMouse');
  return phases.has(step.phase) ? lessonText(t, step.phase) : { title: '', copy: '' };
}
