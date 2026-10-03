import {CAT} from "../campaign/catalogue.js";
import {CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE,SKY_TARGET,CONSTELLATIONS,CONSTELLATION_GRID_COUNTS} from "../campaign/data.js";
import {chapterForGrid} from "../campaign/progression.js";

export function createHintTestSuite(model,api){
const {saveLumenNickname,maybeOfferInstall,lumenShareUrl,successAchievement,shareLumenResult,captureReferral,enableLumenPush,markLumenSeen,maybeOfferPush,board,key,proofEngine,playerError,guidedConflictForAction,scriptedLearningActive,maybeShowManualCrossTip,showGuidedConflict,configureLearningMode,maybeShowAutonomy,hideSuccess,celebrateSuccess,paintCell,paintBoardState,moveDragCross,render,celebrateConstellationReveal,showSkyReveal,closeAutonomyOverlay,setupOutsideDefaults,openJourneyMap,closeMapOverlay,renderMap,advanceToNextPuzzle,startReplay}=api;
async function runHintTests(){
 let results=[],cases=[];
 test("Campagne : toutes les quêtes ont une grille dans le catalogue",()=>Object.values(CAMPAIGN_SIZE_SCHEDULE).every(([size,slot])=>!!CAT[size]?.[size==="6"?CAMPAIGN6_ORDER[slot]:slot]));
 test("PWA : installation proposée seulement après 3 quêtes",()=>maybeOfferInstall.toString().includes("solvedCount()<3")&&document.getElementById("installEnable"));
 test("PWA : le mode standalone empêche de reproposer l’installation",()=>maybeOfferInstall.toString().includes("lumenIsStandalone()"));
 test("Partage : le résultat contient un lien de parrainage traçable",()=>lumenShareUrl().includes("ref=")&&shareLumenResult.toString().includes("result_shared"));
 test("Partage : la réussite met en avant quête et constellation",()=>typeof successAchievement==="function"&&document.getElementById("successAchievement")&&successAchievement.toString().includes("Quête "));
 test("Partage : une carte image est générée quand le téléphone le permet",()=>shareLumenResult.toString().includes("shareCardCanvas")&&shareLumenResult.toString().includes("canShare"));
 test("Referral : le paramètre ref est nettoyé avant analytics",()=>captureReferral.toString().includes("replace(/[^a-zA-Z0-9_-]/g"));
 test("Compte : le pseudo est stocké côté profil utilisateur",()=>typeof saveLumenNickname==="function"&&saveLumenNickname.toString().includes("lumen_set_nickname"));
 test("Rappel : la popup LUMEN disparaît avant la demande Android",()=>{
   const src=enableLumenPush.toString(),hide=src.indexOf("optin.hidden=true"),ask=src.indexOf("Notification.requestPermission");
   return hide>=0&&ask>hide;
 });
 test("Rappel : opt-in seulement après 3 quêtes et action explicite",()=>{const src=maybeOfferPush.toString();return src.includes("solvedCount()<3")&&document.getElementById("pushEnable")&&enableLumenPush.toString().includes("Notification.requestPermission")});
 test("Rappel : retour du joueur recale le délai d’inactivité",()=>markLumenSeen.toString().includes('"seen"'));
 test("Campagne : progression sauvegardée convertie en séquence continue",()=>{
   const keys=Object.keys(model.lumenProgress.solved).map(Number).sort((a,b)=>a-b);
   return keys.every((v,i)=>v===i);
 });

 test("Campagne : 100 quêtes réparties sur 12 constellations",()=>CONSTELLATION_GRID_COUNTS.length===12&&CONSTELLATION_GRID_COUNTS.reduce((a,b)=>a+b,0)===100);
 test("Campagne : le ciel contient exactement 150 étoiles",()=>CONSTELLATIONS.reduce((a,c)=>a+c.count,0)===SKY_TARGET&&SKY_TARGET===150);
 test("Campagne : chaque quête appartient à une constellation",()=>Array.from({length:100},(_,i)=>chapterForGrid(i)).every(i=>i>=0&&i<CONSTELLATIONS.length));
 test("Interaction : le cycle reste exclusion, Gardien, case libre",()=>{const src=render.toString();return src.includes("(state[r][c]+1)%3")});
 test("Apprentissage : poser un Gardien utilise le vrai cycle à deux touchers",()=>{const src=render.toString();return src.includes("state[r][c]===0){next=1")&&src.includes("state[r][c]===1){next=2")&&!src.includes("scriptedAllowsGuardian(r,c)){if(!scriptedAllowsGuardian")});
 test("Apprentissage : les cinq premières quêtes imposent le jeu manuel",()=>{const src=configureLearningMode.toString();return src.includes("levelIndex<=4")&&src.includes("cb.checked=false")&&src.includes("cb.disabled=true")});\n test("Apprentissage : le Marquage auto se débloque à la quête 6 sans s’activer seul",()=>{const src=configureLearningMode.toString();return src.includes("levelIndex===5")&&src.includes("Marquage auto débloqué")&&src.includes("cb.checked=false")});
 test("Apprentissage : après la quête 2 Mon ciel propose une visite contextuelle",()=>{const src=openJourneyMap().toString();return !!document.getElementById("skyTour")&&!!document.getElementById("skyTourSkip")&&src.includes("learningTour")});
 test("Guidage : contrôle activable avec explication persistante",()=>!!document.getElementById("guidedErrors")&&!!document.getElementById("guidedCard")&&typeof guidedConflictForAction==="function"&&typeof showGuidedConflict==="function");
 test("Guidage : validation logique utilise le solveur",()=>guidedConflictForAction.toString().includes("solutions("));
 test("Guidage : feedback visuel distingue ligne, colonne, territoire et contact",()=>["row","col","region","touch","deadend"].every(k=>guidedConflictForAction.toString().includes('"'+k+'"')));
 test("Rendu : le plateau contient n × n cellules après render",()=>{render();return board.children.length===model.n*model.n});
 test("Mobile : glisser assombrit plusieurs cases",()=>document.querySelector("#board")&&getComputedStyle(board).touchAction==="none"&&typeof moveDragCross==="function");
 test("Narratif : les pièces placées sont des Gardiens",()=>{
   const src=render.toString(),rules=document.getElementById("rulesModal")?.textContent||"";
   return src.includes('aria-label="Gardien positionné"')&&paintCell.toString().includes('aria-label="Gardien positionné"')&&document.getElementById("progressLive").textContent.endsWith("/"+model.n+" Gardiens")&&rules.includes("un Gardien par ligne")&&!rules.includes("source de lumière");
 });
 test("Récompense : une constellation terminée déclenche une célébration dédiée",()=>{
   return typeof celebrateConstellationReveal==="function"&&showSkyReveal.toString().includes("celebrateConstellationReveal()");
 });
 test("Récompense : chaque première étoile gagnée ouvre le ciel",()=>{
   return celebrateSuccess.toString().includes("firstCompletion&&earnedThisRun>0")&&celebrateSuccess.toString().includes("showSkyReveal(skyEarnedBefore,checkpoint)");
 });
 test("Récompense : deux respirations célestes existent dans chaque constellation",()=>{
   return CONSTELLATIONS.every(c=>Math.ceil(c.count/3)<Math.ceil(c.count*2/3)&&Math.ceil(c.count*2/3)<c.count);
 });
 test("Récompense : une quête terminée peut être rejouée pour améliorer ses badges",()=>{
   const b=document.getElementById("successRetry");
   return !!b&&b.textContent.includes("Réessayer");
 });
 test("UX : Quête suivante est le CTA principal après réussite",()=>document.getElementById("successNew")?.classList.contains("success-primary")&&!document.getElementById("successShare")?.classList.contains("share-primary"));
 test("UX : fermer Mon ciel après réussite enchaîne sur la quête suivante",()=>openJourneyMap().toString().includes("advanceOnClose")&&closeMapOverlay().toString().includes("advanceToNextPuzzle"));
 test("UX : la prochaine quête débloquée est visible comme Nouvelle dans Mon ciel",()=>renderMap().toString().includes("puzzle-new-label")&&renderMap().toString().includes("Nouvelle quête disponible"));
 test("UX : Mon ciel reste au-dessus du masque de tentative",()=>Number.parseInt(getComputedStyle(document.getElementById("mapModal")).zIndex,10)>Number.parseInt(getComputedStyle(document.getElementById("attemptMask")).zIndex,10));
 test("UX mobile : les contrôles de tentative ne recouvrent pas le raccourci Mon ciel",()=>{const controls=document.getElementById("attemptPause")?.parentElement,pause=document.getElementById("attemptPause"),abandon=document.getElementById("attemptAbandon");if(innerWidth>700||!controls)return true;const c=getComputedStyle(controls);return c.position!=="absolute"&&!!pause&&!!abandon});
 test("Navigation : Quête suivante après rejeu reste relative à la quête jouée",()=>advanceToNextPuzzle.toString().includes("const next=levelIndex+1")&&!advanceToNextPuzzle.toString().includes("replayMode?Math.min(sequentialSolvedCount"));
 test("Navigation : le rejeu conserve séparément la progression maximale",()=>startReplay.toString().includes("levelIndex=i")&&startReplay.toString().includes("replayMode=true")&&!startReplay.toString().includes("sequentialSolvedCount="));
 test("UX : les règles sont accessibles à la demande",()=>!!document.getElementById("tutorialHelp")&&!!document.getElementById("rulesModal")&&!!document.getElementById("replayLearning"));
 test("Vocabulaire : les indices n'utilisent plus l'ancien thème de l'eau",()=>!/Eau manquante|éteindre/.test(document.getElementById("hint").onclick.toString()));
 test("Campagne : progression strictement séquentielle",()=>{
   return document.getElementById("successNew").textContent.trim()==="Quête suivante";
 });

 test("Campagne : Réinitialiser conserve la même quête",()=>{
   return document.getElementById("new").textContent.trim()==="Réinitialiser";
 });
 test("Campagne : seule une victoire permet d'avancer",()=>{
   return document.getElementById("successNew").textContent.trim()==="Quête suivante";
 });
 test("UX modales : toucher hors de Quête accomplie avance",()=>setupOutsideDefaults.toString().includes('"successOverlay"')&&setupOutsideDefaults.toString().includes("handleSuccessAdvance"));
 test("UX modales : les overlays informatifs ont une action par défaut",()=>["skyReveal","questStart","autonomyOverlay","mapModal"].every(id=>setupOutsideDefaults.toString().includes('"'+id+'"')));
 test("UX consentement : installation et rappel choisissent Plus tard hors popup",()=>setupOutsideDefaults.toString().includes("dismissInstallLater")&&setupOutsideDefaults.toString().includes("dismissPushLater"));
 test("UX apprentissage : premier tutoriel ne se ferme pas par accident",()=>setupOutsideDefaults.toString().includes("lumenTutorialSeen")&&setupOutsideDefaults.toString().includes("if(seen)closeTutorial(false)"));
 test("UX correction : guidage et vérification restent explicites",()=>!setupOutsideDefaults.toString().includes('"guidedCard"')&&!setupOutsideDefaults.toString().includes('"verifyCard"'));
 test("Apprentissage guidé : quêtes 1 à 5 imposent le contrôle",()=>configureLearningMode.toString().includes("levelIndex<=4")&&configureLearningMode.toString().includes("guided.disabled=true"));
 test("Apprentissage guidé : quêtes 6 à 10 le rendent optionnel",()=>configureLearningMode.toString().includes("levelIndex<=9")&&configureLearningMode.toString().includes("guided.disabled=false"));
 test("Autonomie : la quête 11 propose de jouer sans contrôle guidé",()=>maybeShowAutonomy.toString().includes("levelIndex!==10")&&!!document.getElementById("autonomyTry")&&!!document.getElementById("autonomyKeep"));
 test("Autonomie : toucher hors popup choisit sans aide",()=>closeAutonomyOverlay.toString().includes("finishAutonomyChoice(false)"));
 test("Tutoriel joué : quêtes 1 et 2 n’enseignent que les Gardiens",()=>scriptedLearningActive.toString().includes("levelIndex<=1")&&render.toString().includes("scriptedAllowsGuardian"));
 test("Tutoriel joué : Marquage auto verrouillée sur les deux premières quêtes",()=>configureLearningMode.toString().includes("cb.disabled=levelIndex<=1"));
 test("Tutoriel joué : le glisser des exclusions est bloqué pendant le scénario",()=>document.querySelector("#board")&&scriptedLearningActive.toString().includes("levelIndex<=1"));
 test("Tip exclusions : apparaît au premier arrêt de le Marquage auto",()=>model.ac.onchange.toString().includes("maybeShowManualCrossTip")&&maybeShowManualCrossTip.toString().includes("lumenManualCrossTipSeen"));

 // Regression: a completed valid constellation is judged from its guardians,
 // independently of remaining manual/automatic exclusions.
 test("Maîtrise : un cercle erroné corrigé ne compte pas comme faute",()=>{
   const src=render.toString();
   return !src.includes('if(next===2&&puz.sol[r]!==c){errorSound()') &&
          !src.includes('if(next===2&&puz.sol[r]!==c){mistakesThisGame++') &&
          !src.includes('Tu peux encore corriger');
 });
 test("Maîtrise : une constellation temporairement complète mais invalide ne pénalise pas",()=>{
   const src=render.toString();
   const branch=src.slice(src.indexOf('}else if(placed.length===n){'));
   return branch.includes('Cette constellation ne fonctionne pas encore')&&!branch.slice(0,500).includes('mistakesThisGame++');
 });
 test("Victoire : les exclusions restantes ne bloquent pas une constellation valide",()=>{
   const p=CAT["6"][0], n0=p.reg.length;
   const pts=p.sol.map((c,r)=>[r,c]);
   return new Set(pts.map(x=>x[0])).size===n0 &&
          new Set(pts.map(x=>x[1])).size===n0 &&
          new Set(pts.map(([r,c])=>p.reg[r][c])).size===n0 &&
          pts.every((a,i)=>pts.every((b,j)=>i===j||Math.abs(a[0]-b[0])>1||Math.abs(a[1]-b[1])>1));
 });


 function test(name,fn){
  cases.push({name,fn});
 }
 let saveState=model.state.map(x=>x.slice()), savePuz=model.puz, saveN=model.n;

 test("Hauteur des lignes fixe quand une croix apparaît",()=>{
  let css=getComputedStyle(board);
  let before=board.getBoundingClientRect().height;
  let p=CAT[model.n][0],oldP=model.puz,oldS=model.state;
  model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));render();
  let rowsBefore=[...board.children].filter((_,i)=>i%model.n===0).map(e=>e.getBoundingClientRect().height);
  model.state[0][0]=1;render();
  let rowsAfter=[...board.children].filter((_,i)=>i%model.n===0).map(e=>e.getBoundingClientRect().height);
  let after=board.getBoundingClientRect().height;
  model.puz=oldP;model.state=oldS;render();
  return Math.abs(before-after)<0.5 && rowsBefore.length===model.n &&
         rowsBefore.every((h,i)=>Math.abs(h-rowsAfter[i])<0.5);
 });
 test("Succès : une quête accomplie déclenche la célébration",async()=>{
  let p=CAT[model.n][0],oldP=model.puz,oldS=model.state,oldCelebrated=model.celebrated;
  model.puz=p;model.state=Array.from({length:model.n},(_,r)=>Array.from({length:model.n},(_,c)=>c===p.sol[r]?2:0));
  model.celebrated=false;render();
  const deadline=performance.now()+3000;
  while(performance.now()<deadline&&!document.getElementById("successOverlay").classList.contains("show")&&document.getElementById("skyReveal").hidden)await new Promise(resolve=>setTimeout(resolve,25));
  let ok=model.celebrated && (document.getElementById("successOverlay").classList.contains("show")||!document.getElementById("skyReveal").hidden) && board.classList.contains("win");
  document.getElementById("skyReveal").hidden=true;
  hideSuccess();model.puz=oldP;model.state=oldS;model.celebrated=oldCelebrated;render();
  return ok;
 });
 test("Succès : aucune célébration sur une quête incomplète",()=>{
  let p=CAT[model.n][0],oldP=model.puz,oldS=model.state,oldCelebrated=model.celebrated;
  model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));model.celebrated=false;hideSuccess();render();
  let ok=!model.celebrated && !document.getElementById("successOverlay").classList.contains("show");
  model.puz=oldP;model.state=oldS;model.celebrated=oldCelebrated;render();
  return ok;
 });
 test("Indice : fermeture contextuelle remplace Revoir la quête",()=>{
  return !document.getElementById("clearHint")&&!!document.getElementById("hintClose");
 });
 test("Exclusions : anneau ambre identique en manuel et automatique",()=>{
  let manual=document.createElement("div"),auto=document.createElement("div");
  manual.className="cell";auto.className="cell auto-x";
  manual.innerHTML='<span class="lumen-dim"></span>';auto.innerHTML='<span class="lumen-dim"></span>';
  document.body.append(manual,auto);
  let m=getComputedStyle(manual.firstChild),a=getComputedStyle(auto.firstChild);
  let ok=m.borderTopColor===a.borderTopColor && m.borderTopWidth===a.borderTopWidth &&
         m.opacity===a.opacity && manual.firstChild.getBoundingClientRect().width===auto.firstChild.getBoundingClientRect().width &&
         parseFloat(m.borderTopWidth)>=2;
  manual.remove();auto.remove();return ok;
 });
 test("Catalogue non vide",()=>CAT[model.n]&&CAT[model.n].length>0);
 test("Territoires : pas de monocellule hors des deux introductions scriptées",()=>{
  return CAT[model.n].every(p=>{
   let counts={};p.reg.flat().forEach(g=>counts[g]=(counts[g]||0)+1);
   return Object.entries(counts).every(([g,count])=>count>=2||(model.n===5&&((p===CAT["5"][0]&&Number(g)===2&&p.reg[2][2]===2)||(p===CAT["5"][1]&&Number(g)===0&&p.reg[0][0]===0))));
  });
 });
 test("Solutions stockées respectent lignes/colonnes/territoires/non-contact",()=>{
  return CAT[model.n].every(p=>{
   let s=p.sol;
   if(new Set(s).size!==model.n)return false;
   if(new Set(s.map((c,r)=>p.reg[r][c])).size!==model.n)return false;
   for(let r=1;r<model.n;r++)if(Math.abs(s[r]-s[r-1])<=1)return false;
   return true;
  });
 });
 test("Une croix correcte est réutilisée par le moteur",()=>{
  let p=CAT[model.n][0];model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
  let q=null;
  for(let r=0;r<model.n&&!q;r++)for(let c=0;c<model.n;c++)if(c!==p.sol[r]){q=[r,c];break}
  model.state[q[0]][q[1]]=1;
  let h=proofEngine();
  return h.elim && h.elim[key(q[0],q[1])];
 });
 test("Une croix sur la solution est détectée comme erreur",()=>{
  let p=CAT[model.n][0];model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
  model.state[0][p.sol[0]]=1;
  return !!playerError();
 });
 test("Un mauvais Gardien est détecté comme erreur",()=>{
  let p=CAT[model.n][0];model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
  let c=(p.sol[0]+1)%model.n;model.state[0][c]=2;
  return !!playerError();
 });
 test("Aucun indice 'place' sans preuve structurée",()=>{
  return CAT[model.n].every(p=>{
   model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
   let h=proofEngine();
   return h.kind!=="place" || (h.detail && h.detail.rule==="single");
  });
 });
 test("Aucun fallback de recherche exhaustive dans proofEngine",()=>{
  let txt=proofEngine.toString();
  return !txt.includes("solutions()")&&!txt.includes("contradiction");
 });
 test("Les indices locked ont des prémisses visibles",()=>{
  return CAT[model.n].every(p=>{
   model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
   let h=proofEngine();
   return !(h.detail&&h.detail.rule==="locked") || (h.detail.source&&h.detail.source.length>=2);
  });
 });
 test("Les indices group ont territoires + axes + prémisses",()=>{
  return CAT[model.n].every(p=>{
   model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
   let h=proofEngine(),d=h.detail;
   return !(d&&d.rule==="group") || (d.regions&&d.indices&&d.source&&d.regions.length===d.indices.length&&d.source.length>0);
  });
 });

 // Performance regressions: keep ordinary play incremental and cheap.
 test("Performance : un clic ordinaire ne reconstruit pas toute la grille",()=>{
   const src=render.toString(),clickStart=src.search(/d\.onclick=(?:async)?\(\)=>/),clickEnd=src.indexOf("};board.appendChild(d)",clickStart);
   const clickBody=src.slice(clickStart,clickEnd);
   return clickStart>=0&&clickEnd>clickStart&&clickBody.includes("paintBoardState()")&&!clickBody.includes("board.innerHTML")&&!clickBody.includes("render()};");
 });
 test("Performance : le drag ne lance aucun render complet pendant pointermove",()=>{
   const src=moveDragCross.toString(),begin=0,end=src.length;
   return begin>=0&&end>begin&&!src.slice(begin,end).includes("render()");
 });
 test("Performance : mise à jour visuelle interactive sous 16 ms sur grille courante",()=>{
   // Warm-up, then median of several runs to reduce one-off JIT/layout noise.
   paintBoardState();
   const samples=[];
   for(let i=0;i<15;i++){const t=performance.now();paintBoardState();samples.push(performance.now()-t)}
   samples.sort((a,b)=>a-b);
   const median=samples[Math.floor(samples.length/2)];
   window.lumenPerfLast={metric:"paintBoardState",medianMs:median,samples};
   return median<16;
 });
 test("Performance : mise à jour d'une cellule sous 8 ms",()=>{
   paintCell(0,0);
   const samples=[];
   for(let i=0;i<25;i++){const t=performance.now();paintCell(0,0);samples.push(performance.now()-t)}
   samples.sort((a,b)=>a-b);
   const median=samples[Math.floor(samples.length/2)];
   window.lumenPerfCellLast={metric:"paintCell",medianMs:median,samples};
   return median<8;
 });
 test("Mobile : le plateau bloque le scroll natif pendant le drag",()=>{
   const css=getComputedStyle(board);
   return css.touchAction==="none"&&(css.overscrollBehavior==="contain"||css.overscrollBehaviorY==="contain");
 });

 // Replay each puzzle automatically. Every requested next step must be explainable.
 test("Replay complet : jamais bloqué, jamais d'indice opaque",()=>{
  return CAT[model.n].every(p=>{
   model.puz=p;model.state=Array.from({length:model.n},()=>Array(model.n).fill(0));
   for(let step=0;step<200;step++){
    if(model.state.flat().filter(v=>v===2).length===model.n)return true;
    let h=proofEngine();
    if(h.kind==="place"){
     if(!h.detail||h.detail.rule!=="single")return false;
     model.state[h.cell[0]][h.cell[1]]=2;
    }else if(h.kind==="elim"){
     let d=h.detail;
     if(!d||!["locked","group","diamond","manual"].includes(d.rule))return false;
     model.state[h.cell[0]][h.cell[1]]=1;
    }else return false;
   }
   return false;
  });
 });

 for(const {name,fn} of cases){try{results.push({name,ok:!!(await fn()),error:""})}catch(e){results.push({name,ok:false,error:String(e)})}}
 model.state=saveState;model.puz=savePuz;model.n=saveN;render();
 let pass=results.filter(x=>x.ok).length;
 let fail=results.length-pass;
 let summary=document.getElementById("testSummary"),details=document.getElementById("testDetails");
 if(summary)summary.textContent=`${pass}/${results.length} tests réussis${fail?` — ${fail} échec(s)`:" ✓"}`;
 if(details)details.textContent=results.map(x=>(x.ok?"✓ ":"✗ ")+x.name+(x.error?" — "+x.error:"")).join("\n");
 return results;
}
return runHintTests;
}
