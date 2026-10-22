import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Imported by the existing browser gate: no separate server/browser lifecycle.
export async function verifyBoardFeedback({send,evaluate}){
 const results=[];
 for(const [width,height,mobile] of [[390,844,true],[1440,900,false]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,mobile,deviceScaleFactor:1});
  await evaluate(`(()=>{
   const p=lumenDiagnostics.snapshot().progress;p.catalogueOrigin=1;
   p.solved=Object.fromEntries(Array.from({length:70},(_,i)=>[i,1]));p.shards=100;
   localStorage.setItem('lumenGuidedErrors','off');
   // A prior runner may have a canonical-only quest active. Enter through the
   // real map so the normal start adapter selects the requested legacy grid.
   document.getElementById('openSky').click();
   document.querySelector('#adventureRail [data-pack-id="base-real-sky"]').click();
   for(let page=0;!document.querySelector('#sectorTabs [data-content-id="real-10"]');page++){
    if(page>10)throw Error('Aigle not found in the actual constellation navigation');
    document.getElementById('constellationNext').click();
   }
   document.querySelector('#sectorTabs [data-content-id="real-10"]').click();
   const quest=document.querySelector('#puzzleGrid [data-quest-id="base-q071"]');
   if(!quest||quest.disabled)throw Error('Reported quest is not available in fixture');
   quest.click();
   // Use the real reset: setupQuest may correctly restore the preceding viewport's attempt.
   window.confirm=()=>true;document.getElementById('new').click();
   for(const id of ['manualCrossTip','questStart','autonomyOverlay','badgeUnlockOverlay','autoCrossUnlockOverlay'])document.getElementById(id).hidden=true;
   const ac=document.getElementById('autoCross');ac.checked=false;ac.dispatchEvent(new Event('change'));
   document.getElementById('manualCrossTipOk').click();
   window.halfwayMessages=[];
   window.halfwayObserver=new MutationObserver(records=>{for(const r of records)if(r.type==='childList'&&r.target.textContent.includes('Mi-chemin'))halfwayMessages.push(r.target.textContent)});
   halfwayObserver.observe(document.getElementById('rewardToast'),{childList:true});
  })()`);
  assert.equal(await evaluate('lumenDiagnostics.snapshot().n'),6,'The actual quest 91 grid must be selected, not the preceding canonical board');
  // Click through the real handlers; this detects the missing paint-path wiring.
  for(let r=0;r<3;r++){
   await evaluate(`(()=>{const s=lumenDiagnostics.snapshot(),cell=document.querySelector('.cell[data-row="${r}"][data-col="'+s.puz.sol[${r} ]+'"]');cell.click();cell.click()})()`);
   const actual=await evaluate('halfwayMessages.length');
   assert.equal(actual,r===2?1:0,'Halfway must fire at the third Guardian, not at final render: '+JSON.stringify(await evaluate(`({n:lumenDiagnostics.snapshot().n,quest:lumenDiagnostics.snapshot().levelIndex,state:lumenDiagnostics.snapshot().state,celebrated:lumenDiagnostics.snapshot().celebrated,toast:document.getElementById('rewardToast').textContent,guided:document.getElementById('guidedCard').hidden})`)));
  }
  await evaluate('document.getElementById("undo").click()');
  await evaluate(`(()=>{const s=lumenDiagnostics.snapshot(),cell=document.querySelector('.cell[data-row="2"][data-col="'+s.puz.sol[2]+'"]');cell.click()})()`);
  assert.equal(await evaluate('halfwayMessages.length'),1,'Undo/repose cannot repeat halfway');
  await evaluate(`lumenDiagnostics.setBoard([[1,1,0,0,1,1],[2,1,1,1,1,1],[1,1,0,0,1,1],[1,1,1,0,0,0],[1,0,1,0,0,0],[1,0,0,0,1,0]]);document.getElementById('hint').click()`);
  const hint=await evaluate(`(()=>{
   const sides=['Top','Right','Bottom','Left'];
   return {text:document.getElementById('hintCopy').textContent,
    target:[...document.querySelectorAll('.hint-target')].map(el=>[Number(el.dataset.row),Number(el.dataset.col)]),
    cells:[...document.querySelectorAll('.cell.hi')].map(el=>{const s=getComputedStyle(el);return {image:s.backgroundImage,clip:s.backgroundClip,shadow:s.boxShadow,borders:sides.map(side=>[el.dataset[side[0].toLowerCase()],s['border'+side+'Width'],s['border'+side+'Color']])}})};
  })()`);
  assert.match(hint.text,/colonnes 3 et 4/);assert.match(hint.text,/L6C3/);assert.deepEqual(hint.target,[[5,2]]);
  assert(hint.cells.length>=5);
  for(const cell of hint.cells){assert.match(cell.image,/linear-gradient/);assert.equal(cell.clip,'padding-box');assert.equal(cell.shadow,'none');for(const [boundary,border] of cell.borders)if(boundary==='1')assert.equal(border,'3px')}
  assert(await evaluate(`(()=>{const el=document.querySelector('.hint-target'),r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.cell')===el})()`),'Hint target remains visible and is not covered by a tip');
  // Compare the actual border geometry/colors with highlighting closed.
  const borders=await evaluate(`JSON.stringify([...document.querySelectorAll('.cell')].map(el=>{const s=getComputedStyle(el);return ['Top','Right','Bottom','Left'].map(side=>[s['border'+side+'Width'],s['border'+side+'Color']])}))`);
  // Let the earlier halfway toast finish before recording the hint review image.
  await new Promise(resolve=>setTimeout(resolve,2000));
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const imagePath=path.join(os.tmpdir(),`lumen-chantier-hint-${width}.png`);fs.writeFileSync(imagePath,Buffer.from(screenshot.data,'base64'));
  await evaluate('document.getElementById("hintClose").click()');
  assert.equal(await evaluate(`JSON.stringify([...document.querySelectorAll('.cell')].map(el=>{const s=getComputedStyle(el);return ['Top','Right','Bottom','Left'].map(side=>[s['border'+side+'Width'],s['border'+side+'Color']])}))`),borders,'Hint must preserve all territory borders exactly');
  assert.equal(await evaluate('document.querySelectorAll(".cell.hi").length'),0);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('document.getElementById("hint").click()');
  assert(await evaluate(`getComputedStyle(document.querySelector('.hint-target')).animationName==='none'`),'Highlight remains static with reduced motion');
  await send('Emulation.setEmulatedMedia',{features:[]});
  assert.equal(await evaluate('halfwayMessages.length'),1,'Hints and redraws cannot replay halfway');
  await evaluate('halfwayObserver.disconnect()');
  results.push({width,height,mobile,halfway:true,firstHintAction:true,bordersUnchanged:true,reducedMotion:true,screenshot:imagePath});
 }
 return results;
}
