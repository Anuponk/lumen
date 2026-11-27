// #1020/#960 · Real DOM, synthetic RPC: the administrators' reports inbox (filters,
// counters, paging, linked diagnostic on demand, idempotent answer, resolution) and
// the player's « Mes signalements » (unread badge, read on open, complementary reply).
import assert from 'node:assert/strict';
export async function verifyAssistance({ send, evaluate, url }) {
  const previous = await evaluate('performance.timeOrigin');
  await send('Page.navigate', { url: new URL('/scripts/fixtures/incident-investigation.html', url).href });
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'&&!!document.getElementById('incidentFixtureReady')`).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const admin = await evaluate(
    `(async()=>{
  const {mountFeedbackInbox}=await import('/src/ui/feedback-inbox.js');
  const host=document.createElement('div');document.body.append(host);
  const calls=[];let failReply=1,thread=[];
  const item=(id,extra={})=>({id,created_at:'2026-11-24T08:05:00Z',kind:'bug',status:'new',message:'<img src=x onerror=alert(1)> bloqué',player_key:'u:p'+id,player_label:'Joueur '+id,app_version:'1.11.1+785 f101c59',context:{platform:'android-pwa',quest_ordinal:692},journal_count:40,snapshot:true,capture:true,messages:0,needs_action:true,...extra});
  const rpc=async(name,args)=>{calls.push([name,args]);
   if(name==='lumen_admin_feedback_inbox')return {data:{items:args.p_before?[item(1)]:[item(3),item(2,{status:'answered',needs_action:false,answered_at:'2026-11-24T09:00:00Z'})],counts:{all:3,action:2,new:2,reviewed:0,answered:1,closed:0},next_before:args.p_before?null:2}};
   if(name==='lumen_admin_feedback_detail')return {data:{id:args.p_id,status:'new',player_key:'u:p3',journal:[{event:'flush_success',at:'2026-11-24T08:01:00Z'}],thread,
    snapshot:{taken_at:'2026-11-24T08:05:00Z',surface:'help',online:true,sync:{hydration:'ready',pending_canonical:0,last_success:'flush_success',last_success_at:'2026-11-24T08:01:00Z'},quest:{adventure:'base',ordinal:692},attempt:{state:'PAUSED',elapsed_s:83,help_hint:1},board:'0120/0003/1000/0000'},
    capture:{state:'received',case_id:'00000000-0000-4000-8000-000000000960',capture_id:'c',received_at:'2026-11-24T08:05:02Z',bytes:306133}}};
   if(name==='lumen_admin_feedback_reply'){if(failReply-->0)return {error:{message:'network'}};thread=[...thread,{by:'admin',body:args.p_body,at:new Date().toISOString()}];return {data:{id:args.p_id,status:args.p_resolve?'closed':'answered'}}}
   if(name==='lumen_admin_feedback_set_status')return {data:{id:args.p_id,status:args.p_status}};
   return {data:null}};
  const opened=[],dossiers=[];
  const inbox=mountFeedbackInbox(host,{rpc,authorized:()=>true,onPlayer:key=>opened.push(key),onDossier:(_h,o)=>{dossiers.push(o.reference)}});
  await inbox.load();
  const chips=[...host.querySelectorAll('[data-inbox-status]')].map(c=>c.textContent);
  const xss=!host.querySelector('img')&&host.textContent.includes('<img src=x');
  const listHasNoHeavy=calls.filter(c=>c[0]==='lumen_admin_feedback_detail').length===0;
  host.querySelector('button:not([data-inbox-status])+p+div+button, button[hidden]');
  const more=[...host.querySelectorAll('button')].find(b=>b.textContent.includes('plus anciens'));
  await inbox.load({append:true});
  const paged=host.querySelectorAll('.admin-inbox-item').length===3&&more.hidden;
  const card=host.querySelector('[data-feedback-id="3"]');card.open=true;card.dispatchEvent(new Event('toggle'));
  for(let i=0;i<40&&!card.querySelector('form');i++)await new Promise(r=>setTimeout(r,25));
  const synthesis=card.querySelector('.admin-inbox-synthesis').textContent;
  const board=card.querySelector('.admin-inbox-board').textContent;
  card.querySelector('.admin-inbox-links button').click();
  const area=card.querySelector('form textarea');area.value='Merci, corrigé dans la prochaine version.';
  card.querySelector('form').requestSubmit();for(let i=0;i<40&&!card.querySelector('form p').textContent.includes('non confirmée');i++)await new Promise(r=>setTimeout(r,25));
  const failedKept=area.value.length>0;
  card.querySelector('form').requestSubmit();for(let i=0;i<40&&!card.querySelector('form p').textContent.includes('envoyée');i++)await new Promise(r=>setTimeout(r,25));
  const replies=calls.filter(c=>c[0]==='lumen_admin_feedback_reply').map(c=>c[1].p_message_ref);
  const status=card.querySelector('.admin-inbox-status').textContent;
  const select=card.querySelector('form select');select.value='closed';select.dispatchEvent(new Event('change'));
  for(let i=0;i<40&&card.dataset.status!=='closed';i++)await new Promise(r=>setTimeout(r,25));
  await inbox.filterPlayer('u:p3','Joueur 3');
  const playerFilter=calls.at(-1)[1].p_player==='u:p3'&&host.querySelector('.admin-inbox-player').textContent.includes('Joueur 3');
  host.remove();
  return {chips,xss,listHasNoHeavy,paged,synthesis:/Copie complète reçue/.test(synthesis)&&/PAUSED/.test(synthesis)&&/Q692/.test(synthesis)&&/flush_success/.test(synthesis),
   board:board.split('\\n').length===4&&board.includes('◆'),opened,dossiers,failedKept,sameRef:replies.length===2&&replies[0]===replies[1],status,resolved:card.dataset.status==='closed',playerFilter,
   overflow:document.documentElement.scrollWidth>innerWidth};
 })()`,
    true,
  );
  assert.deepEqual(admin.chips, ['À traiter 2', 'Tous 3', 'Reçus 2', 'En cours 0', 'Réponse disponible 1', 'Résolus 0']);
  assert.equal(admin.xss, true, 'player text is never HTML');
  assert.equal(admin.listHasNoHeavy, true, 'the list never loads diagnostics');
  assert.equal(admin.paged, true, 'older reports page in on demand');
  assert.equal(admin.synthesis, true, 'readable synthesis: capture, attempt, quest, last success');
  assert.equal(admin.board, true, 'board of the moment');
  assert.deepEqual(admin.opened, ['u:p3'], 'report → player');
  assert.deepEqual(admin.dossiers, ['00000000-0000-4000-8000-000000000960'], 'report → its exact support dossier');
  assert.equal(admin.failedKept, true, 'a failed answer keeps the draft');
  assert.equal(admin.sameRef, true, 'the retry reuses the reference (no duplicate)');
  assert.equal(admin.status, 'Réponse disponible');
  assert.equal(admin.resolved, true);
  assert.equal(admin.playerFilter, true, 'player → reports');
  assert.equal(admin.overflow, false);

  const player = await evaluate(
    `(async()=>{
  const {createMyReports}=await import('/src/ui/my-reports.js');
  const markup=new DOMParser().parseFromString(await(await fetch('/index.html')).text(),'text/html');
  for(const id of ['myReportsModal','myReportsBtn']){const node=document.importNode(markup.getElementById(id),true);document.body.append(node)}
  const account=document.createElement('button');account.id='mobileAccount';document.body.append(account);
  localStorage.setItem('lumenFeedbackRefsV1',JSON.stringify(['rGuestSecretReference0001']));
  const calls=[];let read=false;
  const rpc=async(name,args)=>{calls.push([name,args]);
   if(name==='lumen_my_feedback'){if(args.p_summary)return {data:{unread:read?0:1,items:[]}};const items=[{id:11,kind:'bug',status:'answered',created_at:'2026-11-24T08:05:00Z',message:'La grille se bloque',unread:!read,thread:[{by:'admin',body:'<b>Corrigé</b> en 1.11.2',at:'2026-11-24T10:00:00Z'}]},{id:9,kind:'idea',status:'closed',created_at:'2026-11-20T08:05:00Z',message:'Idée',unread:false,thread:[]}];if(args.p_mark_read)read=true;return {data:{unread:0,items}}}
   if(name==='lumen_feedback_reply')return {data:{id:args.p_id,status:'reviewed'}};return {data:null}};
  const reports=createMyReports({document,storage:localStorage,t:(k,p)=>k+(p?.count?':'+p.count:''),rpc,identity:()=>({userId:null,anonymousId:'guest-device-0001',client:{}})});
  const visible=!document.getElementById('myReportsBtn').hidden;
  await reports.check();
  const badge=document.getElementById('myReportsBadge').textContent;const dot=account.hasAttribute('data-reports-unread');
  await reports.check();const throttled=calls.filter(c=>c[1].p_summary).length===1;
  reports.open();for(let i=0;i<40&&!document.querySelector('.my-report');i++)await new Promise(r=>setTimeout(r,25));
  const first=document.querySelector('.my-report');
  const unreadShown=!!first.querySelector('.my-report-new');const expanded=!first.querySelector('.my-report-body').hidden;
  const answer=first.querySelector('.my-report-msg[data-by="admin"] p').innerHTML;
  const guestRefs=calls.find(c=>c[1].p_mark_read)[1].p_refs;
  const area=first.querySelector('textarea');area.value='Toujours bloqué';area.dispatchEvent(new Event('input'));first.querySelector('form').requestSubmit();
  for(let i=0;i<40&&first.querySelector('form p').textContent!=='reports.replyDone';i++)await new Promise(r=>setTimeout(r,25));
  const reply=calls.find(c=>c[0]==='lumen_feedback_reply')[1];
  const reopened=first.dataset.status==='reviewed';
  const fits=document.querySelector('.my-reports-card').getBoundingClientRect().right<=innerWidth+1;
  reports.close();
  return {visible,badge,dot,throttled,unreadShown,expanded,answer,guestRefs,reply:{id:reply.p_id,anon:reply.p_anonymous_id,refs:reply.p_refs,ref:/^m[A-Za-z0-9]{8,}$/.test(reply.p_message_ref)},reopened,
   badgeCleared:document.getElementById('myReportsBadge').hidden,fits,overflow:document.documentElement.scrollWidth>innerWidth};
 })()`,
    true,
  );
  assert.equal(player.visible, true, 'a guest with a sent report sees « Mes signalements »');
  assert.equal(player.badge, '1');
  assert.equal(player.dot, true, 'discreet dot on Mon espace');
  assert.equal(player.throttled, true, 'one summary per 10 minutes, no polling');
  assert.equal(player.unreadShown && player.expanded, true, 'the new answer is open');
  assert.equal(player.answer, '&lt;b&gt;Corrigé&lt;/b&gt; en 1.11.2', 'answers are text');
  assert.deepEqual(player.guestRefs, ['rGuestSecretReference0001'], 'guests read with their secret references only');
  assert.deepEqual(player.reply, { id: 11, anon: 'guest-device-0001', refs: ['rGuestSecretReference0001'], ref: true });
  assert.equal(player.reopened, true, 'a reply reopens the report');
  assert.equal(player.badgeCleared, true);
  assert.equal(player.fits && !player.overflow, true);
  // #974: constellation / adventure rankings — podium, my place, pages on demand.
  const ranking = await evaluate(
    `(async()=>{
  const {createGroupRanking}=await import('/src/ui/group-ranking.js');
  const markup=new DOMParser().parseFromString(await(await fetch('/index.html')).text(),'text/html');
  document.body.append(document.importNode(markup.getElementById('groupRankingModal'),true));
  const calls=[];let signed=false;
  const row=(i,mine=false)=>({nickname:'<i>Étoile '+i+'</i>',points:400-i*10,quests:3,place:i,mine});
  const rpc=async(name,args)=>{calls.push(args);
   if(args.p_limit)return {data:{rows:Array.from({length:args.p_offset?2:10},(_,i)=>row(args.p_offset+i+1,args.p_offset+i+1===12)),more:!args.p_offset}};
   return {data:{kind:args.p_kind,questTotal:args.p_kind==='adventure'?100:10,participants:12,participating:true,top:[row(1),row(2),row(3)],personal:{place:14,points:120,quests:2},rows:[]}}};
  const view=createGroupRanking({document,t:(k,p)=>k+(p?JSON.stringify(p):''),rpc,signedIn:()=>signed});
  view.open({constellationId:'real-01',adventureId:'base-real-sky',constellationName:'Grande Ourse',adventureName:'Ciel réel'});
  await new Promise(r=>setTimeout(r,30));
  const guest=document.getElementById('groupRankingStatus').textContent==='groupRanking.signIn'&&calls.length===0;
  view.close();signed=true;
  view.open({constellationId:'real-01',adventureId:'base-real-sky',constellationName:'Grande Ourse',adventureName:'Ciel réel'});
  for(let i=0;i<40&&!document.querySelector('.group-ranking-podium');i++)await new Promise(r=>setTimeout(r,25));
  const podium=document.querySelectorAll('.group-ranking-podium li').length;
  const text=!document.querySelector('#groupRankingBody i')&&document.getElementById('groupRankingBody').textContent.includes('<i>Étoile 1</i>');
  const me=document.querySelector('.group-ranking-me').textContent;
  const tabs=[...document.querySelectorAll('[data-ranking-kind]')].map(b=>b.textContent);
  const first=calls.length===1&&!calls[0].p_limit;
  const more=document.querySelector('.group-ranking-more');more.click();
  for(let i=0;i<40&&document.querySelectorAll('.group-ranking-list li').length<10;i++)await new Promise(r=>setTimeout(r,25));
  more.click();for(let i=0;i<40&&document.querySelectorAll('.group-ranking-list li').length<12;i++)await new Promise(r=>setTimeout(r,25));
  const paged=document.querySelectorAll('.group-ranking-list li').length===12&&more.hidden&&calls[1].p_offset===0&&calls[2].p_offset===10;
  const mineHighlighted=!!document.querySelector('.group-ranking-list .ranking-mine');
  document.querySelector('[data-ranking-kind="adventure"]').click();
  for(let i=0;i<40&&calls.at(-1).p_kind!=='adventure';i++)await new Promise(r=>setTimeout(r,25));
  const adventure=calls.at(-1).p_kind==='adventure'&&calls.at(-1).p_id==='base-real-sky'&&document.querySelector('[data-ranking-kind="adventure"]').getAttribute('aria-selected')==='true';
  const fits=document.querySelector('.group-ranking-card').getBoundingClientRect().right<=innerWidth+1&&document.documentElement.scrollWidth<=innerWidth;
  view.close();
  return {guest,podium,text,me,tabs,first,paged,mineHighlighted,adventure,fits};
 })()`,
    true,
  );
  assert.equal(ranking.guest, true, 'guests are invited to sign in, nothing is read');
  assert.equal(ranking.podium, 3);
  assert.equal(ranking.text, true, 'nicknames are text');
  assert.match(ranking.me, /groupRanking\.mine.*"place":14.*"points":120.*"quests":2.*"total":10/, 'my place, points and ranked quests off the podium');
  assert.deepEqual(ranking.tabs, ['Grande Ourse', 'Ciel réel']);
  assert.equal(ranking.first, true, 'one read: top 3 + my position, no page');
  assert.equal(ranking.paged, true, 'pages of 10 on demand');
  assert.equal(ranking.mineHighlighted, true);
  assert.equal(ranking.adventure, true);
  assert.equal(ranking.fits, true);
  return { adminInbox: true, linkedDiagnostic: true, idempotentAnswer: true, playerReports: true, guestDeviceOnly: true, textOnly: true, groupRanking: true };
}
