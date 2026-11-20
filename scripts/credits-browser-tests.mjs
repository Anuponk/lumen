// #740: « Crédits et sources » is reachable from the account menu and readable at 360×640.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

const {send,evaluate,errors}=await connectBrowser();
const base=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(expr,label)=>{let last;for(let i=0;i<150;i++){try{if(await evaluate(expr))return}catch(e){last=e}await sleep(100)}throw Error('Timed out: '+label+(last?' ('+last.message+')':''))};
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:2,mobile:true});
 const qa=new URL(base);qa.searchParams.set('qa','new');
 await navigateAndWait({send,evaluate},'Page.navigate',{url:qa.href});
 await until('document.querySelectorAll("#board .cell").length>0','board');
 await evaluate(`document.querySelector('.first-welcome:not([hidden]) .intro-play')?.click();document.querySelector('#pwaFirstOpen:not([hidden]) button')?.click()`);
 await acknowledgeLearningMilestones(evaluate).catch(()=>{});
 // Guests reach it too: open the account menu from the header.
 await evaluate(`(()=>{const w=document.getElementById('firstWelcome');if(w)w.hidden=true;document.getElementById('mobileAccount').click()})()`);
 await until('!document.getElementById("mobileAuthPopover").hidden','account menu');
 assert.equal(await evaluate('document.getElementById("creditsPanel").hidden'),true,'Credits start collapsed');
 await evaluate(`document.getElementById('showCredits').click()`);
 await until('!document.getElementById("creditsPanel").hidden','credits panel');
 await evaluate(`document.getElementById('creditsPanel').scrollIntoView({block:'nearest'})`);
 await sleep(200);
 const m=await evaluate(`(()=>{const p=document.getElementById('creditsPanel'),menu=document.getElementById('mobileAuthPopover'),r=p.getBoundingClientRect(),mr=menu.getBoundingClientRect(),cs=getComputedStyle(p.querySelector('p'));
  return {text:p.innerText,links:[...p.querySelectorAll('a')].map(a=>({href:a.href,text:a.textContent.trim(),target:a.target,rel:a.rel})),
   expanded:document.getElementById('showCredits').getAttribute('aria-expanded'),inMenu:r.left>=mr.left-1&&r.right<=mr.right+1,
   fontSize:parseFloat(cs.fontSize),overflowX:document.documentElement.scrollWidth>innerWidth||p.scrollWidth>p.clientWidth+1,menuInViewport:mr.left>=0&&mr.right<=innerWidth}})()`);
 assert.match(m.text,/Données de constellations Western © équipe Stellarium, CC BY-SA ; coordonnées stellaires Hipparcos II \(ESA\) via CDS VizieR\. Projection et adaptation pour Lumen\./);
 assert.match(m.text,/restent sous licence CC BY-SA/,'ShareAlike scope is stated');
 const hrefs=m.links.map(l=>l.href);
 assert(hrefs.some(h=>h.startsWith('https://github.com/Stellarium/stellarium-skycultures/')),'Stellarium source link');
 assert(hrefs.some(h=>h.startsWith('https://creativecommons.org/licenses/by-sa/')),'CC BY-SA licence link');
 assert(hrefs.some(h=>h.startsWith('https://vizier.cds.unistra.fr/')),'Hipparcos source link');
 for(const l of m.links){assert.equal(l.target,'_blank');assert.match(l.rel,/noopener/)}
 assert.equal(m.expanded,'true');assert.equal(m.inMenu,true);assert.equal(m.menuInViewport,true);
 assert.equal(m.overflowX,false,'No horizontal overflow at 360 px');assert(m.fontSize>=12,'Readable text: '+m.fontSize);
 await evaluate(`document.getElementById('closeCredits').click()`);
 assert.equal(await evaluate('document.getElementById("creditsPanel").hidden'),true,'Close button collapses the credits');
 assert.equal(await evaluate('document.activeElement?.id'),'showCredits','Focus returns to the menu entry');
 const board=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)');
 const discovery='https://lumen.nopuna.fr/decouvrir.html';
 const invite='document.getElementById("inviteLumenFriends")';
 const copy='document.getElementById("lumenShareCopy")';
 const dialog='document.getElementById("lumenShareDialog")';
 await evaluate(`Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.sharedInvitation=data;throw new DOMException('Cancelled','AbortError')}}); ${invite}.focus()`);
 assert.equal(await evaluate('document.activeElement.id'),'inviteLumenFriends');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 await until('!!window.sharedInvitation','native invitation');
 assert.deepEqual(await evaluate('window.sharedInvitation'),{title:'Découvrir Lumen',text:'✨ J’ai découvert Lumen, un jeu de logique où tu rallumes les constellations. Tu veux essayer ?',url:discovery+'?utm_source=player_invite&utm_medium=referral'},'Inviter carries its own campaign code, distinct from Partager (#881 Lot 1)');
 assert.equal(await evaluate(dialog+'.open'),false,'Cancellation stays quiet');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate(`Object.defineProperty(navigator,'share',{value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.copiedLink=value}});${invite}.click()`);
 await until(dialog+'.open','desktop share fallback');
 await evaluate(copy+'.click()');
 await until('window.copiedLink!==undefined','copy action');
 const copied=await evaluate('({status:document.getElementById("lumenShareStatus").textContent,link:window.copiedLink,manual:!document.getElementById("lumenShareManual").hidden})');
 assert.deepEqual(copied,{status:'Lien copié !',link:discovery,manual:false});
 assert.equal(await evaluate('window.copiedLink'),discovery);
 await evaluate(`Object.defineProperty(navigator,'clipboard',{value:undefined});${copy}.click()`);
 await until('document.activeElement.id==="lumenShareSelection"','manual selection focus');
 assert.deepEqual(await evaluate('(()=>{const e=document.activeElement;return [e.readOnly,e.value.slice(e.selectionStart,e.selectionEnd)]})()'),[true,discovery]);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until('!'+dialog+'.open&&document.activeElement.id==="inviteLumenFriends"','Escape and focus restoration');
 assert.equal(await evaluate('location.pathname'),base.pathname);
 assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)'),board);
 assert.deepEqual(errors,[]);
 const report={viewport:'360x640',links:m.links.length,fontSize:m.fontSize,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
