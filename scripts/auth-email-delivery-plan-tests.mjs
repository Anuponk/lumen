import assert from "node:assert/strict";
import {planAuthEmails} from "../src/auth/email-delivery-plan.js";
const make=(action,origin="https://lumen.nopuna.fr/")=>({user:{email:"old@example.com",new_email:"new@example.com"},email_data:{redirect_to:origin,email_action_type:action,token:"123456",token_new:"654321",token_hash:"h1",token_hash_new:"h2"}});
for(const action of ["signup","magiclink","recovery","invite","reauthentication","email"]){const p=planAuthEmails(make(action));assert.equal(p.ok,true);assert.equal(p.deliveries.length,1)}
const secure=planAuthEmails(make("email_change"));assert.equal(secure.ok,true);assert.deepEqual(secure.deliveries.map(x=>[x.email,x.token]),[["old@example.com","123456"],["new@example.com","654321"]]);
const single=make("email_change","https://soldezen.fr/");single.email_data.token_hash_new="";assert.equal(planAuthEmails(single).deliveries.length,1);assert.equal(planAuthEmails(single).brand,"soldezen");
for(const bad of ["https://evil.example/","http://lumen.nopuna.fr/","https://lumen.nopuna.fr.attacker.org/"]){assert.equal(planAuthEmails(make("signup",bad)).ok,false)}
const incomplete=make("email_change");incomplete.email_data.token_new="";assert.equal(planAuthEmails(incomplete).ok,false);
assert.equal(planAuthEmails(make("unexpected")).ok,false);
console.log("Auth email delivery planner passed");
