import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {duelPerformance,duelOutcome,duelFromSentRow,duelFromChallenge,participantForRecipient,duelVerdictText,
 renderDuelRow,renderDuelCard,renderMyChallenges,renderFriendReceived,renderFriendSent} from '../src/campaign/duel-view.js';
import {createTranslator} from '../src/ui/i18n.js';

// #896: duels are presented with the existing #18/#35 rule, never invented.
const {t}=createTranslator({locale:'fr'}),en=createTranslator({locale:'en'}).t;
const fmt=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
const ctx={t,formatDuration:fmt,questLabel:r=>r?'Quête '+(r.puzzle_id??'?'):''};
const done=(duration,extra={})=>duelPerformance({status:'completed',duration,autonomy:true,...extra});

// Verdicts from both roles (sender = reference owner, participant = recipient).
assert.deepEqual(duelOutcome({role:'sender',mine:done(84),theirs:done(98,{name:'Loutre'})}),{state:'won',reason:'time',gap:14});
assert.deepEqual(duelOutcome({role:'sender',mine:done(98),theirs:done(84)}),{state:'lost',reason:'time',gap:14});
assert.deepEqual(duelOutcome({role:'participant',mine:done(84),theirs:done(98)}),{state:'won',reason:'time',gap:14},'symmetric for the recipient');
assert.deepEqual(duelOutcome({role:'participant',mine:done(98),theirs:done(84)}),{state:'lost',reason:'time',gap:14});
assert.equal(duelOutcome({role:'sender',mine:done(90),theirs:done(90)}).state,'tied');
// Existing rule: autonomy beats time.
assert.deepEqual(duelOutcome({role:'sender',mine:done(120),theirs:done(60,{autonomy:false})}),{state:'won',reason:'assistance',gap:60});
assert.deepEqual(duelOutcome({role:'participant',mine:done(60,{assistanceUsed:true}),theirs:done(120)}),{state:'lost',reason:'assistance',gap:60});

// Honest intermediate states: no verdict without two terminal performances.
assert.equal(duelOutcome({role:'sender',mine:done(84),theirs:duelPerformance({status:'pending'})}).state,'pending');
assert.equal(duelOutcome({role:'sender',mine:done(84),theirs:duelPerformance({status:'started'})}).state,'playing');
assert.equal(duelOutcome({role:'sender',mine:done(84),theirs:duelPerformance({status:'abandoned'})}).state,'abandoned-them');
assert.equal(duelOutcome({role:'participant',mine:duelPerformance({status:'abandoned'}),theirs:done(84)}).state,'abandoned-me');
assert.equal(duelOutcome({role:'participant',mine:duelPerformance({status:'pending'}),theirs:done(84)}).state,'pending-me');
assert.equal(duelOutcome({role:'participant',mine:duelPerformance({status:'started'}),theirs:done(84)}).state,'playing-me');
assert.equal(duelOutcome({role:'sender',mine:done(null),theirs:done(84)}).state,'unavailable','missing reference time');
assert.equal(duelOutcome({role:'sender',mine:done(84),theirs:done('')}).state,'unavailable','missing participant time');
assert.equal(duelOutcome({mine:null,theirs:null}).state,'unavailable');

