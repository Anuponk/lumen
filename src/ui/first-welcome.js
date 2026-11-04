// Presentation only: no campaign, attempt, reward or cloud writer belongs here.
import {createIntroMusic} from './intro-music.js';
export const INTRO_SEEN_KEY='lumenIntroPresentedV1';
export const INTRO_SCENES=Object.freeze([
 {start:0,text:"Le ciel s'est assombri."},
 {start:4000,text:"Les constellations sommeillent dans l'ombre."},
 {start:8000,text:'Une dernière lueur peut encore les éveiller.'},
 {start:13000,text:'Chaque énigme résolue rendra une étoile au ciel.'},
 {start:18000,text:'À toi de réveiller les étoiles.'}
]);
export const INTRO_DURATION=24000;

// Called before normal startup creates/restores the board. Unknown or returning
// contexts always retain ordinary startup. The marker is not an Auth preference.
export function claimFirstWelcome(storage,url){
 try{
  if(url.search||url.hash)return false;
  if([INTRO_SEEN_KEY,'lumenProgressV1','lumenActiveAttemptV1','lumenCloudOwnerId','lumenLastSeen','lumenTutorialSeen']
   .some(key=>storage.getItem(key)!==null))return false;
  // A locally remembered session/recovery context must not be treated as new.
  for(let i=0;i<storage.length;i++)if(/^sb-|^lumenGuest|^lumen.*(?:Outbox|Recovery|Checkpoint)/i.test(storage.key(i)||''))return false;
  storage.setItem(INTRO_SEEN_KEY,'1');
  return storage.getItem(INTRO_SEEN_KEY)==='1';
 }catch{return false}
}

export function createIntroTimeline({now,onFrame,onFinish}){
 let elapsed=0,last=null,running=false,finished=false;
 function frame(){
  if(!running||finished)return;
  const current=now();
  if(last!==null)elapsed+=Math.max(0,current-last);
  last=current;
  if(elapsed>=INTRO_DURATION){finished=true;running=false;onFinish();return}
  let scene=0;
  while(scene+1<INTRO_SCENES.length&&elapsed>=INTRO_SCENES[scene+1].start)scene++;
  onFrame({elapsed,scene,passage:Math.max(0,Math.min(1,(elapsed-18000)/6000))});
 }
 return {
  start(){if(finished)return;running=true;last=now();frame()},
  frame,
  pause(){if(!running)return;frame();running=false;last=null},
  resume(){if(finished)return;running=true;last=now()},
  stop(){running=false;finished=true},
  get elapsed(){return elapsed}
 };
}

