// #929 (EPIC #928 V1) · Real page: « Mes cercles » from the social hub. RPCs are
// an in-page model of the SQL contract proven by fixtures/private-circles-929.sql.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';

const { send, evaluate, errors } = await connectBrowser(),
  results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expression, label = expression) {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(expression)) return;
    await sleep(60);
  }
  throw Error('Timed out: ' + label);
}
const OWNER = '00000000-0000-4000-8000-000000929101';
const TOKEN = 'b'.repeat(64);
const solved = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 1]));
const profile = {
  solved,
  historyBackup: { ...solved },
  badges: {},
  stars: {},
  performances: {},
  noHint: {},
  canonicalQuestState: {},
  xp: 100,
  shards: 10,
  skyScore: 10,
  skyHistoryVersion: 4,
  walletRevision: 1,
  daily: { dates: {}, rewards: {} },
  challenges: {},
};

function fixture({ signedIn, offline = false, locale = 'fr' }) {
  return `
  localStorage.clear();
  localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(profile))});
  for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1'])localStorage.setItem(k,'1');
  localStorage.setItem('lumenPushChoice','off');localStorage.setItem('lumenSound','off');localStorage.setItem('lumen.locale',${JSON.stringify(locale)});
  ${signedIn ? `localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});` : ''}
  Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('denied')}},configurable:true});
  window.__circleCalls=[];
  const me='Moi929';
  const state={circles:[],invitations:[{id:'inv-1',circle:'c-inv',name:'Collègues',owner:'Ana929',members:3}],links:[],seq:0};
  const detailOf=c=>({id:c.id,name:c.name,role:c.role,members:c.members.map(n=>({nickname:n,role:n===c.owner?'owner':'member',me:n===me})),
   pending:c.role==='owner'?c.pending:null,links:c.role==='owner'?state.links.filter(l=>l.circle===c.id).map(l=>({id:l.id,expires_at:'2026-11-29T10:00:00Z'})):null,
   quests:c.members.length>1?[{quest_id:'base-q012',grid_revision:0,players:2}]:[]});
  const fail=code=>({data:null,error:{message:code}});
  window.supabase={createClient:()=>({auth:{
   getSession:async()=>(${signedIn}?{data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}:{data:{session:null}}),
   getUser:async()=>(${signedIn}?{data:{user:{id:${JSON.stringify(OWNER)}}}}:{data:{user:null}}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name,args={})=>{
    if(name.startsWith('lumen_circle_')){window.__circleCalls.push(name);${offline ? `throw new TypeError('Failed to fetch');` : ''}}
    if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:true}};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(profile)}};
    if(name==='lumen_get_progress')return {data:Array.from({length:10},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
    if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_friend_list')return {data:[{nickname:'Ben929',state:'friends',since:'2026-11-20T10:00:00Z'},{nickname:'Zoe929',state:'incoming',since:'2026-11-20T10:00:00Z'}]};
    if(name==='lumen_challenge_inbox')return {data:{received:[],sent:[]}};
    if(name==='lumen_circle_list')return {data:{circles:state.circles.map(c=>({id:c.id,name:c.name,role:c.role,members:c.members.length})),
     invitations:state.invitations.map(({id,name,owner,members})=>({id,name,owner,members})),limits:{circles:10,members:20,linkDays:7}}};
    if(name==='lumen_circle_create'){const n=String(args.p_name||'').trim().replace(/\\s+/g,' ');if(n.length<2)return fail('circle_name_invalid');
     const c={id:'c-'+(++state.seq),name:n,role:'owner',owner:me,members:[me],pending:[]};state.circles.push(c);return {data:{id:c.id,name:n}}}
    const circle=state.circles.find(c=>c.id===args.p_circle);
    if(name==='lumen_circle_detail')return circle?{data:detailOf(circle)}:fail('circle_not_found');
    if(name==='lumen_circle_invite_friend'){circle.pending.push(args.p_nickname);return {data:{state:'pending'}}}
    if(name==='lumen_circle_link_create'){state.links.push({id:'l-'+(++state.seq),circle:circle.id});return {data:{token:'c'.repeat(64),expires_at:'2026-11-29T10:00:00Z'}}}
    if(name==='lumen_circle_leave'){state.circles=state.circles.filter(c=>c!==circle);return {data:true}}
    if(name==='lumen_circle_respond'){const inv=state.invitations.find(i=>i.id===args.p_invite);state.invitations=[];
     if(!args.p_accept)return {data:{state:'declined'}};
     const c={id:inv.circle,name:inv.name,role:'member',owner:'Ana929',members:['Ana929','Ben929',me],pending:[]};state.circles.push(c);return {data:{state:'joined',id:c.id}}}
    if(name==='lumen_circle_board')return {data:{quest_id:args.p_quest_id,grid_revision:args.p_grid_revision,members:3,ranked:2,
     top:[{nickname:'Ben929',score:80,place:1,mine:false},{nickname:me,score:95,place:2,mine:true}],personal:{nickname:me,score:95,place:2,mine:true}}};
    if(name==='lumen_circle_link_preview')return args.p_token===${JSON.stringify(TOKEN)}?{data:{name:'Famille Lune',owner:'Ana929',members:4,member:false}}:fail('circle_link_invalid');
    if(name==='lumen_circle_link_join'){if(args.p_token!==${JSON.stringify(TOKEN)})return fail('circle_link_invalid');
     const c={id:'c-link',name:'Famille Lune',role:'member',owner:'Ana929',members:['Ana929',me],pending:[]};state.circles.push(c);return {data:{state:'joined',id:c.id}}}
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};
    return {data:[]};
   }})};`;
}
async function open({ width, signedIn, offline = false, query = '', locale = 'fr' }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width < 700 ? 740 : 900,
    mobile: width < 700,
    deviceScaleFactor: 1,
  });
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fixture({ signedIn, offline, locale }),
  });
  const url = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
  url.search = query;
  await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: String(url) });
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  await acknowledgeLearningMilestones(evaluate);
}
const text = () => evaluate(`document.getElementById('circlesModal').textContent`);
const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const fits = () => evaluate(`document.documentElement.scrollWidth<=innerWidth`);

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*'] });

  // Guest: a clear explanation, no circle RPC.
  await open({ width: 390, signedIn: false });
  await click('#openCircles');
  await until(`!document.getElementById('circlesModal').hidden`);
  assert.match(await text(), /réservés aux comptes Lumen/);
  assert.deepEqual(await evaluate('window.__circleCalls'), [], 'no RPC for guests');
  results.push({ kind: 'guest' });

  for (const width of [360, 1440]) {
    await open({ width, signedIn: true });
    await click('#openCircles');
    await until(
      `/Invitations reçues/.test(document.getElementById('circlesModal').textContent)`,
      'list ' + width,
    );
    assert.match(
      await text(),
      /Collègues.*Invitation de Ana929.*Tu ne fais encore partie d'aucun cercle/s,
      'invitation and empty state',
    );
    assert.equal(
      await evaluate(`document.getElementById('circlesBadge').textContent`),
      '1',
      'pending invitation counted',
    );
    assert.equal(await fits(), true, 'no horizontal scroll ' + width);
    // Invalid name, then creation.
    await evaluate(
      `document.getElementById('circleNewName').value=' x ';document.querySelector('[data-circle-form=create] button').click()`,
    );
    await until(
      `/2 à 30 caractères/.test(document.getElementById('circlesStatus').textContent)`,
      'name error',
    );
    await evaluate(
      `document.getElementById('circleNewName').value='Famille  Lumière';document.querySelector('[data-circle-form=create] button').click()`,
    );
    await until(
      `document.getElementById('circlesTitle').textContent==='Famille Lumière'`,
      'detail',
    );
    assert.match(await text(), /Moi929 \(toi\) créateur·rice/, 'owner shown');
    assert.match(
      await text(),
      /Aucun membre n'a encore de temps officiel/,
      'empty ranking explained',
    );
    assert.deepEqual(
      await evaluate(
        `[...document.querySelectorAll('#circleInviteFriend option')].map(o=>o.textContent)`,
      ),
      ['Ben929'],
      'only accepted friends',
    );
    await click('[data-circle-form=invite] button');
    await until(
      `/Invitation envoyée/.test(document.getElementById('circlesStatus').textContent)`,
      'invite sent',
    );
    assert.match(await text(), /En attente : Ben929/);
    // Link: no share, no clipboard → the link is shown to copy by hand.
    await click('[data-circle-action=create-link]');
    await until(
      `/Copie ce lien/.test(document.getElementById('circlesStatus').textContent)`,
      'manual link',
    );
    assert.match(
      await evaluate(`document.getElementById('circlesStatus').textContent`),
      /\?circle=c{64}$/,
      'only the circle token',
    );
    assert.match(await text(), /Lien valable jusqu.*Désactiver/s);
    // Leaving goes through the Lumen dialog; cancelling keeps the circle.
    await click('[data-circle-action=leave]');
    await until(`!document.getElementById('lumenConfirm').hidden`, 'confirm');
    assert.match(
      await evaluate(`document.getElementById('lumenConfirmTitle').textContent`),
      /Quitter « Famille Lumière »/,
    );
    await click('#lumenConfirmCancel');
    assert.equal(
      await evaluate(`document.getElementById('circlesTitle').textContent`),
      'Famille Lumière',
      'cancel keeps the circle',
    );
    // Accept the invitation: ranking with top and personal place.
    await click('#circlesBack');
    await until(`!!document.querySelector('[data-circle-action=accept]')`, 'back to list');
    await click('[data-circle-action=accept]');
    await until(
      `document.getElementById('circlesTitle').textContent==='Collègues'&&/Place 1/.test(document.getElementById('circleBoard')?.textContent||'')`,
      'board',
    );
    assert.match(
      await evaluate(`document.getElementById('circleBoard').textContent`),
      /Place 1Ben929.*Place 2Moi929 \(toi\)/s,
    );
    assert.match(await text(), /1 membre sans temps sur cette quête/);
    if (width === 360)
      fs.writeFileSync(
        new URL('../docs/validation/circles-360.png', import.meta.url),
        Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
      );
    assert.equal(
      await evaluate(
        `!!document.querySelector('[data-circle-action=delete]')||!!document.getElementById('circleRename')`,
      ),
      false,
      'members have no owner tools',
    );
    assert.equal(await fits(), true);
    // Escape: detail → list → closed.
    await evaluate(
      `document.getElementById('circlesModal').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
    );
    await until(`document.getElementById('circlesTitle').textContent==='Mes cercles'`);
    await evaluate(
      `document.getElementById('circlesModal').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
    );
    assert.equal(await evaluate(`document.getElementById('circlesModal').hidden`), true);
    results.push({ width, create: true, invite: true, link: true, board: true, leaveCancel: true });
  }

  // Deep link: preview without members, join, the token leaves the URL.
  await open({ width: 390, signedIn: true, query: '?circle=' + TOKEN });
  await until(
    `/Ana929 t'invite à rejoindre « Famille Lune »/.test(document.getElementById('circlesModal').textContent)`,
    'join preview',
  );
  assert.match(await text(), /verront ton pseudo et tes temps officiels/);
  await click('[data-circle-action=join]');
  await until(`document.getElementById('circlesTitle').textContent==='Famille Lune'`, 'joined');
  assert.equal(
    await evaluate(`new URL(location.href).searchParams.has('circle')`),
    false,
    'token removed from the address',
  );
  // Invalid link: explained, nothing revealed, token removed.
  await open({ width: 390, signedIn: true, query: '?circle=' + 'd'.repeat(64) });
  await until(
    `/n'est plus valable/.test(document.getElementById('circlesModal').textContent)`,
    'invalid link',
  );
  assert.doesNotMatch(await text(), /Ana929|Famille/, 'nothing revealed');
  assert.equal(await evaluate(`new URL(location.href).searchParams.has('circle')`), false);
  // Offline: human message and retry.
  await open({ width: 390, signedIn: true, offline: true });
  await click('#openCircles');
  await until(
    `/Connexion indisponible/.test(document.getElementById('circlesModal').textContent)`,
    'offline',
  );
  assert.equal(await evaluate(`!!document.querySelector('[data-circle-action=retry]')`), true);
  // English copy (same page state, locale switched).
  await open({ width: 390, signedIn: true, locale: 'en' });
  await click('#openCircles');
  await until(
    `/Invitations/.test(document.getElementById('circlesModal').textContent)`,
    'english list',
  );
  assert.equal(await evaluate(`document.getElementById('circlesTitle').textContent`), 'My circles');
  assert.match(await text(), /Invited by Ana929 · 3 members.*You are not in any circle yet/s);
  results.push({ deepLink: true, invalidLink: true, offline: true, english: true });

  assert.deepEqual(errors, []);
  if (process.argv[2])
    fs.writeFileSync(process.argv[2], JSON.stringify({ results, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await send('Browser.close').catch(() => {});
}
