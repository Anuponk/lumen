const labelKeys = Object.freeze({
  availability: 'admin.critical.availability',
  hydration: 'admin.critical.hydration',
  outbox: 'admin.critical.outbox',
  backlog: 'admin.critical.backlog',
});

export function renderCriticalIncidents(host, rows, { t, acknowledge, now = Date.now() }) {
  if (!host) return;
  const doc = host.ownerDocument;
  const title = doc.createElement('h3');
  title.textContent = t('admin.critical.title');
  host.replaceChildren(title);
  if (!Array.isArray(rows) || !rows.some(row => row.sampled_at)) {
    const status = doc.createElement('p');
    status.textContent = t('admin.critical.unavailable');
    host.append(status);
    return;
  }
  for (const row of rows) {
    if (!Object.hasOwn(labelKeys, row.signature)) continue;
    const line = doc.createElement('p');
    const active = Boolean(row.opened_at && !row.resolved_at);
    const state = !row.sampled_at ? t('admin.critical.unsampled')
      : active ? t('admin.critical.active') : row.resolved_at ? t('admin.critical.resolved') : t('admin.critical.nominal');
    line.textContent = [row.severity, t(labelKeys[row.signature]), state].join(' · ');
    if (row.sampled_at && now - Date.parse(row.sampled_at) > 20 * 60_000) {
      line.append(' · ', t('admin.critical.stale'));
    }
    if (active && row.signature !== 'availability') {
      line.append(' · ', t('admin.critical.affected', { count: row.affected }));
    }
    host.append(line);
    if (!active) continue;
    const action = doc.createElement('button');
    action.type = 'button';
    action.textContent = row.acknowledged_at ? t('admin.critical.acknowledged') : t('admin.critical.ack');
    action.disabled = Boolean(row.acknowledged_at);
    action.onclick = async () => {
      action.disabled = true;
      let accepted = false;
      try { accepted = await acknowledge(row.signature, row.episode); } catch {}
      action.textContent = accepted ? t('admin.critical.acknowledged') : t('admin.critical.ackFailed');
      action.disabled = accepted;
    };
    line.append(' ', action);
  }
}
