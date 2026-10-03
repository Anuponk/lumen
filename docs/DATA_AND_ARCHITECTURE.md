# Data and architecture

## Client
LUMEN is currently a monolithic static web/PWA application. `index.html` contains UI, CSS, catalogue, gameplay state, solver/proof logic, progression, analytics and tests. `manifest.webmanifest` and `sw.js` support installation/offline/PWA behavior.

This architecture makes cross-feature regressions easy. Refactoring into modules is desirable only if behavior is protected first by tests.

## Local/guest mode
Guest play is first-class. Progress is stored in localStorage under `lumenProgressV1`; tutorial, install/push choices, anonymous/session identity and UX preferences also use localStorage keys.

Anonymous users are tracked through an anonymous identifier/session so usage can be measured without requiring authentication.

## Supabase
The client uses Supabase. Project-side database objects for LUMEN live in the **`lumen` schema**. Relevant RPC responsibilities visible from the client include:
- profile/nickname;
- progress save/load and local-to-cloud migration;
- analytics event tracking;
- daily play;
- entitlements;
- feedback and difficulty rating.

Google OAuth is supported. When a local player signs in, local solved history must be merged to cloud rather than discarded.

## Analytics
Events include puzzle start/completion, hints, sharing/referral, installation and related engagement events. Referral parameters are sanitized before analytics.

## PWA
Installation is offered only after meaningful engagement (currently after 3 solved quests), and standalone installs should not be nagged again. Push/reminder permission must only be requested after an explicit user action; the app hides its own prompt before invoking the Android/browser permission dialog.

Push support should not be considered complete merely because subscription/server code exists: service-worker receipt/display and end-to-end delivery must be verified.

## Security
The public Supabase client key in browser code must be treated as public. Security must rely on RLS/RPC authorization, not secrecy of browser credentials. Never add service-role keys or other server secrets to this repository.
