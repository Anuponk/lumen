import assert from 'node:assert/strict';
export async function verifyCockpit({send,evaluate,url}){
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL('/scripts/fixtures/incident-investigation.html',url).href});
 for(let i=0;i<100;i++){
  if(await evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'&&!!document.getElementById('incidentFixtureReady')`).catch(()=>false))break;
  await new Promise(r=>setTimeout(r,50));
 }
 const initial=await evaluate(`(async()=>{
  const {renderPlayerDirectory,renderPlayerSessions}=await import('/src/ui/cockpit-sessions.js');
  const host=document.createElement('main');host.id='cockpitFixture';host.className='admin-cockpit';host.innerHTML='<div class="admin-cockpit-shell"><section id="players"></section><section id="sessions" class="admin-timeline"></section></div>';document.body.append(host);
  const players=host.querySelector('#players'),sessions=host.querySelector('#sessions');let allowed=true;const chosen=[];
  const data={analytics:Array.from({length:100},(_,i)=>({session_id:'00000000-0000-0000-0000-'+String(Math.floor(i/5)).padStart(12,'0'),event_name:i%2?'hint_used':'attempt_started',quest_ordinal:91,occurred_at:new Date(Date.UTC(2026,9,25,5,0,i)).toISOString(),app_version:i<50?'1.11.1+100':'1.11.1+101'})),diagnostics:[]};
  const render=scope=>renderPlayerSessions(sessions,data,{scope,authorized:()=>allowed});
  render('admin:player');
  renderPlayerDirectory(players,[{player_key:'u:actor',display_name:'Joueur synthétique',player_type:'authenticated',last_seen:'2026-10-25T05:00:00Z',sessions:20}],{players:{'u:actor':{auth_at:'2026-10-23T05:00:00Z',domains:{wallet:'2026-10-24T05:00:00Z'},state:'pending'}}},{authorized:()=>allowed,onSelect:key=>chosen.push(key)});
  const cards=[...sessions.querySelectorAll('details[data-session-key]')];cards[0].querySelector('summary').focus();
  window.cockpitFixture={host,players,sessions,cards,data,render,chosen,deny:()=>{allowed=false;render('admin:player')}};
  return {count:cards.length,closed:cards.every(c=>!c.open),name:document.activeElement.tagName,stableOrdinal:sessions.textContent.includes('Q91'),sharedDateHelp:players.querySelectorAll('details[data-date-sources]').length===1&&players.querySelectorAll('.admin-player-dates small').length===0,overflow:document.documentElement.scrollWidth>innerWidth};
 })()`,true);
 assert.equal(initial.sharedDateHelp,true);assert.equal(initial.stableOrdinal,true);assert.equal(initial.count,20);assert.equal(initial.closed,true);assert.equal(initial.name,'SUMMARY');assert.equal(initial.overflow,false);
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
  f.render('admin:other-player');const reset=[...f.sessions.querySelectorAll('details[data-session-key]')].every(c=>!c.open);
  const date=f.players.querySelector('time');f.deny();
  return {preserved,filtered,stillOpen,chosen:f.chosen,empty,reset,denied:f.sessions.children.length===0};
 })()`);
 assert.equal(refreshed.preserved,true);assert.equal(refreshed.filtered,10);assert.equal(refreshed.stillOpen,true);
 assert.deepEqual(refreshed.chosen,['u:actor']);assert.equal(refreshed.empty,true);assert.equal(refreshed.reset,true);assert.equal(refreshed.denied,true);
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
 const ax=await send('Accessibility.getFullAXTree');
 assert(ax.nodes.some(n=>n.role?.value==='DisclosureTriangle'),'Native session disclosure appears in accessibility tree');
 return {initial,state,refreshed,nested,nativeKeyboard:true,accessibilityTree:true,liveRPC:false,physicalDevice:false};
}
