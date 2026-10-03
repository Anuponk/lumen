export function createTutorial(scriptedLearningActive){
const TUTORIAL_STEPS=[
 {title:"Ta mission",copy:"Positionne les 6 Gardiens : exactement un par ligne, un par colonne et un par territoire coloré.",visual:'<div class="tutorial-mini-grid"><span></span><span class="orb guardian-mini"></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>'},
 {title:"Les Gardiens gardent leurs distances",copy:"Deux Gardiens ne peuvent jamais être voisins, même en diagonale. Chaque Gardien doit avoir de l’espace autour de lui.",visual:'<div class="tutorial-mini-grid"><span class="orb guardian-mini"></span><span></span><span></span><span></span><span>↘</span><span class="orb guardian-mini"></span><span></span><span></span><span></span></div>'},
 {title:"Observe les emplacements impossibles",copy:"Au début, le Marquage auto marque pour toi les cases devenues impossibles. Concentre-toi sur les Gardiens et sur les déductions.",visual:'<div class="tutorial-mini-grid"><span></span><span class="dim">○</span><span></span><span></span><span class="orb guardian-mini"></span><span></span><span></span><span></span><span></span></div>'},
 {title:"LUMEN t’aide au début",copy:"Sur les quêtes 1 à 5, le Marquage auto est activée. Des quêtes 6 à 10, elle est désactivée par défaut mais reste disponible. À partir de la quête 11, elle reste optionnelle.",visual:"<span>1–5 ✦ → 6–10 ◐ → 11+ ✧</span>"},
 {title:"Bloqué ? Utilise Indice",copy:"LUMEN ne révèle pas simplement la solution : il te guide vers la prochaine déduction logique. Tu peux demander davantage de précision si nécessaire.",visual:"<span>💡 &nbsp; Indice logique</span>"}
];
let tutorialStep=0;
function renderTutorial(){
 const x=TUTORIAL_STEPS[tutorialStep],dots=document.getElementById("tutorialDots");
 document.getElementById("tutorialTitle").textContent=x.title;document.getElementById("tutorialCopy").textContent=x.copy;document.getElementById("tutorialVisual").innerHTML=x.visual;
 dots.innerHTML=TUTORIAL_STEPS.map((_,i)=>'<span class="tutorial-dot'+(i===tutorialStep?' on':'')+'"></span>').join("");
 document.getElementById("tutorialPrev").style.visibility=tutorialStep?"visible":"hidden";
 document.getElementById("tutorialNext").textContent=tutorialStep===TUTORIAL_STEPS.length-1?"✦ Allumer ma première constellation":"Suivant";
}
function openTutorial(){tutorialStep=0;renderTutorial();document.getElementById("tutorialOverlay").hidden=false}
function closeTutorial(mark=true){document.getElementById("tutorialOverlay").hidden=true;if(mark)try{localStorage.setItem("lumenTutorialSeen","1")}catch(e){}}
function setupTutorial(){
 const next=document.getElementById("tutorialNext"),prev=document.getElementById("tutorialPrev"),skip=document.getElementById("tutorialSkip");
 next.onclick=()=>{if(tutorialStep<TUTORIAL_STEPS.length-1){tutorialStep++;renderTutorial()}else closeTutorial()};
 prev.onclick=()=>{if(tutorialStep){tutorialStep--;renderTutorial()}};
 skip.onclick=()=>closeTutorial();help.onclick=openTutorial;
 let seen=false;try{seen=localStorage.getItem("lumenTutorialSeen")==="1"}catch(e){}
 if(!seen&&!scriptedLearningActive())openTutorial();
}



return {renderTutorial,openTutorial,closeTutorial,setupTutorial};
}
