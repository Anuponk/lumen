// #962: one visible « Transmettre mon diagnostic » action. It reuses the existing
// assistance session (#574/#776): the Lumen dialog states what is sent, to whom and for
// how long, and only its explicit confirmation activates the 24 h dossier and sends one
// manual capture. Cancel sends nothing. The detailed panel keeps preview and withdrawal.
const DONE = new Set(['confirmed', 'expired', 'unavailable', 'deleted', 'disabled', 'revoking']);
export function createSupportQuickSend({
  session,
  dialog,
  t,
  button,
  status,
  now = () => Date.now(),
  schedule = (fn, ms) => setTimeout(fn, ms),
  timeoutMs = 45000,
  pollMs = 400,
}) {
  let running = false;
  const say = (text) => {
    if (status) {
      status.textContent = text;
      status.hidden = !text;
    }
  };
  const activeDossier = (v) =>
    v?.dossier?.state === 'active' && Date.parse(v.dossier.expires_at) > now();
  const wait = (ms) => new Promise((resolve) => schedule(resolve, ms));
  async function settle() {
    const end = now() + timeoutMs;
    let v = session().view();
    while (!DONE.has(v.state) && !(v.state === 'offline') && now() < end) {
      await wait(pollMs);
      v = session().view();
    }
    return v;
  }
  async function run() {
    if (running) return;
    running = true;
    if (button) button.disabled = true;
    say(t('support.quickSending'));
    try {
      const s = session();
      if (!s) {
        say(t('support.quickFailed'));
        return;
      }
      if (!activeDossier(s.view())) {
        await s.activate(true);
        if (!activeDossier(s.view())) {
          say(t('support.quickFailed'));
          return;
        }
      }
      if (s.view().state === 'review') s.discard();
      await s.send('manual');
      const v = await settle();
      if (v.state === 'confirmed')
        say(t('support.quickDone', { reference: String(v.dossier?.id || '') }));
      else if (v.state === 'offline') say(t('support.quickOffline'));
      else say(t('support.quickFailed'));
    } catch {
      say(t('support.quickFailed'));
    } finally {
      running = false;
      if (button) button.disabled = false;
    }
  }
  function open() {
    if (running) return;
    dialog().open({
      title: t('support.quickTitle'),
      copy: t('support.quickCopy'),
      confirm: t('support.quickAccept'),
      cancel: t('app.cancel'),
      returnFocus: button,
      onConfirm: () => {
        void run();
      },
    });
  }
  return { open, run };
}
