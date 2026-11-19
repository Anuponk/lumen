// #832: an installed app (iOS home screen PWA) may not share Safari's storage.
// Its first opening without a session or local progress must not look like a
// silent reset: offer "J'ai déjà joué" (sign in) before a new adventure.
// Presentation only: no progress, attempt, reward or cloud writer belongs here.

// Eligible only when the first-visit claim already proved that this storage
// holds no progress, attempt, owner, session or recovery data.
export function pwaFirstOpenEligible({standalone,firstVisit,signedIn,socialChallenge}){
 return !!standalone&&!!firstVisit&&!signedIn&&!socialChallenge;
}

export function createPwaFirstOpen({document,onRecover,onNewAdventure}){
 const root=document.getElementById('pwaWelcome');
 const recover=document.getElementById('pwaWelcomeRecover');
 const fresh=document.getElementById('pwaWelcomeNew');
 const confirm=document.getElementById('pwaWelcomeConfirm');
 if(!root||!recover||!fresh||!confirm)return null;
 const app=document.querySelector('main.app');
 let active=false,confirming=false,appWasInert=false;
 function close(){
  if(!active)return;
  active=false;root.hidden=true;
  if(app)app.inert=appWasInert;
 }
 recover.addEventListener('click',()=>{close();onRecover()});
 fresh.addEventListener('click',()=>{
  // Second tap confirms: a new local adventure is an explicit choice.
  if(!confirming){
   confirming=true;confirm.hidden=false;
   fresh.textContent='Oui, commencer une nouvelle aventure';fresh.focus();return;
  }
  close();onNewAdventure();
 });
 return {
  get active(){return active},
  show(){
   if(active)return;
   active=true;confirming=false;confirm.hidden=true;
   fresh.textContent='Commencer une nouvelle aventure';
   appWasInert=!!app?.inert;if(app)app.inert=true;
   root.hidden=false;recover.focus();
  },
  cancel:close
 };
}
