// #959: short explanations on demand instead of paragraphs next to the actions.
// Markup: <span class="tip"><button class="tip-button" type="button" aria-expanded="false"
// aria-controls="ID" data-game-label="app.moreInfo">ⓘ</button><span id="ID" class="tip-bubble"
// role="status" hidden>…</span></span>
// A tap or Enter/Space toggles the bubble, Escape or a tap elsewhere closes it, and
// only one bubble is open at a time. The bubble is a polite live region, so screen
// readers announce it when it opens; focus stays on the button.
export function setupToggletips(root = document) {
  const doc = root.ownerDocument || root;
  const buttons = () => [...root.querySelectorAll('.tip-button[aria-controls]')];
  const bubbleOf = (button) => doc.getElementById(button.getAttribute('aria-controls'));
  function close(button) {
    const bubble = bubbleOf(button);
    button.setAttribute('aria-expanded', 'false');
    if (bubble) bubble.hidden = true;
  }
  function closeAll(except = null) {
    for (const button of buttons())
      if (button !== except && button.getAttribute('aria-expanded') === 'true') close(button);
  }
  function toggle(button) {
    const bubble = bubbleOf(button);
    if (!bubble) return;
    const open = button.getAttribute('aria-expanded') !== 'true';
    closeAll(button);
    button.setAttribute('aria-expanded', String(open));
    bubble.hidden = !open;
  }
  root.addEventListener(
    'click',
    (event) => {
      const button = event.target.closest?.('.tip-button[aria-controls]');
      if (button && root.contains(button)) {
        // A tip never triggers the surrounding control (summary, label, menu row).
        event.preventDefault();
        event.stopPropagation();
        toggle(button);
        return;
      }
      if (!event.target.closest?.('.tip-bubble')) closeAll();
      // Capture: menus stop click propagation, tips must still work inside them.
    },
    true,
  );
  root.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      const open = buttons().find((button) => button.getAttribute('aria-expanded') === 'true');
      if (!open) return;
      // Escape closes the bubble first; the menu or dialog stays open.
      event.stopPropagation();
      close(open);
      open.focus();
    },
    true,
  );
  return { closeAll };
}

// One section open at a time, also on browsers without <details name> support.
export function setupExclusiveSections(container) {
  if (!container) return;
  container.addEventListener(
    'toggle',
    (event) => {
      const opened = event.target;
      if (
        !(opened instanceof container.ownerDocument.defaultView.HTMLDetailsElement) ||
        !opened.open
      )
        return;
      for (const other of container.querySelectorAll('details[open]'))
        if (other !== opened && other.parentElement === opened.parentElement) other.open = false;
    },
    true,
  );
}
