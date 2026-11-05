import test from 'node:test';
import assert from 'node:assert/strict';
test('sessions are independent, chronological, bounded and never Auth sessions',async()=>{
 const {buildPlayerSessions}=await import('../src/ui/cockpit-sessions.js');
 const first='00000000-0000-0000-0000-000000000001',second='00000000-0000-0000-0000-000000000002';
 const rows=[{session_id:second,event_name:'attempt_completed',occurred_at:'2026-10-25T06:00:00Z'},
  {session_id:first,event_name:'attempt_started',occurred_at:'2026-10-24T07:00:00Z'},
  {session_id:first,event_name:'hint_used',occurred_at:'2026-10-24T08:00:00Z'}];
 const before=JSON.stringify(rows),m=buildPlayerSessions({analytics:rows});
 assert.equal(m.length,2);assert.equal(m[0].key,'analytics:'+second);
 assert.deepEqual(m[1].events.map(e=>e.code),['attempt_started','hint_used']);
 assert.equal(JSON.stringify(rows),before);
 assert.equal(buildPlayerSessions({analytics:Array.from({length:1000},()=>rows[0])})[0].events.length,100);
});
test('missing identity never fabricates one shared session; arbitrary context is discarded',async()=>{
 const {buildPlayerSessions}=await import('../src/ui/cockpit-sessions.js');
 const rows=[{event_name:'hint_used',occurred_at:'2026-10-24',email:'secret@invalid',properties:{save:'SECRET'}},
 {event_name:'hint_used',occurred_at:'2026-10-24'},
 {session_id:'session',event_name:'Bearer SECRET',occurred_at:'2026-10-24'}];
 const result=buildPlayerSessions({analytics:rows});assert.equal(result.length,2);
 assert(result.every(s=>s.identified===false));assert(!JSON.stringify(result).includes('SECRET'));assert(!JSON.stringify(result).includes('secret@'));
});
test('diagnostic sessions retain episode correlation without joining analytics or inferring recovery',async()=>{
 const {buildPlayerSessions}=await import('../src/ui/cockpit-sessions.js');
 const id='00000000-0000-0000-0000-000000000001';
 const event=(code,sequence)=>({session_id:id,trace_id:id,code,sequence,stage:'guided',kind:'unknown',app_version:'1.1.1+1',platform:'desktop',browser:'chromium'});
 const result=buildPlayerSessions({analytics:[{session_id:id,event_name:'attempt_started',occurred_at:'2026-10-24'}],diagnostics:[event('guided_input_blocked',1),event('outbox_acknowledged',2)]});
 assert.equal(result.length,2);const diagnostic=result.find(s=>s.kind==='diagnostic');
 assert.equal(diagnostic.state,'blocked');assert.equal(diagnostic.episodes.length,1);
});
