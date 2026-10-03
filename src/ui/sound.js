export function createSound(){
let soundEnabled=localStorage.getItem("lumenSound")!=="off",audioCtx=null;
function audioContext(){if(!soundEnabled)return null;try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume();return audioCtx}catch(e){return null}}
function tone(freq,dur=.09,vol=.035,delay=0,type="sine"){const a=audioContext();if(!a)return;const t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+.03)}
function guardianSound(q){tone(420+q*48,.11,.085)}
function errorSound(){tone(145,.16,.09,0,"triangle")}
function halfSound(){tone(560,.16,.08);tone(740,.22,.085,.11)}
function victorySound(){tone(523,.28,.09);tone(659,.3,.085,.1);tone(784,.5,.105,.2)}
function starArrivalSound(){tone(988,.28,.085);tone(1318,.42,.07,.08)}
function constellationSound(){[523,659,784,1047].forEach((f,i)=>tone(f,.62,.105,i*.13))}
function updateSoundToggle(){const b=document.getElementById("soundToggle");if(!b)return;b.textContent=soundEnabled?"🔊":"🔇";b.setAttribute("aria-label",soundEnabled?"Couper les sons":"Activer les sons")}
const soundToggle=document.getElementById("soundToggle");if(soundToggle){updateSoundToggle();soundToggle.onclick=()=>{soundEnabled=!soundEnabled;localStorage.setItem("lumenSound",soundEnabled?"on":"off");updateSoundToggle();if(soundEnabled){tone(660,.1,.075);tone(880,.16,.065,.08)}}}
document.addEventListener("pointerdown",()=>{if(soundEnabled)audioContext()},{once:true});

function setSoundEnabled(value){soundEnabled=value}
return {audioContext,tone,guardianSound,errorSound,halfSound,victorySound,starArrivalSound,constellationSound,updateSoundToggle,setSoundEnabled};
}
