import test from 'node:test';
import assert from 'node:assert/strict';
import {observedCount,buildAnalyticsDashboard,analyticsPlayers,storageAlertLine} from '../src/ui/analytics-dashboard.js';

const catalogue=[{id:'adventure',name:'Aventure réelle',constellations:[{id:'constellation',name:'Constellation réelle',quests:[{id:'quest-a',number:91},{id:'quest-b',number:92}]}]}];
const now=Date.parse('2026-11-15T10:01:00Z');

test('missing measurements never become measured zeroes',()=>{
 for(const value of [null,undefined,'',' ',false,true,[],{},-1,Infinity,'not a count'])assert.equal(observedCount(value),null);
 assert.equal(observedCount(0),0);assert.equal(observedCount('12'),12);
 const missing=buildAnalyticsDashboard();
 assert.equal(missing.uniquePlayers,null);assert.equal(missing.technical.affected,null);
 assert.equal(missing.productAvailable,false);assert.equal(missing.healthAvailable,false);
 assert.equal(buildAnalyticsDashboard({health:[],product:[]}).healthAvailable,false);
 const empty=buildAnalyticsDashboard({product:{summary:{unique_players:0}},health:{affected_players:0,outbox:{pending_players:0}}});
 assert.equal(empty.uniquePlayers,null,'disabled collection has no measured population');assert.equal(empty.technical.pending,0);
});

test('attention is based on observed exposure, without declaring a quest abandoned or difficult',()=>{
 const model=buildAnalyticsDashboard({catalogue,quests:{friction:[
  {stable_quest_id:'quest-a',quest_ordinal:91,started:10,completed:2,hints:9,resets:10,abandons:1,median_seconds:42,observed_grid_revision:1,duration_samples:2},
  {stable_quest_id:'quest-b',quest_ordinal:92,started:1,completed:0,hints:8,resets:8},
 ]}});
 assert.equal(model.journey[0].pack,'Aventure réelle');
 assert.deepEqual(model.journey[0].signals,['Peu de fins observées','Indices fréquents','Réinitialisations fréquentes']);
 assert.equal(model.journey[0].abandons,1);assert.equal(model.journey[0].seconds,42);
 assert.equal(model.journey[1].smallSample,true);assert.deepEqual(model.journey[1].signals,[]);
 assert.equal(model.journey[1].seconds,null,'missing duration is not zero seconds');
});

test('independent period populations are never forced into a success rate or matched cohort',()=>{
 const model=buildAnalyticsDashboard({quests:{friction:[{quest_ordinal:91,started:2,completed:5}],funnel:[{label:'Tutoriel terminé',players:0},{label:'Quête atteinte',players:3}]}});
 assert.equal(model.journey[0].windowMismatch,true);assert.equal(model.journey[0].completed,5);
 assert.equal(model.milestones[0].uninstrumented,true);assert.equal(model.milestones[1].players,3);
 assert.equal(Object.hasOwn(model.journey[0],'successRate'),false);
});

test('stable catalogue identity wins; inconsistent rows and duplicate identities are excluded',()=>{
 const model=buildAnalyticsDashboard({catalogue,quests:{friction:[
  {stable_quest_id:'quest-a',quest_ordinal:1,started:100},
  {stable_quest_id:'quest-b',quest_ordinal:92,started:5},
  {stable_quest_id:'quest-b',quest_ordinal:92,started:500},
 ]}});
 assert.equal(model.rejectedQuests,2);assert.equal(model.journey.length,1);assert.equal(model.journey[0].ordinal,92);assert.equal(model.journey[0].started,5);
});