export function createFirstWelcome({document,window,figureSvg,contextKey,onReplayStart=()=>{},onReturn=()=>{}}){
 const root=document.createElement('section');
 root.className='first-welcome';root.hidden=true;
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Lumen — Le réveil du ciel');
 root.innerHTML=`<div class="intro-veil" aria-hidden="true"></div>
  <div class="intro-art" aria-hidden="true"><svg viewBox="0 0 290 115" preserveAspectRatio="xMidYMid meet">${figureSvg}</svg></div>
  <button type="button" class="intro-skip" aria-label="Passer l’introduction" hidden>Passer</button>
  <button type="button" class="intro-music" aria-pressed="false" hidden>Musique coupée</button>
  <div class="intro-welcome"><h2 class="lumen-brand">LUMEN</h2>
   <p>Le ciel a perdu ses étoiles.<br>À toi de les réveiller.</p>
   <div class="intro-actions"><button type="button" class="intro-story">Regarder la cinématique</button>
   <button type="button" class="intro-play">Aller directement à l’aventure</button></div></div>
  <p class="intro-caption" aria-hidden="true" hidden></p>
  <details class="intro-transcript" hidden><summary>Lire le récit</summary><div></div></details>`;
 const transcript=root.querySelector('.intro-transcript div');
 for(const scene of INTRO_SCENES){const p=document.createElement('p');p.textContent=scene.text;transcript.append(p)}
 document.body.append(root);
 const app=document.querySelector('main.app'),welcome=root.querySelector('.intro-welcome'),caption=root.querySelector('.intro-caption'),
  skip=root.querySelector('.intro-skip'),story=root.querySelector('.intro-story'),play=root.querySelector('.intro-play'),
  reading=root.querySelector('.intro-transcript'),motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let active=false,mode=null,origin=null,captured=null,raf=null,timeline=null,appWasInert=false,lastScene=-1;
 const musicButton=root.querySelector('.intro-music');
 const music=createIntroMusic({window,onChange:updateMusic});
 function updateMusic(){musicButton.textContent=music.enabled?'Musique activée':'Musique coupée';musicButton.setAttribute('aria-pressed',String(music.enabled))}
 updateMusic();
 const reduced=()=>root.classList.toggle('intro-reduced',motion.matches);
 function close(restoreFocus=true){
  if(!active)return;
  active=false;timeline?.stop();music.stop();window.cancelAnimationFrame(raf);raf=null;
  root.hidden=true;root.classList.remove('intro-playing');root.style.removeProperty('--intro-passage');
  if(app)app.inert=appWasInert;
  const returnTo=origin;origin=null;
  if(restoreFocus)onReturn({replay:mode==='replay',origin:returnTo});
 }
 function pump(){
  if(!active)return;
  try{
   if(contextKey()!==captured){root.dataset.exit='context-changed';close(false);return}
   if(!document.hidden)timeline?.frame();
   if(active)raf=window.requestAnimationFrame(pump);
  }catch{root.dataset.exit='animation-failed';close()}
 }
 function open(replay=false){
  if(active)return;
  if(replay)onReplayStart();
  origin=document.activeElement;captured=contextKey();mode=replay?'replay':'first';lastScene=-1;
  music.resetPreference();
  appWasInert=!!app?.inert;if(app)app.inert=true;
  active=true;root.hidden=false;root.classList.remove('intro-paused');root.dataset.scene='0';root.style.setProperty('--intro-passage','0');
  welcome.hidden=replay;skip.hidden=!replay;musicButton.hidden=!replay;caption.hidden=!replay;reading.hidden=!replay;reading.open=false;
  reduced();
  if(replay)startStory();else story.focus();
  if(active)raf=window.requestAnimationFrame(pump);
 }
 function startStory(){
  if(!active||timeline)return;
  welcome.hidden=true;skip.hidden=false;musicButton.hidden=false;caption.hidden=false;reading.hidden=false;
  root.classList.add('intro-playing');
  timeline=createIntroTimeline({now:()=>window.performance.now(),onFinish:()=>close(),onFrame:({scene,passage})=>{
   if(scene!==lastScene){lastScene=scene;root.dataset.scene=String(scene);caption.textContent=INTRO_SCENES[scene].text}
   root.style.setProperty('--intro-passage',String(passage));
  }});
  timeline.start();if(!document.hidden&&!reading.open)music.start(timeline.elapsed);skip.focus();
 }
 play.onclick=()=>close();story.onclick=startStory;skip.onclick=()=>close();
 musicButton.onclick=()=>{music.setEnabled(!music.enabled);if(music.enabled&&active&&timeline&&!document.hidden&&!reading.open)music.start(timeline.elapsed)};
 // Keep timed reading optional: the transcript pauses at the current scene.
 reading.addEventListener('toggle',()=>{if(active&&timeline){root.classList.toggle('intro-paused',document.hidden||reading.open);if(reading.open){timeline.pause();music.pause()}else if(!document.hidden){timeline.resume();music.start(timeline.elapsed)}}});
 root.addEventListener('keydown',event=>{
  event.stopPropagation();
  if(event.key==='Escape'){event.preventDefault();close();return}
  if(event.key!=='Tab')return;
  const buttons=[...root.querySelectorAll('button,summary')].filter(el=>!el.closest('[hidden]'));
  const first=buttons[0],last=buttons.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 });
 const visibility=()=>{if(!active||!timeline)return;root.classList.toggle('intro-paused',document.hidden||reading.open);if(document.hidden){timeline.pause();music.pause()}else if(!reading.open){timeline.resume();music.start(timeline.elapsed)}};
 const pagehide=()=>close(false);
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',pagehide);
 motion.addEventListener('change',reduced);
 return {
  get active(){return active},
  show(){timeline=null;open(false)},
  replay(){if(active)return;timeline=null;open(true)},
  cancel(){close(false)},
  destroy(){close(false);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);motion.removeEventListener('change',reduced);root.remove()}
 };
}
