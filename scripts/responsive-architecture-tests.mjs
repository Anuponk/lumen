import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('src/ui/game-screen.js','utf8');
const css=fs.readFileSync('src/ui/styles.css','utf8');
const docs=fs.readFileSync('docs/UX_AND_VISUAL_DIRECTION.md','utf8');

assert(!html.includes('desktopLeftSlot'),'desktop-only progression slot remains');
assert(!html.includes('desktopGuide'),'desktop-only guide slot remains');
assert(!html.includes('id="mobileJourney"'),'duplicate mobile journey remains');
assert(!ui.includes('arrangeDesktopPanels'),'viewport-driven DOM reparenting remains');
assert(!ui.includes('mobileJourneyText'),'duplicate journey synchronization remains');
assert(ui.includes('e.pointerType==="mouse"'),'drag interaction is not capability-driven');
assert(css.includes('@media (min-width:1100px)'),'wide responsive layout missing');
assert(css.includes('@media (max-width:700px)'),'compact responsive layout missing');
assert(css.includes('.journey{display:flex!important'),'canonical journey is not adapted on mobile');
assert(docs.includes('One responsive game UI'),'responsive architecture documentation missing');

console.log(JSON.stringify({
  commonComposition:true,
  viewportDomReparenting:false,
  duplicateJourney:false,
  pointerCapability:true,
  responsiveCss:true
}));
