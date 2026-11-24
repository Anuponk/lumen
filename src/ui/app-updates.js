// Browser updates own only public asset caches, never player storage or Auth.
const CHECK_INTERVAL_MS = 5 * 60_000;
const RELOAD_RETRY_MS = 5_000;
const BUILD_LABEL = /^\d+\.\d+\.\d+\+\d+ \u00b7 [a-f0-9]{7}$/;
export function setupAppUpdates({
  window,
  document,
  navigator,
  location,
  caches,
  console,
  appVersion,
  canReload = () => true,
}) {
  if ('serviceWorker' in navigator) {
    let reloading = false;
    let reloadPending = false;
    let reloadTimer = null;
    let backgroundCheck = null;
    let previousServiceWorkerController = navigator.serviceWorker.controller;
    const updateStatus = (message) => {
      const node = document.getElementById('appUpdateStatus');
      if (node) node.textContent = message;
    };
    const activateWaitingWorker = (registration) => {
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    };
    const checkLumenUpdate = async ({ manual = false } = {}) => {
      try {
        if (manual) updateStatus('Recherche d’une mise à jour…');
        const registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        });
        await registration.update();
        activateWaitingWorker(registration);
        if (manual && !registration.waiting && !registration.installing)
          updateStatus('LUMEN est à jour · ' + appVersion());
        return registration;
      } catch (error) {
        console.warn('LUMEN service worker', error);
        if (manual) updateStatus('Impossible de vérifier la mise à jour.');
        return null;
      }
    };
    const isForegroundOnline = () =>
      document.visibilityState === 'visible' && navigator.onLine !== false;
    const applyPendingUpdate = () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = null;
      if (!reloadPending || reloading || !isForegroundOnline()) return;
      if (
        new URLSearchParams(location.search).has('code') ||
        location.hash.includes('access_token=') ||
        !canReload()
      ) {
        reloadTimer = window.setTimeout(applyPendingUpdate, RELOAD_RETRY_MS);
        return;
      }
      reloading = true;
      location.reload();
    };
    const queueReload = () => {
      reloadPending = true;
      applyPendingUpdate();
    };
    const checkPublishedBuild = async () => {
      const loaded = appVersion();
      if (!BUILD_LABEL.test(loaded)) return;
      try {
        // The release SHA also changes for a release whose sw.js is byte-identical.
        const response = await window.fetch('/build-info.json', {
          cache: 'no-store',
          signal: AbortSignal.timeout?.(15_000),
        });
        if (!response.ok) return;
        const { version, sha } = await response.json();
        if (typeof version !== 'string' || typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha))
          return;
        const published = version + ' \u00b7 ' + sha.slice(0, 7);
        if (BUILD_LABEL.test(published) && published !== loaded) queueReload();
      } catch {
        // Offline, interrupted or non-JSON deployment response. Retry on the next check.
      }
    };
    const checkInBackground = () => {
      applyPendingUpdate();
      if (reloading || !isForegroundOnline()) return;
      if (!backgroundCheck)
        backgroundCheck = Promise.all([checkLumenUpdate(), checkPublishedBuild()]).finally(() => {
          backgroundCheck = null;
        });
      return backgroundCheck;
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // First installation already serves this document's modules.
      const controller = navigator.serviceWorker.controller;
      const replacingController =
        previousServiceWorkerController &&
        controller &&
        controller !== previousServiceWorkerController;
      previousServiceWorkerController = controller;
      if (replacingController) queueReload();
    });
    if (document.readyState === 'complete') void checkInBackground();
    else window.addEventListener('load', checkInBackground);
    document.addEventListener('visibilitychange', checkInBackground);
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) return checkInBackground();
    });
    window.addEventListener('online', checkInBackground);
    window.setInterval(checkInBackground, CHECK_INTERVAL_MS);
    const forceUpdate = document.getElementById('forceAppUpdate');
    if (forceUpdate)
      forceUpdate.onclick = async () => {
        updateStatus('Mise à jour forcée…');
        if ('caches' in window)
          await caches
            .keys()
            .then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.startsWith('lumen-assets-'))
                  .map((key) => caches.delete(key)),
              ),
            );
        const registration = await checkLumenUpdate({ manual: true });
        if (registration?.waiting) {
          activateWaitingWorker(registration);
          return;
        }
        location.reload();
      };
  }
}
