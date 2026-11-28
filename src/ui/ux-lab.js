const preferenceKey = (owner) => 'lumenUxVariantV1:' + owner;

export function createUxLab({ getContext, storage, busy, onChange = () => {} }) {
  let scope;
  let granted = false;
  let generation = 0;

  function reset() {
    generation++;
    granted = false;
    scope = getContext();
    onChange();
  }

  function syncScope() {
    const current = getContext();
    if (current?.owner !== scope?.owner || current?.client !== scope?.client) reset();
  }

  function ready() {
    const current = getContext();
    return (
      granted && !!current && current.owner === scope?.owner && current.client === scope.client
    );
  }

  function preference() {
    if (ready()) {
      try {
        if (storage.getItem(preferenceKey(scope.owner)) === 'v2') return 'v2';
      } catch {}
    }
    return 'v1';
  }

  async function refresh() {
    const current = getContext();
    syncScope();
    if (!current) return false;

    const request = ++generation;
    let allowed = false;
    try {
      const response = await current.client.rpc('lumen_ux_v2_access');
      allowed = !response?.error && response?.data === true;
    } catch {}

    const latest = getContext();
    if (
      request !== generation ||
      !latest ||
      current.owner !== latest.owner ||
      current.client !== latest.client
    ) {
      return false;
    }
    granted = allowed;
    onChange();
    return granted;
  }

  async function select(variant) {
    if (!['v1', 'v2'].includes(variant) || busy() || !ready()) return false;
    if (!(await refresh()) || busy() || !ready()) return false;
    try {
      storage.setItem(preferenceKey(scope.owner), variant);
    } catch {
      return false;
    }
    onChange();
    return true;
  }

  return { reset, syncScope, refresh, ready, preference, select };
}

export function mountUxLab({ host, getContext, storage, busy, t }) {
  if (!host) return null;
  const document = host.ownerDocument;
  const field = document.createElement('fieldset');
  field.hidden = true;
  const name = document.createElement('legend');
  name.dataset.gameText = 'uxLab.title';
  name.textContent = t('uxLab.title');
  const label = document.createElement('label');
  label.dataset.gameText = 'uxLab.preference';
  label.textContent = t('uxLab.preference');
  label.htmlFor = 'uxLabPreference';
  const input = document.createElement('select');
  input.id = label.htmlFor;
  for (const value of ['v1', 'v2']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.toUpperCase();
    input.append(option);
  }
  const status = document.createElement('small');
  status.setAttribute('role', 'status');
  field.append(name, label, input, status);
  host.append(field);

  function render() {
    field.hidden = !lab.ready();
    input.disabled = busy();
    input.value = lab.preference();
    status.dataset.gameText = busy() ? 'uxLab.activeAttempt' : 'uxLab.previewPending';
    status.textContent = t(status.dataset.gameText);
  }

  const lab = createUxLab({ getContext, storage, busy, onChange: render });
  input.addEventListener('change', async () => {
    const value = input.value;
    input.disabled = true;
    await lab.select(value);
    render();
  });
  return { ...lab, render };
}
