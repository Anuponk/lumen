import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('src/ui/game-screen.js','utf8');
const css=fs.readFileSync('src/ui/styles.css','utf8');
const docs=fs.readFileSync('docs/UX_AND_VISUAL_DIRECTION.md','utf8');
const sky=fs.readFileSync('src/ui/sky-navigation.js','utf8');
assert(!/innerWidth|matchMedia|MobileSky|DesktopSky/.test(sky),'Mon ciel must use one viewport-independent component');
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'Mon ciel uses one 2-column grid at every width (#749)');

assert(!html.includes('desktopLeftSlot'),'desktop-only progression slot remains');
assert(!html.includes('desktopGuide'),'desktop-only guide slot remains');
assert(!html.includes('id="mobileJourney"'),'duplicate mobile journey remains');
assert(!ui.includes('arrangeDesktopPanels'),'viewport-driven DOM reparenting remains');
assert(!ui.includes('mobileJourneyText'),'duplicate journey synchronization remains');
assert(ui.includes('e.pointerType==="mouse"'),'drag interaction is not capability-driven');
assert(!css.includes('@media (min-width:1100px)'),'#749: no separate wide layout');
assert(css.includes('#749: computers and tablets use the phone layout in a centered column'),'#749 centered column missing');
assert(css.includes('/* #749: formerly (max-width:700px); now every width */'),'#749: phone layout applies at every width');
assert(css.includes('.journey{display:flex!important'),'canonical journey is not adapted on mobile');
assert(docs.includes('One responsive game UI'),'responsive architecture documentation missing');

console.log(JSON.stringify({
  commonComposition:true,
  viewportDomReparenting:false,
  duplicateJourney:false,
  pointerCapability:true,
  responsiveCss:true
}));


/* #315: hard policy for the PLAY surface, not modal/dialog content. */
assert.match(css,/play screen contract — no scrolling\/clipped controls/);
assert.match(css,/html,body\{height:100%!important;overflow:hidden!important/);
assert.match(css,/\.app\{overflow:hidden!important\}/);
assert.match(css,/safe-area-inset-bottom/);
assert.match(css,/#board,\.game-core:has\(#board\) \.actions/);
assert.match(css,/\.actions button\{min-width:0;min-height:40px!important/);
// #858: Réinitialiser is a narrow game action under the grid, never a header icon.
assert.match(css,/\.actions\{display:grid!important;grid-template-columns:44px minmax\(0,\.8fr\) minmax\(0,1\.1fr\) minmax\(0,1\.1fr\)!important/);
assert.doesNotMatch(css,/\.head #new/);
assert.match(fs.readFileSync('index.html','utf8'),/<div class="actions"><button id="undo"[^>]*>.*?<\/button><button id="new"[^>]*title="Effacer tous les placements de la grille"/);
