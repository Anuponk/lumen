const healthKeys = Object.freeze({
  unavailable: 'admin.health.unavailable',
  status: 'admin.health.status',
  unknown: 'admin.health.unknown',
  stale: 'admin.health.stale',
  outage: 'admin.health.outage',
  unstable: 'admin.health.unstable',
  healthy: 'admin.health.healthy',
  version: 'admin.health.version',
  severity: 'admin.health.severity',
  all: 'admin.health.all',
  active: 'admin.health.active',
  recentErrors: 'admin.health.recentErrors',
  performance: 'admin.health.performance',
  empty: 'admin.health.empty',
  paymentMissing: 'admin.health.paymentMissing',
  regressed: 'admin.health.regressed',
  small: 'admin.health.small',
  confidence_medium: 'admin.health.confidence_medium',
  confidence_high: 'admin.health.confidence_high',
  age: 'admin.health.age',
  recentSignups: 'admin.health.recentSignups',
  signupsCount: 'admin.health.signupsCount',
  email: 'admin.health.email',
  recentPurchases: 'admin.health.recentPurchases',
  purchasesCount: 'admin.health.purchasesCount',
  money: 'admin.health.money',
  notifications: 'admin.health.notifications',
  mail_queued: 'admin.health.mail_queued',
  mail_sending: 'admin.health.mail_sending',
  mail_accepted: 'admin.health.mail_accepted',
  mail_rejected: 'admin.health.mail_rejected',
  mail_unknown: 'admin.health.mail_unknown',
  load: 'admin.health.load',
  grid_render: 'admin.health.grid_render',
  grid_input: 'admin.health.grid_input',
  long_task: 'admin.health.long_task',
  victory_gap: 'admin.health.victory_gap',
  cloud_rpc: 'admin.health.cloud_rpc',
  sync_rpc: 'admin.health.sync_rpc',
  hydration_error_rate: 'admin.health.hydration_error_rate',
});
const incidentKeys = Object.freeze({
  availability: 'admin.critical.availability', hydration: 'admin.critical.hydration',
  outbox: 'admin.critical.outbox', backlog: 'admin.critical.backlog',
});
const severities = ['P0', 'P1', 'P2'];
const metricKeys = ['load','grid_render','grid_input','long_task','victory_gap','cloud_rpc','sync_rpc','hydration_error_rate'];
const availabilityStates = ['unknown','stale','outage','unstable','healthy'];
const deliveryStates = ['queued','sending','accepted','rejected','unknown'];

export function filterHealthRows(data, { version = '', severity = '' } = {}) {
  return {
    active: data.active.filter(row => !severity || row.severity === severity),
    errors: data.errors.filter(row => (!version || row.version === version) && (!severity || row.severity === severity)),
    performance: data.performance.filter(row => (!version || row.version === version || row.reference === version)
      && (!severity || (severity === 'P1' && row.regression))),
  };
}

// #947: freshness of the last observation, in whole minutes (null when unknown).
export function observationAgeMinutes(value, now = Date.now()) {
  const at = Date.parse(value || '');
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 60000)) : null;
}

