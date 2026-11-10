// Browser updates own only public asset caches, never player storage or Auth.
export function setupAppUpdates({
  window,
  document,
  navigator,
  location,
  caches,
  console,
  appVersion,
}) {
  if ('serviceWorker' in navigator) {
    let lumenReloadingForSW = false;
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
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // First installation already serves this document's modules. Reload only
      // when replacing a controller, otherwise a fresh welcome is interrupted.
      const replacingController = !!previousServiceWorkerController;
      previousServiceWorkerController = navigator.serviceWorker.controller;
      if (!replacingController) return;
      if (lumenReloadingForSW) return;
      lumenReloadingForSW = true;
      if (
        new URLSearchParams(location.search).has('code') ||
        location.hash.includes('access_token=')
      ) {
        lumenReloadingForSW = false;
        return;
      }
      location.reload();
    });
    window.addEventListener('load', () => checkLumenUpdate());
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