// Copy (FR/EN) and gap wording.
assert.equal(duelVerdictText({state:'lost'},'Loutre',t),'Loutre a gagné');
assert.equal(duelVerdictText({state:'lost'},'',t),'Ton ami a gagné');
assert.equal(duelVerdictText({state:'won'},'Loutre',en),'You won!');
const win=renderDuelRow({role:'sender',quest:{puzzle_id:16},mine:done(84),theirs:done(98,{name:'Loutre'})},ctx);
assert.match(win,/Défi contre Loutre.*Mon temps.*1:24.*Loutre.*1:38.*Tu as gagné !.*14 secondes d’avance/s);
assert.match(renderDuelRow({role:'sender',quest:{},mine:done(84),theirs:done(85,{name:'B'})},ctx),/1 seconde d’avance/);
assert.match(renderDuelRow({role:'sender',quest:{},mine:done(200),theirs:done(84,{name:'B'})},ctx),/B a gagné.*1:56 de retard/s);
assert.match(renderDuelRow({role:'sender',quest:{},mine:done(84),theirs:duelPerformance({name:'B',status:'pending'})},ctx),/En attente de B/);
assert.doesNotMatch(renderDuelRow({role:'sender',quest:{},mine:done(84),theirs:duelPerformance({name:'B',status:'pending'})},ctx),/gagné|Égalité/,'no verdict while pending');
assert.match(renderDuelRow({role:'sender',quest:{},mine:done(84),theirs:duelPerformance({name:'B',status:'abandoned'})},ctx),/B a abandonné/);
assert.match(renderDuelRow({role:'sender',quest:{},mine:done(84),theirs:done(84,{name:'B'})},ctx),/Égalité.*Même temps/s);
assert.match(renderDuelRow({role:'sender',quest:{},mine:done(120),theirs:done(60,{name:'B',autonomy:false})},ctx),/Sans aide, contrairement à B/);
assert.match(renderDuelRow({role:'sender',quest:{},mine:done(84),theirs:done(98,{name:'<b>x'})},ctx),/&lt;b&gt;x/,'escaped names');

// Notes: replay provenance (#889), already-known grid, original grid revision (#887).
const noted=renderDuelRow({role:'sender',quest:{grid_revision:0,stable_quest_id:'q'},mine:done(84,{firstPlay:false}),theirs:done(98,{name:'B',previouslyPlayed:true})},{...ctx,currentRevision:()=>2});
assert.match(noted,/Ta référence vient d’un rejeu qualifiant.*B connaissait déjà cette grille.*Version d’origine de la grille/s);
assert.doesNotMatch(renderDuelRow({role:'sender',quest:{grid_revision:2},mine:done(84),theirs:done(98)},{...ctx,currentRevision:()=>2}),/Version d’origine/);

// Builders from the real contracts.
const row={challenge_id:'c1',puzzle_id:16,source_duration_seconds:84,source_autonomy:true,source_mastery:false,source_first_play:true,
 participants:[{name:'Loutre',status:'completed',duration_seconds:98,autonomy:true,mastery:false,previously_played:false,completed_at:'2026-11-21T10:00:00Z'},{name:'Bo',status:'started'}]};
assert.equal(duelOutcome(duelFromSentRow(row,row.participants[0])).state,'won');
assert.equal(duelOutcome(duelFromSentRow(row,row.participants[1])).state,'playing');
const data={challenge_id:'c2',sender_display_name:'Ana',source_duration_seconds:70,source_autonomy:true,participant_display_name:'Moi',participant_status:'completed',participant_duration_seconds:65,participant_autonomy:true};
assert.deepEqual(duelOutcome(duelFromChallenge(data)),{state:'won',reason:'time',gap:5});
const card=renderDuelCard(duelFromChallenge(data),ctx);
assert.match(card,/Tu as gagné !.*5 secondes d’avance.*Toi.*1:05.*Ana.*1:10/s,'verdict and both times first');
assert.equal((card.match(/duel-winner/g)||[]).length,1,'exactly one highlighted winner');
assert.doesNotMatch(renderDuelCard(duelFromChallenge({...data,participant_duration_seconds:70}),ctx),/duel-winner/,'no winner on a tie');
// #896: the validated detail card is byte-for-byte unchanged (pinned on the
// release the owner approved, efa708ed): same markup for every state, FR and EN.
{
 const out=[];
 for(const locale of ['fr','en']){const tl=createTranslator({locale}).t,c={t:tl,formatDuration:fmt,questLabel:r=>'Q'+(r?.puzzle_id??'?'),currentRevision:()=>2};
  for(const [m,o] of [[done(84),done(98,{name:'Loutre'})],[done(98),done(84,{name:'Loutre'})],[done(90),done(90,{name:'<b>L'})],[done(120,{firstPlay:false}),done(60,{name:'B',autonomy:false,previouslyPlayed:true})],[done(84),duelPerformance({name:'B',status:'abandoned'})],[done(84),duelPerformance({name:'B',status:'started'})]])
   out.push(renderDuelCard({role:'sender',quest:{puzzle_id:16,grid_revision:0},mine:m,theirs:o},c));
 }
 assert.equal(createHash('sha256').update(out.join(String.fromCharCode(10))).digest('hex'),'20c058ede4584b2f15a976224db9060ee0627e9419755b4b27063fa13c1d72be','renderDuelCard() unchanged');
}

