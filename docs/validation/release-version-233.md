# Release version — #233

The release identifier is `1.11.1+N · SHA7`, where N is the first-parent
commit count on main and SHA7 identifies the exact deployed Git commit.
It is computed from Git history, never from a CI run number: retrying the same
commit generates the same version. A new merge commit advances the count.

Vercel runs `node scripts/build-static.mjs` and publishes `dist/`.
o2switch must run the same build command against the exact verified main SHA
and publish the resulting dist assets. Do not use the checkout's raw index.html
for production, because its placeholder meta tag is not a release version.

The `lumen-build` meta tag is the canonical version for UI, telemetry and
feedback; the Account menu reads it directly from the loaded HTML.
The PWA must show the loaded page's version until a navigation/reload installs
new HTML/assets. The service worker uses network-first navigation.

Traceability: inspect `dist/build-info.json` or the Account menu and look up
the displayed SHA in GitHub commits. A build of the same commit is identical.
