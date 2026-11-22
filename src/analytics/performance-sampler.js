const rpcPaths = new Map([
  ['/rest/v1/rpc/lumen_get_profile', 'cloud_rpc'],
  ['/rest/v1/rpc/lumen_cas_profile', 'sync_rpc'],
  ['/rest/v1/rpc/lumen_cas_profile_digest', 'sync_rpc'],
  ['/rest/v1/rpc/lumen_merge_profile', 'sync_rpc'],
  ['/rest/v1/rpc/lumen_merge_profile_cas', 'sync_rpc'],
  ['/rest/v1/rpc/lumen_commit_canonical_command', 'cloud_rpc'],
  ['/rest/v1/rpc/lumen_commit_legacy_command', 'cloud_rpc'],
]);

export function createPerformanceSampler({ env, context, send, origin, sampleRate = 0.25, random = Math.random }) {
  const sampled = random() < sampleRate;
  let current = null;
  let submitted = false;

  function close() {
    if (!current) return;
    for (const observer of current.observers) observer.disconnect();
    env.clearTimeout(current.timer);
    if (current.frame != null) env.cancelAnimationFrame(current.frame);
    current = null;
  }

  function collect(run, metric, duration) {
    if (run !== current || env.document.hidden || !Number.isFinite(duration) || duration < 0 || duration > 60_000) return;
    const rounded = Math.max(1, Math.round(duration / 5) * 5);
    run.metrics[metric] = Math.max(run.metrics[metric] || 0, rounded);
  }

  function sameOwner(run) {
    const live = context();
    return live.enabled && live.userId === run.owner.userId && live.client === run.owner.client;
  }

  function refresh() {
    try {
      if (current && !sameOwner(current)) close();
      if (current || submitted || !sampled || env.document.hidden) return;
      const owner = context();
      if (!owner.enabled || !owner.userId || !owner.client) return;
      const release = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9})(?:\s*·\s*[a-f0-9]{7})?$/.exec(owner.version)?.[1];
      if (!release) return;
      const run = { owner, release, metrics: {}, observers: [], frame: null, victory: false };
      current = run;
      function observe(type, listener) {
        try {
          const observer = new env.PerformanceObserver(list => {
            for (const entry of list.getEntries()) listener(entry);
          });
          observer.observe({ type, buffered: false, ...(type === 'event' ? {durationThreshold:16} : {}) });
          run.observers.push(observer);
        } catch {}
      }
      const nav = env.performance.getEntriesByType('navigation')[0];
      collect(run, 'load', nav?.domInteractive > 0 ? nav.domInteractive : NaN);
      observe('longtask', entry => collect(run, 'long_task', entry.duration));
      observe('event', entry => {
        if (entry.target?.closest?.('#board')) collect(run, 'grid_input', entry.duration);
      });
      observe('resource', entry => {
        try {
          const url = new URL(entry.name);
          const metric = url.origin === origin && rpcPaths.get(url.pathname);
          if (metric) collect(run, metric, entry.duration);
        } catch {}
      });
      run.timer = env.setTimeout(() => {
        const permitted = sameOwner(run);
        close();
        if (!permitted || !Object.keys(run.metrics).length) return;
        submitted = true;
        void Promise.resolve().then(() => {
          if (sameOwner(run)) return send(run.owner, run.release, run.metrics);
        }).catch(() => {});
      }, 120_000);
    } catch { close(); }
  }

  function start() {
    return current ? { run: current, time: env.performance.now() } : null;
  }

  function end(mark, metric) {
    if (mark?.run === current && current) collect(current, metric, env.performance.now() - mark.time);
  }

  function victory() {
    const run = current;
    if (!run || run.victory || env.document.hidden || env.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    run.victory = true;
    let previous = null, measured = 0;
    function frame(stamp) {
      if (run !== current || env.document.hidden) return;
      if (previous !== null) {
        collect(run, 'victory_gap', stamp - previous);
        measured++;
      }
      previous = stamp;
      if (measured < 20) run.frame = env.requestAnimationFrame(frame);
    }
    run.frame = env.requestAnimationFrame(frame);
  }

  return { refresh, close, start, end, victory };
}
