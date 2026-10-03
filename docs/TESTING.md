# Testing and quality gate

## Mandatory rule
After **every modification affecting LUMEN gameplay**, run the complete test battery and strict grid audit before delivery. Do this even for changes that appear purely visual if they touch board DOM/input/state.

## Embedded regression suite
The current app exposes `runHintTests()`. It covers, among other things:
- PWA install timing and standalone behavior;
- sharing/referral and account/profile behavior;
- reminder opt-in rules;
- continuous sequential progression;
- 100 quests / 12 constellations / 150 stars;
- cell cycle;
- guided conflicts and solver use;
- N x N board rendering;
- mobile drag exclusions;
- Guardian terminology;
- constellation/reward celebrations;
- replay and reset/navigation;
- modal behavior;
- learning/autonomy rules;
- victory regression cases;
- fixed row height when exclusions appear;
- success/non-success behavior;
- catalogue structural rules;
- proof-engine transparency;
- performance regressions;
- complete explainable replay of catalogue puzzles for the current tested size.

## Performance budgets currently asserted
- median `paintBoardState()` < 16 ms on the current grid;
- median `paintCell(0,0)` < 8 ms;
- ordinary click must not rebuild the whole grid;
- pointermove drag must not call full `render()`.

Treat these as regression budgets, not universal benchmark claims: device/browser hardware affects absolute timing.

## Strict grid audit gap
The embedded suite commonly evaluates `CAT[n]` for the current board size. The release audit must go further and iterate **every catalogue size and every campaign entry**, checking unique solution and explainable replay. A future dedicated offline test script should make this automatic.

## Required manual/E2E smoke checks
Until browser automation exists, explicitly verify on a real browser/mobile viewport:
1. first tap excludes, second places Guardian, third clears;
2. drag marks multiple exclusions and does not scroll the board;
3. quest 1 scripted flow and quest 2 faster learning flow;
4. quest 6 assistance can be disabled;
5. quest 11 autonomy prompt;
6. valid completion is detected immediately;
7. invalid N-Guardian state does not celebrate;
8. Reset keeps same quest;
9. next quest only after victory;
10. solved quest replay works and badges update from one attempt;
11. refresh preserves guest progress;
12. sign-in merges local progress;
13. install/share flows do not block play.

## Definition of done
A gameplay change is not done unless:
- all automated tests pass;
- strict all-grid audit passes;
- relevant manual/E2E scenario passes;
- no console error was introduced;
- docs are updated when behavior changed;
- commit SHA is reported;
- intended Vercel deployment status is checked.

Never claim “all tests pass” if only static/source inspection was performed.
