import assert from 'node:assert/strict';
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

// Recipient matching for friend-sent rows (#35 inbox joined to « Mes défis »).
assert.equal(participantForRecipient({recipient:'loutre',status:'completed',duration_seconds:98},row),row.participants[0]);
assert.equal(participantForRecipient({recipient:'Zed',status:'completed',duration_seconds:98},row),row.participants[0],'unique time match');
assert.equal(participantForRecipient({recipient:'Zed',status:'completed',duration_seconds:1},row),null,'ambiguous stays unavailable');

// Lists.
const mine=renderMyChallenges([row],{...ctx,canSendFriend:true});
assert.match(mine,/data-challenge-id="c1".*2 participants.*Ton temps de référence · 1:24.*Défi contre Loutre.*Tu as gagné !.*data-duel-open="c1\|0".*Voir le duel.*Défi contre Bo.*Bo relève le défi.*Copier le lien.*data-send-friend="c1"/s);
assert.equal((mine.match(/data-duel-open/g)||[]).length,1,'no detail button for an unfinished duel');
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
