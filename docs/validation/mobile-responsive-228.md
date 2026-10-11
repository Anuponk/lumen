# Mobile responsive validation matrix — issue #228

The game must not silently clip controls. On compact portrait screens, the board is bounded by the dynamic viewport. On exceptionally short screens and in landscape, scrolling is allowed rather than hiding actions.

| Viewport | Browser | Checks |
| --- | --- | --- |
| 320x568 | Chrome Android emulation | board, header, buttons, coach |
| 360x640 | Chrome Android emulation | board, actions, no horizontal overflow |
| 375x667 | Safari iPhone emulation | safe areas, modals, controls |
| 390x844 | Chrome Android / Safari iPhone | no accidental game scroll |
| 412x915 | Chrome Android | typography and tap targets |
| 430x932 | Safari iPhone | layout and overlays |
| 667x375 | Landscape | game controls remain accessible via scroll |
| 844x390 | Landscape | no clipped board or buttons |
| 390x600 | Browser bars / keyboard | modals scroll internally, actions accessible |

## Automated smoke checks
Run `node scripts/mobile-responsive-contract-tests.mjs`. This verifies the viewport strategy and the responsive CSS contract, **not actual rendered pixel geometry**.

## Manual acceptance still required
Capture screenshots of all rows, check `document.documentElement.scrollWidth <= innerWidth`, inspect every action and modal, and verify Chrome Android, Safari iPhone, and installed PWA. Do not close #228 until real browser/device checks are green.
