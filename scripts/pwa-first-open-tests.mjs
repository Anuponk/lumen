// #832: Safari → installed app. The installed app's first opening on empty
// storage must offer account recovery before a new adventure, and an iOS guest
// is warned (never blocked) before installing. Node only, DOM stubbed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pwaFirstOpenEligible,createPwaFirstOpen} from '../src/ui/pwa-first-open.js';
import {installGuestWarning,IOS_GUEST_INSTALL_WARNING,requestedInstallCopy} from '../src/ui/install-request.js';
import {claimFirstWelcome} from '../src/ui/first-welcome.js';

// Eligibility: only an installed app, on storage proven empty, without session or challenge.
const base={standalone:true,firstVisit:true,signedIn:false,socialChallenge:false};
assert.equal(pwaFirstOpenEligible(base),true);
for(const change of [{standalone:false},{firstVisit:false},{signedIn:true},{socialChallenge:true}])
 assert.equal(pwaFirstOpenEligible({...base,...change}),false,JSON.stringify(change));

// "Empty storage" is the first-visit claim: any progress, owner, session or
// recovery copy means the player already has data here (no needless onboarding).
const store=entries=>{const data=new Map(entries);return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),key:i=>[...data.keys()][i]??null,get length(){return data.size}}};
const app=new URL('https://lumen.nopuna.fr/');
assert.equal(claimFirstWelcome(store([]),app),true,'An empty installed app is a first opening');
for(const entry of [['lumenProgressV1','{}'],['lumenCloudOwnerId','a'],['sb-project-auth-token','{}'],['lumenGuestBeforeAccount_a','{}'],['lumenTutorialSeen','1']])
 assert.equal(claimFirstWelcome(store([entry]),app),false,entry[0]+' is existing data, never a silent reset');

// DOM behaviour.
function dom(){
 const listeners=new Map(),node=(id,extra={})=>{const el={id,hidden:true,textContent:'',focused:false,addEventListener:(type,fn)=>listeners.set(id+':'+type,fn),focus(){focusId=id},...extra};return el};
 let focusId=null;
 const els={pwaWelcome:node('pwaWelcome'),pwaWelcomeRecover:node('pwaWelcomeRecover'),pwaWelcomeNew:node('pwaWelcomeNew'),pwaWelcomeConfirm:node('pwaWelcomeConfirm')};
 const main={inert:false};
 return {els,main,click:id=>listeners.get(id+':click')(),get focus(){return focusId},document:{getElementById:id=>els[id]??null,querySelector:selector=>selector==='main.app'?main:null}};
}
{
 const d=dom(),choices=[];
 const welcome=createPwaFirstOpen({document:d.document,onRecover:()=>choices.push('recover'),onNewAdventure:()=>choices.push('new')});
 welcome.show();
 assert.equal(d.els.pwaWelcome.hidden,false);assert.equal(d.main.inert,true,'The game stays inert behind the choice');
 assert.equal(d.focus,'pwaWelcomeRecover','“J’ai déjà joué” is the primary action');
 d.click('pwaWelcomeRecover');
 assert.deepEqual(choices,['recover']);assert.equal(d.els.pwaWelcome.hidden,true);assert.equal(d.main.inert,false,'Sign-in dialog inside the game is usable');
}
{
 const d=dom(),choices=[];
 const welcome=createPwaFirstOpen({document:d.document,onRecover:()=>choices.push('recover'),onNewAdventure:()=>choices.push('new')});
 welcome.show();d.click('pwaWelcomeNew');
 assert.deepEqual(choices,[],'A new local adventure needs an explicit confirmation');
 assert.equal(d.els.pwaWelcomeConfirm.hidden,false);assert.match(d.els.pwaWelcomeNew.textContent,/^Oui, commencer/);
 d.click('pwaWelcomeNew');
 assert.deepEqual(choices,['new']);assert.equal(d.els.pwaWelcome.hidden,true);assert.equal(d.main.inert,false);
}
assert.equal(createPwaFirstOpen({document:{getElementById:()=>null,querySelector:()=>null},onRecover(){},onNewAdventure(){}}),null,'Missing markup never blocks startup');

// Pre-install warning: iOS guests only, the install itself is still offered.
assert.equal(installGuestWarning({ios:true,guest:true}),IOS_GUEST_INSTALL_WARNING);
assert.match(IOS_GUEST_INSTALL_WARNING,/crée un compte et synchronise ton ciel avant de l’ajouter à ton écran d’accueil/);
for(const v of [{ios:true,guest:false},{ios:false,guest:true},{ios:false,guest:false}])assert.equal(installGuestWarning(v),null,JSON.stringify(v));
assert.equal(requestedInstallCopy({prompt:false,ios:true}).button,'J’ai compris','Install instructions are unchanged');

// Wiring and copy: no promise of automatic Safari recovery.
const ui=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/id="pwaWelcomeRecover"[^>]*>J’ai déjà joué — Retrouver ma progression</);
assert.match(html,/id="pwaWelcomeNew"[^>]*>Commencer une nouvelle aventure</);
for(const step of ['Rouvre LUMEN dans Safari','Crée un compte','Progression synchronisée','Reviens dans l’application installée','connecte-toi'])assert(html.includes(step),step);
assert.doesNotMatch(html,/récupér\w+ automatiquement/i,'Never promise automatic recovery of anonymous Safari data');
assert.match(html,/id="installOptinWarning"[^>]*hidden/);assert.match(html,/id="installCreateAccount"[^>]*hidden/);
assert.match(ui,/pwaFirstOpenEligible\(\{standalone:lumenIsStandalone\(\),firstVisit:true,signedIn:!!lumenUser/);
assert.match(ui,/onRecover:\(\)=>\{trackLumenEvent\([^;]*\);openEmailAccountOffer\("login"\)\}/);
assert.match(ui,/onNewAdventure:\(\)=>\{trackLumenEvent\([^;]*\);firstWelcome\.show\(\)\}/);
assert.match(ui,/applyInstallGuestWarning\(ios\);/);
assert.match(html,/Chargement de ton ciel…/,'Neutral loading copy (#789) during auth/hydration');
console.log('PWA first open (#832): eligibility, existing-data guard, recover/new choice with confirmation, iOS guest install warning and copy passed');
