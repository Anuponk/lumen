// #848: the Android native version (versionName+versionCode) comes only from the
// Lumen launcher, which adds `#lumen-native=1.0.1+2` to the launch URL. It is never
// inferred from a user agent. A fragment (not a query) keeps the offline shell
// cacheable (sw.js only caches the query-free document) and never reaches a server.
// The value lives in sessionStorage: a Chrome tab on the same phone shares
// localStorage with the installed app and must not claim a native version.
export const NATIVE_VERSION_KEY = 'lumenNativeVersionV1';
export const NATIVE_VERSION = /^[0-9]{1,3}(\.[0-9]{1,3}){1,3}\+[0-9]{1,9}$/;

export function parseNativeLaunch(hash) {
  // Parsed by hand: URLSearchParams would turn the « + » of 1.0.1+2 into a space.
  const part = String(hash || '')
    .replace(/^#/, '')
    .split('&')
    .find((item) => item.startsWith('lumen-native='));
  const value = part ? part.slice('lumen-native='.length) : null;
  return value && NATIVE_VERSION.test(value) ? value : null;
}

// Reads the launch fragment once, removes it from the address bar (keeping any
// other fragment, such as an Auth return) and remembers it for this session.
export function captureNativeVersion({ location, history, storage } = {}) {
  let found = null;
  try {
    found = parseNativeLaunch(location?.hash);
    if (location?.hash && /(^#|&)lumen-native=/.test(location.hash)) {
      const tail = location.hash
        .slice(1)
        .split('&')
        .filter((item) => item && !item.startsWith('lumen-native='))
        .join('&');
      history?.replaceState?.(history.state ?? null, '', location.pathname + location.search + (tail ? '#' + tail : ''));
    }
    if (found) storage?.setItem?.(NATIVE_VERSION_KEY, found);
  } catch {}
  return found ?? readNativeVersion(storage);
}

export function readNativeVersion(storage) {
  try {
    const value = storage?.getItem?.(NATIVE_VERSION_KEY);
    return value && NATIVE_VERSION.test(value) ? value : null;
  } catch {
    return null;
  }
}
