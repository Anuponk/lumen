import assert from 'node:assert/strict';
export async function verifyCockpit({send,evaluate,url}){
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL('/scripts/fixtures/incident-investigation.html',url).href});
 for(let i=0;i<100;i++){
  if(await evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'&&!!document.getElementById('incidentFixtureReady')`).catch(()=>false))break;
  await new Promise(r=>setTimeout(r,50));
 }
 const initial=await evaluate(`(async()=>{
  const {renderPlayerDirectory,renderPlayerSessions,registeredPlayers}=await import('/src/ui/cockpit-sessions.js');
  const markup=new DOMParser().parseFromString(await (await fetch('/index.html')).text(),'text/html');
  const host=document.importNode(markup.getElementById('adminCockpit'),true);host.id='cockpitFixture';host.hidden=false;document.body.append(host);
  const players=host.querySelector('#adminPlayers'),sessions=host.querySelector('#adminTimeline');let allowed=true;const chosen=[];
  const data={analytics:Array.from({length:100},(_,i)=>({session_id:'00000000-0000-0000-0000-'+String(Math.floor(i/5)).padStart(12,'0'),event_name:i%2?'hint_used':'attempt_started',quest_ordinal:91,occurred_at:new Date(Date.UTC(2026,9,25,5,0,i)).toISOString(),app_version:i<50?'1.11.1+100':'1.11.1+101'})),diagnostics:[]};
  const render=scope=>renderPlayerSessions(sessions,data,{scope,authorized:()=>allowed});
  render('admin:player');
  const directory=registeredPlayers([{player_key:'a:guest',display_name:'Joueur 3E8B',player_type:'anonymous'},{player_key:'u:actor',display_name:'Compte 1234',player_type:'authenticated',last_seen:'2026-10-25T05:00:00Z',sessions:20}],[{user_id:'actor',nickname:' ',email:'sans.pseudo@example.invalid'}]);
  renderPlayerDirectory(players,directory,{players:{'u:actor':{auth_at:'2026-10-23T05:00:00Z',domains:{wallet:'2026-10-24T05:00:00Z'},state:'pending'}}},{authorized:()=>allowed,onSelect:key=>chosen.push(key)});
  const cards=[...sessions.querySelectorAll('details[data-session-key]')];cards[0].querySelector('summary').focus();
  window.cockpitFixture={host,players,sessions,cards,data,render,chosen,deny:()=>{allowed=false;render('admin:player')}};
  return {count:cards.length,closed:cards.every(c=>!c.open),name:document.activeElement.tagName,emailFallback:players.querySelector('button').textContent==='sans.pseudo@example.invalid',allSectionsCollapsible:[...host.querySelectorAll('h3')].every(h=>h.parentElement.tagName==='SUMMARY'&&h.closest('details.admin-section')?.open),sectionCount:host.querySelectorAll('details.admin-section').length,anonymousHidden:!players.textContent.includes('Joueur 3E8B')&&players.querySelectorAll('.admin-player').length===1,stableOrdinal:sessions.textContent.includes('Q91'),sharedDateHelp:players.querySelectorAll('details[data-date-sources]').length===1&&players.querySelectorAll('.admin-player-dates small').length===0,overflow:document.documentElement.scrollWidth>innerWidth};
 })()`,true);
 assert.equal(initial.emailFallback,true);assert.equal(initial.allSectionsCollapsible,true);assert.equal(initial.sectionCount,11);assert.equal(initial.anonymousHidden,true);assert.equal(initial.sharedDateHelp,true);assert.equal(initial.stableOrdinal,true);assert.equal(initial.count,20);assert.equal(initial.closed,true);assert.equal(initial.name,'SUMMARY');assert.equal(initial.overflow,false);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 const state=await evaluate(`(()=>{const f=window.cockpitFixture;return {opened:f.cards[0].open,otherClosed:!f.cards[1].open}})()`);
 assert.equal(state.opened,true,JSON.stringify({...state,focus:await evaluate('document.activeElement.tagName')}));assert.equal(state.otherClosed,true);
 const refreshed=await evaluate(`(()=>{
  const f=window.cockpitFixture;f.render('admin:player');const first=f.sessions.querySelector('details[data-session-key]');
  const preserved=first.open;
  const filter=f.sessions.querySelector('select');filter.value='1.11.1+101';filter.dispatchEvent(new Event('change'));
  const filtered=f.sessions.querySelectorAll('details[data-session-key]').length;
  filter.value='all';filter.dispatchEvent(new Event('change'));
  const stillOpen=f.sessions.querySelector('details[data-session-key]').open;
  f.players.querySelector('button').click();
  const search=f.players.querySelector('input');search.value='absent';search.dispatchEvent(new Event('input'));
  const empty=f.players.textContent.includes('Aucun joueur');
  search.value='  SANS.PSEUDO@EXAMPLE.INVALID ';search.dispatchEvent(new Event('input'));
  const emailSearch=f.players.querySelectorAll('.admin-player').length===1;
  f.render('admin:other-player');const reset=[...f.sessions.querySelectorAll('details[data-session-key]')].every(c=>!c.open);
  const date=f.players.querySelector('time');f.deny();
  return {preserved,filtered,stillOpen,chosen:f.chosen,empty,emailSearch,reset,denied:f.sessions.children.length===0};
 })()`);
 assert.equal(refreshed.preserved,true);assert.equal(refreshed.filtered,10);assert.equal(refreshed.stillOpen,true);
 assert.deepEqual(refreshed.chosen,['u:actor']);assert.equal(refreshed.emailSearch,true);assert.equal(refreshed.empty,true);assert.equal(refreshed.reset,true);assert.equal(refreshed.denied,true);
 await evaluate(`(()=>{const f=window.cockpitFixture;const summary=f.host.querySelector('#adminFriction').closest('details').querySelector('summary');summary.focus()})()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
 const sections=await evaluate(`(()=>{const f=window.cockpitFixture,friction=f.host.querySelector('#adminFriction').closest('details');
  const keyboardClosed=!friction.open;f.render('refresh');const refreshPreserved=!friction.open;
  const emailRetained=f.players.querySelector('input').value==='  SANS.PSEUDO@EXAMPLE.INVALID ';
  const groups=[...f.host.querySelectorAll('details.admin-section')];
  for(const section of groups){if(section.open)section.querySelector('summary').click()}
  const allClosed=groups.every(s=>!s.open);for(const section of groups)section.querySelector('summary').click();
  return {keyboardClosed,refreshPreserved,emailRetained,allClosed,allReopened:groups.every(s=>s.open)};
 })()`);
 assert.deepEqual(sections,{keyboardClosed:true,refreshPreserved:true,emailRetained:true,allClosed:true,allReopened:true});
 const nested=await evaluate(`(()=>{
  const f=window.cockpitFixture,id='00000000-0000-0000-0000-000000000001';
  const event=(code,sequence)=>({session_id:id,trace_id:id,sequence,code,stage:'guided',kind:'unknown',app_version:'1.11.1+101',platform:'desktop',browser:'chromium'});
  return import('/src/ui/cockpit-sessions.js').then(({renderPlayerSessions})=>{
   renderPlayerSessions(f.sessions,{analytics:[],diagnostics:[event('guided_error',1),event('guided_input_blocked',2)]},{scope:'diagnostic-owner',authorized:()=>true});
   const session=f.sessions.querySelector('details[data-session-key]'),episode=session.querySelector('.diagnostic-incidents details');
   return {sessionClosed:!session.open,episodeClosed:!episode.open,report:!!session.querySelector('textarea'),reviewRequired:!session.querySelector('input').checked,draftHidden:[...session.querySelectorAll('a')].some(a=>a.hidden)};
  });
 })()`,true);
 assert.deepEqual(nested,{sessionClosed:true,episodeClosed:true,report:true,reviewRequired:true,draftHidden:true});
 const badges=await evaluate(`(async()=>{
  const {renderPlayerDirectory}=await import('/src/ui/cockpit-sessions.js'),f=window.cockpitFixture;
  const now=Date.parse('2026-10-25T12:00:00Z'),states=['confirmed','pending','failure','unknown','stale'];
  const players=states.map(state=>({player_key:'u:'+state,player_type:'authenticated',display_name:state+'@example.invalid',current_quest:48,sessions:8}));
  const proof={players:Object.fromEntries(states.map(state=>['u:'+state,{state:state==='stale'?'confirmed':state,observed_at:state==='stale'?'2026-10-25T10:00:00Z':'2026-10-25T11:59:00Z'}]))};
  renderPlayerDirectory(f.players,players,proof,{authorized:()=>true,now});
  const cards=[...f.players.querySelectorAll('.admin-player')],labels=cards.map(c=>c.querySelector('.admin-sync-badge').textContent);
  const collapsed=cards.every(c=>!c.querySelector('details.admin-player-proof').open);
  const compact=cards.every(c=>!c.querySelector('p').textContent.includes('authenticated'));
  const card=cards[0],details=card.querySelector('details.admin-player-proof');details.querySelector('summary').click();
  const evidence=details.open&&details.textContent.includes('Dernière connexion Auth')&&details.textContent.includes('Portefeuille');
  const filter=f.players.querySelectorAll('select')[1];filter.value='confirmed';filter.dispatchEvent(new Event('change'));
  const green=f.players.querySelectorAll('.admin-player').length===1&&f.players.querySelector('.admin-player').dataset.syncState==='confirmed';
  filter.value='unknown';filter.dispatchEvent(new Event('change'));const unknown=f.players.querySelectorAll('.admin-player').length;
  filter.value='all';filter.dispatchEvent(new Event('change'));
  return {labels,collapsed,compact,evidence,green,unknown,overflow:document.documentElement.scrollWidth>innerWidth};
 })()`,true);
 assert.deepEqual([...badges.labels].sort(),['✓ Sans attente observée','… En attente','! Problème signalé','? État inconnu','? Signal ancien'].sort());
 assert.equal(badges.collapsed,true);assert.equal(badges.compact,true);assert.equal(badges.evidence,true);assert.equal(badges.green,true);assert.equal(badges.unknown,2);assert.equal(badges.overflow,false);
 const ax=await send('Accessibility.getFullAXTree');
 assert(ax.nodes.some(n=>n.role?.value==='DisclosureTriangle'),'Native session disclosure appears in accessibility tree');
 return {initial,state,refreshed,sections,nested,badges,nativeKeyboard:true,accessibilityTree:true,liveRPC:false,physicalDevice:false};
}