test('operational evidence remains available without product analytics; stale queue signals do not become live incidents',()=>{
 const players=['recent','stale','failed'].map(id=>({player_key:'u:'+id,player_type:'authenticated',display_name:'Compte '+id}));
 const observations={players:{
  'u:recent':{state:'pending',observed_at:'2026-11-15T10:00:00Z'},
  'u:stale':{state:'failure',observed_at:'2026-11-15T08:00:00Z'},
  'u:failed':{state:'failure',observed_at:'2026-11-15T10:00:00Z'},
 }};
 const model=buildAnalyticsDashboard({players,observations,now,health:{affected_players:2,stalled_players:1,outbox:{pending_players:3,critical_players:1,alerts:[{state:'pending',pending:2}]},by_reason:[{reason:'storage_quota',count:2}],by_version:[{version:'Version 1.11.1+615 · abcdef0',count:2}]}});
 assert.equal(model.productAvailable,false);assert.equal(model.healthAvailable,true);
 assert.equal(model.technical.pending,3);assert.equal(model.technical.unknownPlayers,1);
 assert.deepEqual(model.technical.priority.map(p=>p.key),['u:failed','u:recent']);
 assert.equal(model.technical.priority[0].label,'Compte failed');assert.equal(model.technical.priority[0].statusLabel,'Problème signalé');
 assert.equal(model.technical.reasons[0].label,'Stockage saturé');assert.equal(model.technical.versions[0].label,'1.11.1+615');
 assert.equal(model.technical.alerts.length,1);
});

test('daily overview is bounded to thirty observed dates without inventing missing days',()=>{
 const daily=Array.from({length:40},(_,i)=>({activity_date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),players:i}));
 const model=buildAnalyticsDashboard({product:{daily}});
 assert.equal(model.daily.length,30);assert.equal(model.daily[0].players,10);
});

test('Lumen accounts without product events remain diagnosable without inventing activity or sessions',()=>{
 const players=analyticsPlayers([{player_key:'u:active',player_type:'authenticated',sessions:4},{player_key:'a:guest',player_type:'anonymous'}],
  [{user_id:'new',nickname:'Nouveau compte',last_sign_in_at:'2026-11-15T10:00:00Z'},{user_id:'active',nickname:'Compte actif'}]);
 assert.deepEqual(players.map(p=>p.player_key),['u:new','u:active']);
 assert.equal(players[0].last_seen,undefined,'Auth timestamp never becomes analytic activity');
 assert.equal(players[0].sessions,null);assert.equal(players[0].current_quest,null);
 assert.equal(players[1].sessions,4);
 assert.equal(analyticsPlayers([],Array.from({length:300},(_,i)=>({user_id:String(i)}))).length,250,'observation batch stays bounded');
});

test('technical windows remain independent from long product history',()=>{
 assert.equal(buildAnalyticsDashboard({days:3650}).healthDays,90);
 assert.equal(buildAnalyticsDashboard({days:1}).healthDays,1);
});

test('disabled product collection never reports measured zero activity; server receipts remain usable',()=>{
 const model=buildAnalyticsDashboard({product:{summary:{unique_players:0,sessions:0},service_activity:{summary:{players:5,quests:13,completions:25},daily:[],quests:[]}},quests:{friction:[]}});
 assert.equal(model.uniquePlayers,null);
 assert.equal(model.sessions,null);
 assert.equal(model.serviceAvailable,true);
 assert.equal(model.service.summary.players,5);
 assert.equal(model.service.summary.quests,13);
 assert.equal(model.service.summary.completions,25);
 assert.equal(buildAnalyticsDashboard().serviceAvailable,false);
});

test('different spellings of a build aggregate into one technical version',()=>{
 const model=buildAnalyticsDashboard({health:{by_version:[{version:'1.11.1+618',count:2},{version:'Lumen 1.11.1+618',count:3}]}});
 assert.deepEqual(model.technical.versions,[{label:'1.11.1+618',count:5}]);
});
// #962: storage health on outbox alerts and the dedicated count.
test('storage pressure is summarised from buckets and category only',()=>{
 assert.equal(storageAlertLine({storage_kb:8704,storage_ratio:85,storage_error:'quota'}),'Stockage local ≈ 8,5 Mo (85 %) · écriture refusée : stockage plein');
 assert.equal(storageAlertLine({storage_kb:512,storage_ratio:5,storage_error:null}),'Stockage local ≈ 512 Ko (5 %)');
 assert.equal(storageAlertLine({storage_error:'storage'}),'écriture locale en échec');
 assert.equal(storageAlertLine({}),'');assert.equal(storageAlertLine(null),'');
 const model=buildAnalyticsDashboard({health:{outbox:{storage_pressure_players:2,alerts:[]}}});
 assert.equal(model.technical.storagePressure,2);
});