// Recipient matching for friend-sent rows (#35 inbox joined to « Mes défis »).
assert.equal(participantForRecipient({recipient:'loutre',status:'completed',duration_seconds:98},row),row.participants[0]);
assert.equal(participantForRecipient({recipient:'Zed',status:'completed',duration_seconds:98},row),row.participants[0],'unique time match');
assert.equal(participantForRecipient({recipient:'Zed',status:'completed',duration_seconds:1},row),null,'ambiguous stays unavailable');

// Lists.
// #896 recette 21/11: « Mes défis » is a compact list (quest once, one line per
// player, « Voir le duel » the only main action, sharing behind « Partager »).
const visibleText=html=>html.replace(/<details[\s\S]*?<\/details>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const mine=renderMyChallenges([row],{...ctx,canSendFriend:true});
assert.match(mine,/data-challenge-id="c1".*Quête 16.*Partager.*Tu as gagné !.*data-duel-open="c1\|0".*Voir le duel.*Toi.*1:24.*Loutre.*1:38.*14 s d’avance.*Bo relève le défi/s);
assert.equal((mine.match(/Quête 16/g)||[]).length,2,'the quest is named once (plus the share label), never per player');
assert.doesNotMatch(mine,/Ton temps de référence|participants?|Défi contre/,'no reference line, count or repeated heading in the list');
assert.equal((mine.match(/data-duel-open/g)||[]).length,1,'no detail button for an unfinished duel');
assert.equal((mine.match(/<li class="challenge-duel /g)||[]).length,2,'one compact line per participant, none hidden');
// Sharing stays reachable but secondary: inside a closed <details>, with its attributes.
assert.match(mine,/<details class="challenge-share"><summary aria-label="Partager le défi · Quête 16">Partager<\/summary>.*data-copy-link="c1".*data-send-friend="c1"/s);
assert.doesNotMatch(visibleText(mine),/Copier le lien|Envoyer à un ami/,'share actions do not compete with « Voir le duel »');
assert.doesNotMatch(renderMyChallenges([row],ctx),/data-send-friend/,'send to a friend only when signed in');
// Every state: honest wording, no invented verdict and never a 0:00.
const P=(name,status,duration_seconds=null,extra={})=>({name,status,duration_seconds,autonomy:true,mastery:false,...extra});
const states=renderMyChallenges([{...row,challenge_id:'s',participants:[P('Al','completed',98),P('Bea','completed',70),P('Cy','completed',84),P('Di','pending'),P('Ed','started'),P('Flo','abandoned'),P('Gus','completed',null)]}],ctx);
assert.deepEqual([...states.matchAll(/data-duel-state="([^"]+)"/g)].map(m=>m[1]),['won','lost','tied','pending','playing','abandoned-them','unavailable']);
assert.match(states,/Tu as gagné !.*Toi.*1:24.*Al.*1:38.*14 s d’avance/s,'won: verdict, both times, gap');
assert.match(states,/Bea a gagné.*Toi.*1:24.*Bea.*1:10.*14 s de retard/s,'lost: same hierarchy');
assert.match(states,/Égalité.*Même temps, même niveau d’aide/s,'tie: explicit, no winner');
assert.match(states,/En attente de Di/);assert.match(states,/Ed relève le défi/);assert.match(states,/Flo a abandonné/);assert.match(states,/Comparaison indisponible/);
const lineOf=state=>'<li '+states.split('<li ').find(x=>x.startsWith('class="challenge-duel duel-'+state+'"'));
for(const state of ['pending','playing','abandoned-them','unavailable']){
 const line=lineOf(state);
 assert.doesNotMatch(line,/gagné|Égalité|🏆|d’avance|de retard/,state+': no verdict');
 assert.doesNotMatch(line,/0:00/,state+': no fake time');
 assert.equal((line.match(/<b>/g)||[]).length,1,state+': only my own time, never theirs');
}
assert.doesNotMatch(lineOf('abandoned-them'),/🏆/,'no trophy on an abandon');
assert.equal((states.match(/data-duel-open/g)||[]).length,5,'detail for won, lost, tied, abandoned and unavailable only');
assert.match(lineOf('tied'),/data-duel-open="s\|2"/,'detail opens the right participant');
// Autonomy first, then time (compareChallenge): a slower run without help wins.
const autonomy=renderMyChallenges([{...row,challenge_id:'a',source_duration_seconds:120,participants:[P('Hal','completed',60,{autonomy:false})]}],ctx);
assert.match(autonomy,/data-duel-state="won".*Tu as gagné !.*Sans aide, contrairement à Hal/s);
assert.match(renderMyChallenges([{...row,source_duration_seconds:200,participants:[P('Ivy','completed',84)]}],ctx),/Ivy a gagné.*1:56 de retard/s,'a gap over a minute uses minutes');
// No participant yet: the quest stays visible, one quiet line.
assert.match(renderMyChallenges([{...row,challenge_id:'e',participants:[]}],{...ctx,canSendFriend:true}),/Quête 16.*Partager.*data-send-friend="e".*Personne n’a encore relevé ce défi\./s);
// Long names and HTML are escaped.
const hostile=renderMyChallenges([{...row,challenge_id:'x"><img>',participants:[P('<img src=x onerror=1>'+'L'.repeat(60),'completed',98)]}],{...ctx,questLabel:()=>'<script>q'});
assert.doesNotMatch(hostile,/<img|<script>/);assert.match(hostile,/&lt;img src=x onerror=1&gt;L{60}/);assert.match(hostile,/data-challenge-id="x&quot;&gt;&lt;img&gt;"/);
// English.
const english=renderMyChallenges([row],{...ctx,t:en,canSendFriend:true});
assert.match(english,/Share.*Copy the link.*Send to a friend.*You won!.*View the duel.*You.*1:24.*Loutre.*1:38.*14 s ahead.*Bo is taking the challenge/s);
assert.match(renderMyChallenges([],ctx),/Aucun défi envoyé/);
const received=[{challenge_id:'r1',sender:'Ana',puzzle_id:3,status:'pending',source_first_play:false},{challenge_id:'r2',sender:'Ana',puzzle_id:4,status:'started'},{challenge_id:'c2',sender:'Ana',puzzle_id:5,status:'completed'},{challenge_id:'r4',sender:'Ana',status:'completed'}];
const rec=renderFriendReceived(received,{...ctx,details:new Map([['c2',data],['r4','error']])});
assert.match(rec,/r1.*À toi de jouer.*La référence de Ana vient d’un rejeu qualifiant.*Relever le défi/s);
assert.match(rec,/r2.*Ta tentative est en cours.*Reprendre/s);
assert.match(rec,/c2.*Tu as gagné !.*data-challenge-action="result">Voir le duel/s);
assert.match(rec,/r4.*Résultat indisponible pour le moment.*Détails du défi/s);
assert.match(renderFriendReceived([{challenge_id:'x',sender:'A',status:'completed'}],ctx),/aria-busy="true".*Chargement du duel…/s,'reserved loading row');
const sent=renderFriendSent([{challenge_id:'c1',recipient:'Loutre',status:'completed',duration_seconds:98},{challenge_id:'zz',recipient:'Cy',status:'pending'}],{...ctx,listRows:[row]});
assert.match(sent,/Défi contre Loutre.*Tu as gagné !.*Voir le duel.*Copier le lien.*Défi contre Cy.*En attente de Cy.*Copier le lien/s);
assert.equal((sent.match(/data-duel-open/g)||[]).length,1);
assert.match(renderFriendSent([{challenge_id:'q',recipient:'D',status:'completed',duration_seconds:50}],{...ctx,listRows:[]}),/D.*0:50.*Comparaison indisponible/s,'time without reference: no verdict');
console.log('duel view tests passed');
