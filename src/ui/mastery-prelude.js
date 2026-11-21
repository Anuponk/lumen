// #886: prelude of the « aventure pleinement maîtrisée » celebration. Each
// constellation of the adventure appears large, one after the other, drawn in
// gold, before the existing mosaic gathers them. Presentation only: no timer or
// callback may validate a win, grant anything or write a save.
//
// Tap/click speeds it up, a second tap, « Passer », Escape or Enter skips it.
// With prefers-reduced-motion it is not played at all (final mosaic at once).
export const MASTERY_PRELUDE_TOTAL_MS = 5600;
const MIN_STEP_MS = 260,
  MAX_STEP_MS = 700,
  FADE_MS = 600,
  SPEED_UP = 4;

export function masteryPreludeTiming(count) {
  const n = Math.max(1, count);
  const step = Math.round(
    Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, (MASTERY_PRELUDE_TOTAL_MS - FADE_MS) / n)),
  );
  return { step, total: step * n + FADE_MS };
}

export function playMasteryPrelude(
  host,
  {
    figures,
    skipLabel,
    reducedMotion,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
  },
) {
  if (!host || !figures?.length || reducedMotion) return null;
  const doc = host.ownerDocument,
    { step, total } = masteryPreludeTiming(figures.length);
  const layer = doc.createElement('div');
  layer.className = 'mastery-prelude';
  layer.dataset.celestialExtra = '';
  layer.style.setProperty('--mastery-step', step + 'ms');
  layer.style.setProperty('--mastery-count', String(figures.length));
  layer.innerHTML =
    '<div class="mastery-prelude-stage" aria-hidden="true">' +
    figures
      .map(
        (figure, i) =>
          '<figure class="mastery-solo" style="--mastery-order:' +
          i +
          '">' +
          figure.svg +
          '<figcaption>' +
          figure.label +
          '</figcaption></figure>',
      )
      .join('') +
    '</div>';
  layer.querySelectorAll('.sky-line').forEach((line) => line.setAttribute('pathLength', '1'));
  const skip = doc.createElement('button');
  skip.type = 'button';
  skip.className = 'mastery-skip';
  skip.textContent = skipLabel;
  layer.append(skip);
  host.classList.add('mastery-prelude-playing');
  host.append(layer);

  let timer = null,
    fast = false,
    done = false;
  const animations = () => layer.getAnimations?.({ subtree: true }) || [];
  function finish() {
    if (done) return;
    done = true;
    if (timer !== null) clearTimer(timer);
    detach();
    layer.classList.add('mastery-prelude-leaving');
    host.classList.remove('mastery-prelude-playing');
    setTimer(() => layer.remove(), 450);
  }
  function accelerate() {
    if (fast) return finish();
    fast = true;
    for (const animation of animations()) animation.playbackRate = SPEED_UP;
    const elapsed = Math.max(0, ...animations().map((a) => Number(a.currentTime) || 0));
    if (timer !== null) clearTimer(timer);
    timer = setTimer(finish, Math.max(0, (total - elapsed) / SPEED_UP));
  }
  const onClick = (event) => {
    event.stopPropagation();
    if (event.target === skip) finish();
    else accelerate();
  };
  const onKey = (event) => {
    // The celebration may have been closed under us (clear() removes the layer).
    if (!layer.isConnected) return detach();
    if (!['Escape', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  };
  function detach() {
    layer.removeEventListener('click', onClick);
    host.removeEventListener('keydown', onKey, true);
  }
  layer.addEventListener('click', onClick);
  host.addEventListener('keydown', onKey, true);
  timer = setTimer(finish, total);
  return { finish, accelerate, playing: () => !done, total, step };
}
