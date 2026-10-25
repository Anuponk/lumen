import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';

test('admin account identity supplies email fallback without confusing nicknames or other accounts',async()=>{
 const {registeredPlayers,playerMatchesSearch}=await import('../src/ui/cockpit-sessions.js');
 const rows=[{player_key:'u:empty',player_type:'authenticated',display_name:'Compte 1234'},
  {player_key:'u:named',player_type:'authenticated',display_name:'Ancien nom'},
  {player_key:'u:unavailable',player_type:'authenticated',display_name:'Compte 5678'}];
 const accounts=[{user_id:'empty',nickname:'  ',email:'  sans.pseudo@example.invalid '},
  {user_id:'named',nickname:' Étoile ',email:'etoile@example.invalid'},
  {user_id:'someone-else',nickname:null,email:'wrong@example.invalid'}];
 const before=JSON.stringify({rows,accounts}),result=registeredPlayers(rows,accounts);
 assert.equal(result[0].display_name,'sans.pseudo@example.invalid');
 assert.equal(result[1].display_name,'Étoile');
 assert.equal(result[2].display_name,'Compte 5678');
 assert.equal(result[2].email,undefined);
 assert.equal(playerMatchesSearch(result[0],'  SANS.PSEUDO@EXAMPLE.INVALID '),true);
 assert.equal(playerMatchesSearch(result[1],'etoile@example.invalid'),true,'Email searchable even when a nickname exists');
 assert.equal(playerMatchesSearch(result[1],'etoile'),true,'Search tolerates nickname accents');
 assert.equal(playerMatchesSearch(result[0],'wrong@example.invalid'),false);
 assert.equal(JSON.stringify({rows,accounts}),before,'View enrichment never mutates records');
});

test('directory removes anonymous labels by identity, not by the spelling of a nickname',async()=>{
 const {registeredPlayers}=await import('../src/ui/cockpit-sessions.js');
 const rows=[{player_key:'a:guest',player_type:'anonymous',display_name:'Joueur 3E8B'},
  {player_key:'u:account',player_type:'authenticated',display_name:'Alice'},
  {player_key:'u:nickname',player_type:'authenticated',display_name:'Joueur 3E8B'},
  {player_key:'a:inconsistent',player_type:'authenticated'},
  {player_key:'u:inconsistent',player_type:'anonymous'},null,{}];
 const before=JSON.stringify(rows),result=registeredPlayers(rows);
 assert.deepEqual(result.map(p=>p.player_key),['u:account','u:nickname']);
 assert.equal(JSON.stringify(rows),before,'View filtering never deletes or rewrites source records');
 assert.deepEqual(registeredPlayers(null),[]);
});

test('bounded directory keeps registered accounts after anonymous rows',async()=>{
 const {registeredPlayers}=await import('../src/ui/cockpit-sessions.js');
 const rows=Array.from({length:250},(_,i)=>({player_key:'a:'+i,player_type:'anonymous'}));
 rows.push({player_key:'u:account',player_type:'authenticated'});
 assert.equal(registeredPlayers(rows).length,1);
 assert.equal(registeredPlayers(Array.from({length:300},(_,i)=>({player_key:'u:'+i,player_type:'authenticated'}))).length,250);
});

test('an anonymous timeline cannot issue a request from the cockpit',async()=>{
 const src=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');let calls=0;
 const context=vm.createContext({lumenUser:{id:'admin'},lumenSupabase:{rpc:()=>{calls++;throw Error('anonymous request')}},
  hasInternalCapability:()=>true,document:{getElementById:()=>{throw Error('anonymous timeline rendered')}}});
 vm.runInContext(functionSource(src,'loadAdminTimeline')+';globalThis.load=loadAdminTimeline',context);
 await context.load('a:guest');assert.equal(calls,0);
});
