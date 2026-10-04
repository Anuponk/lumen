export function createTutorial(scriptedLearningActive){
const TUTORIAL_STEPS=[
 {title:"Ta mission",copy:"Positionne les 6 Gardiens : exactement un par ligne, un par colonne et un par territoire coloré.",visual:'<div class="tutorial-mini-grid"><span></span><span class="orb guardian-mini"></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>'},
 {title:"Les Gardiens gardent leurs distances",copy:"Deux Gardiens ne peuvent jamais être voisins, même en diagonale. Chaque Gardien doit avoir de l’espace autour de lui.",visual:'<div class="tutorial-mini-grid"><span class="orb guardian-mini"></span><span></span><span></span><span></span><span>↘</span><span class="orb guardian-mini"></span><span></span><span></span><span></span></div>'},
 {title:"Observe les emplacements impossibles",copy:"Une croix écarte une case. Touche une fois pour la marquer ; maintiens et glisse pour écarter plusieurs cases.",visual:'<div class="tutorial-mini-grid"><span></span><span class="dim">○</span><span></span><span></span><span class="orb guardian-mini"></span><span></span><span></span><span></span><span></span></div>'},
 {title:"LUMEN t’aide au début",copy:"Sur les quêtes 1 à 5, tu marques les cases toi-même et Assist explique les conflits. Le Marquage auto devient disponible à la quête 6, désactivé par défaut.",visual:"<span>1–5 ✦ → 6–10 ◐ → 11+ ✧</span>"},
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
 skip.onclick=()=>closeTutorial();
 let seen=false;try{seen=localStorage.getItem("lumenTutorialSeen")==="1"}catch(e){}
 if(!seen&&!scriptedLearningActive())openTutorial();
}



return {renderTutorial,openTutorial,closeTutorial,setupTutorial};
}