export function renderHealthCockpit(host, data, { t, now = Date.now() } = {}) {
  if (!host) return;
  const doc = host.ownerDocument;
  const language = doc.documentElement.lang || 'fr';
  const formatNumber = new Intl.NumberFormat(language);
  const formatDate = new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' });
  const date = value => value && Number.isFinite(Date.parse(value)) ? formatDate.format(new Date(value)) : '—';
  const make = (tag, copy) => {
    const item = doc.createElement(tag);
    if (copy !== undefined) item.textContent = copy;
    return item;
  };
  const translate = key => t(healthKeys[key]);
  const heading = make('h3', t('admin.health.title'));
  host.replaceChildren(heading);
  if (!data || !Array.isArray(data.errors)) {
    host.append(make('p', translate('unavailable')));
    return;
  }
  const availability = data.availability?.state;
  const status = make('p', t('admin.health.status', {
    status: translate(availabilityStates.includes(availability) ? availability : 'unknown'),
    date: date(data.availability?.sampled_at),
  }));
  const age = observationAgeMinutes(data.availability?.sampled_at, now);
  if (age !== null) status.append(' · ' + t(healthKeys.age, { count: formatNumber.format(age) }));
  status.dataset.freshness = availability === 'stale' ? 'stale' : age === null ? 'unknown' : 'fresh';
  host.append(status);

  const filters = make('div');
  filters.className = 'admin-cockpit-filters';
  function select(labelKey, values) {
    const label = make('label', translate(labelKey) + ' ');
    const input = make('select');
    const all = make('option', translate('all'));
    all.value = '';
    input.append(all);
    for (const value of values) {
      const option = make('option', value);
      option.value = value;
      input.append(option);
    }
    label.append(input);
    filters.append(label);
    return input;
  }
  const previous = host.healthFilters;
  const versions = [...new Set([...data.performance.flatMap(row => [row.version, row.reference]),
    ...data.errors.map(row => row.version)].filter(Boolean))];
  const version = select('version', versions);
  const severity = select('severity', severities);
  if (versions.includes(previous?.version)) version.value = previous.version;
  if (severities.includes(previous?.severity)) severity.value = previous.severity;
  const details = make('div');
  details.className = 'analytics-engagement';
  const metric = value => metricKeys.includes(value) ? translate(value) : '—';
  const signature = value => ['availability','hydration','outbox','backlog'].includes(value)
    ? t(incidentKeys[value]) : translate('paymentMissing');
  function list(key, rows) {
    const section = make('section');
    section.className = 'analytics-block';
    section.append(make('h4', translate(key)));
    if (rows.length === 0) section.append(make('p', translate('empty')));
    else {
      const items = make('ul');
      for (const row of rows) items.append(make('li', row));
      section.append(items);
    }
    return section;
  }
  function renderFiltered() {
    const choice = { version: version.value, severity: severity.value };
    host.healthFilters = choice;
    const rows = filterHealthRows(data, choice);
    details.replaceChildren(
      list('active', rows.active.map(row => [row.severity, signature(row.signature), date(row.opened_at),
        row.signature === 'availability' ? '' : t('admin.critical.affected', { count: row.affected })].filter(Boolean).join(' · '))),
      list('recentErrors', rows.errors.map(row => [row.severity, row.metric ? metric(row.metric) : signature(row.signature),
        row.version, date(row.observed_at)].filter(Boolean).join(' · '))),
      list('performance', rows.performance.map(row => {
        const current = row.version + ' · ' + row.p90 + ' ms (' + row.samples + ')';
        const prior = row.reference ? row.reference + ' · ' + row.reference_p90 + ' ms (' + row.reference_samples + ')' : '—';
        // #948: the server states the confidence (floor configurable without redeploy).
        const reading = [row.regression ? translate('regressed') : '',
          row.confidence === 'high' ? translate('confidence_high') : row.confidence === 'medium'
            ? translate('confidence_medium') : translate('small')].filter(Boolean).join(' · ');
        return [metric(row.metric), [row.platform,row.browser,row.network].join(' / '),
          current + ' ↔ ' + prior, reading].filter(Boolean).join(' · ');
      })),
    );
  }
  version.onchange = renderFiltered;
  severity.onchange = renderFiltered;
  host.append(filters, details);
  renderFiltered();

  const figure = (key, count) => make('p', t(healthKeys[key], { count: formatNumber.format(count) }));
  host.append(
    list('recentSignups', data.signups.map(row => date(row.effective_at) + ' · ' + (row.method === 'google' ? 'Google' : translate('email')))),
    figure('signupsCount', data.signup_count),
    list('recentPurchases', data.purchases.map(row =>
      [date(row.event_at), row.product_id, row.provider, row.amount + ' ' + row.currency].join(' · '))),
    figure('purchasesCount', data.purchase_count),
    list('money', data.currencies.map(row => row.amount + ' ' + row.currency + ' (' + row.count + ')')),
    list('notifications', deliveryStates.map(state => translate('mail_' + state) + ' · ' + formatNumber.format(data.delivery[state] || 0))),
  );
}
