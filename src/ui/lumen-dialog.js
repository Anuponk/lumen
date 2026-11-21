// #921: one accessible in-game confirmation instead of the browser's native
// confirm() (« lumen.nopuna.fr indique »). Presentation only: the caller owns the
// business rule and runs it synchronously in onConfirm.
//
// The root is an existing overlay whose parts are marked with
// data-dialog-title / -copy / -confirm / -cancel. Cancel is the safe default:
// initial focus, Escape, backdrop and the system Back gesture all cancel.
export function createLumenDialog(
  root,
  { document: doc = root.ownerDocument, window: win = doc.defaultView } = {},
) {
  const part = (name) => root.querySelector('[data-dialog-' + name + ']');
  const title = part('title'),
    copy = part('copy'),
    yes = part('confirm'),
    no = part('cancel');
  let active = null,
    pendingBack = 0;
  const history = win?.history;

  function focusables() {
    return [
      ...root.querySelectorAll(
        'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((node) => !node.disabled && !node.hidden && node.getClientRects().length);
  }
  function settle(confirmed) {
    if (!active) return;
    const current = active;
    active = null;
    root.hidden = true;
    delete root.dataset.tone;
    // Drop the history entry pushed at opening so Back keeps its usual meaning.
    if (current.token && history?.state?.lumenDialog === current.token) {
      pendingBack++;
      history.back();
    }
    const back = current.returnFocus;
    if (back?.isConnected && !back.closest('[hidden]')) back.focus({ preventScroll: true });
    (confirmed ? current.onConfirm : current.onCancel)?.();
  }
  function open({
    title: heading,
    copy: text,
    confirm,
    cancel,
    tone = 'default',
    onConfirm,
    onCancel,
    returnFocus = doc.activeElement,
  }) {
    if (active) settle(false);
    if (heading !== undefined) title.textContent = heading;
    if (text !== undefined) copy.textContent = text;
    if (confirm !== undefined) yes.textContent = confirm;
    if (cancel !== undefined) no.textContent = cancel;
    root.dataset.tone = tone;
    active = { onConfirm, onCancel, returnFocus, token: null };
    // Android (TWA/PWA) Back closes the dialog instead of leaving the game.
    // Skipped while a previous entry is still being removed, to avoid racing it.
    if (history?.pushState && !pendingBack) {
      try {
        const token = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const state = history.state && typeof history.state === 'object' ? history.state : {};
        history.pushState({ ...state, lumenDialog: token }, '', win.location.href);
        active.token = token;
      } catch {
        active.token = null;
      }
    }
    root.hidden = false;
    no.focus({ preventScroll: true });
  }

  root.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      settle(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusables(),
      first = nodes[0],
      last = nodes.at(-1);
    if (!nodes.includes(doc.activeElement)) {
      event.preventDefault();
      first?.focus();
    } else if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  root.addEventListener('click', (event) => {
    if (event.target === root) settle(false);
  });
  yes.addEventListener('click', () => settle(true));
  no.addEventListener('click', () => settle(false));
  win?.addEventListener('popstate', () => {
    if (pendingBack) {
      pendingBack--;
      return;
    }
    if (active?.token && history?.state?.lumenDialog !== active.token) {
      active.token = null;
      settle(false);
    }
  });
  return { open, close: () => settle(false), isOpen: () => !!active };
}
