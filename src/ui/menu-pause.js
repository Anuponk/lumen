// #925: opening a menu or dialog over a live quest uses the existing pause (the
// attempt engine, exactly like the Pause button): the official clock stops and the
// opaque attempt mask hides the grid. No second clock and no new attempt state.
//
// - Only a RUNNING attempt is paused, and only that one is resumed, once, when
//   the last menu closes (after a short grace period so a chained menu never
//   exposes the grid or restarts the clock in between).
// - An attempt that was already paused (Pause button, background, reload) stays
//   paused: the player's own intent wins.
// - hold() covers a menu that is still loading before it becomes visible.
// - release() forgets the pending resume; backgrounding the app calls it, because
//   returning to the game never silently resumes an attempt.
export const MENU_PAUSE_GRACE_MS = 150;

export function createMenuPause({
  document: doc,
  ids,
  running,
  paused,
  attemptId,
  pause,
  resume,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
  graceMs = MENU_PAUSE_GRACE_MS,
}) {
  let held = null,
    timer = null,
    loading = 0;
  const elements = () => ids.map((id) => doc.getElementById(id)).filter(Boolean);
  const isOpen = (el) => (el.tagName === 'DIALOG' ? !!el.open : !el.hidden);
  const anyOpen = () => loading > 0 || elements().some(isOpen);

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }
  function settle() {
    timer = null;
    if (!held || anyOpen()) return;
    const current = held;
    held = null;
    if (current.resume && paused() && attemptId() === current.attemptId) resume();
  }
  function sync() {
    if (anyOpen()) {
      cancelTimer();
      held ??= { resume: false, attemptId: null };
      if (running()) {
        pause();
        held.resume = true;
        held.attemptId = attemptId();
      }
      return;
    }
    if (held && timer === null) timer = setTimer(settle, graceMs);
  }
  function release() {
    if (held) held.resume = false;
  }
  // A menu still loading its content (e.g. « Mes défis » after the social hub
  // stepped aside) keeps the pause until it is shown; call the result once done.
  function hold() {
    let done = false;
    loading++;
    sync();
    return () => {
      if (done) return;
      done = true;
      loading--;
      sync();
    };
  }

  const Observer = doc.defaultView?.MutationObserver;
  if (Observer) {
    const observer = new Observer(sync);
    for (const el of elements())
      observer.observe(el, { attributes: true, attributeFilter: ['hidden', 'open'] });
  }
  return { sync, release, hold, holding: () => !!held, open: anyOpen };
}
