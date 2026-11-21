import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {accountDeletionMailto} from '../src/privacy/account-deletion.js';
import {evaluatePlayReadiness} from './play-readiness.mjs';

const publisher=JSON.parse(fs.readFileSync('content/legal/publisher.json','utf8'));
const pending=evaluatePlayReadiness(publisher);
assert.equal(pending.ready,false,'missing publisher/device/family evidence must block Play submission');
assert(!pending.blockers.includes('publisher.address'),'provided publisher address clears only its missing-field blocker');
assert(!pending.blockers.includes('publisher.telephone'),'provided publisher telephone clears only its missing-field blocker');
const missingCoordinates=evaluatePlayReadiness({...publisher,address:null,telephone:null});
assert(missingCoordinates.blockers.includes('publisher.address'));
assert(missingCoordinates.blockers.includes('publisher.telephone'));
assert(pending.blockers.includes('evidence.childSafety'));
assert(pending.blockers.includes('evidence.accountDeletionEndToEnd'));
assert(pending.blockers.includes('children.activationReview'),'child activation must remain blocked until a verified parental process exists');
assert.equal(publisher.monetization,'paid-content-no-ads','#732: paid Adventures, no ads');
assert(!pending.blockers.includes('consumer.mediator'),'#732: the mediator is tracked separately, not a publication blocker (owner decision)');
assert.match(publisher.vatOwnerDeclaration.legalBasis,/art\. 293 B du CGI/);
assert(evaluatePlayReadiness({...publisher,vatOwnerDeclaration:{...publisher.vatOwnerDeclaration,legalBasis:null}}).blockers.includes('vat.legalBasis'));

assert.equal(publisher.audience,'mixed-including-children');

const href=accountDeletionMailto('parent+account@example.test');
const url=new URL(href);
assert.equal(url.protocol,'mailto:');
assert.equal(url.pathname,'valente.cedric@gmail.com');
assert.equal(url.pathname,publisher.contactEmail,'request contact must match publisher configuration');
assert.match(url.searchParams.get('subject'),/Lumen/);
assert.match(url.searchParams.get('body'),/parent\+account@example\.test/);
assert(!url.searchParams.get('body').includes('access_token'));
for(const input of ['', 'not-an-address','a@example.test\r\nBcc:someone@example.test','a@example.test?subject=other'])assert.throws(()=>accountDeletionMailto(input));
const englishMail=new URL(accountDeletionMailto('parent+account@example.test','en'));
assert.equal(englishMail.pathname,url.pathname);
assert.equal(englishMail.searchParams.get('subject'),'Lumen account deletion request');
assert.match(englishMail.searchParams.get('body'),/Account email: parent\+account@example\.test/);
const legalPairs=[
 ['mentions-legales.html','legal-notice.html'],
 ['confidentialite.html','privacy-policy.html'],
 ['cgv.html','terms-of-sale.html'],
 ['supprimer-compte.html','delete-account.html']
];
const reviewFile='content/legal/translation-review.json';
const current=Object.fromEntries(legalPairs.map(([fr,en])=>[
 en, Object.fromEntries([fr,en].map(file=>[file,createHash('sha256')
   .update(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')]))
]));
if(process.argv[2]==='--review-legal-translations')fs.writeFileSync(reviewFile,JSON.stringify(current,null,2)+'\n');
assert.deepEqual(current,JSON.parse(fs.readFileSync(reviewFile,'utf8')),'Review the updated French and English documents in context');
for(const [fr,en] of legalPairs){
 const original=fs.readFileSync(fr,'utf8'),translation=fs.readFileSync(en,'utf8');
 assert(original.includes('href="/'+en+'" hreflang="en"'));
 assert(translation.includes('<html lang="en">')&&translation.includes('href="/'+fr+'" lang="fr"'));
 assert.equal(translation.includes('content="noindex"'),original.includes('content="noindex"'));
 assert.equal(translation.includes('content="no-referrer"'),original.includes('content="no-referrer"'));
 for(const shipper of ['scripts/o2switch-cron-publish.sh','scripts/o2switch-safe-release.sh','scripts/o2switch-deploy-tests.py']){
  assert(fs.readFileSync(shipper,'utf8').includes(en),en+' is included in '+shipper);
 }
}
const englishPage=fs.readFileSync('delete-account.html','utf8');
assert.match(englishPage,/type="checkbox"[^>]*required/);
assert.match(englishPage,/id="accountDeletionRequest"/);
assert.doesNotMatch(englishPage,/supabase-js|service_role|analytics\/events|lumen_track_event/);
const page=fs.readFileSync('supprimer-compte.html','utf8');
assert.match(page,/sans.*réinstaller/i);
assert.match(page,/uniquement les données associées à Lumen/i);
assert.doesNotMatch(page,/SoldeZen|Supabase/i,'public deletion page must not disclose shared infrastructure');
assert.match(page,/aucune demande.*envoyée automatiquement/i);
assert.match(page,/type="email"/);
assert.match(page,/type="checkbox"[^>]*required/);
assert.doesNotMatch(page,/supabase-js|service_role|analytics\/events|lumen_track_event/);
assert.match(fs.readFileSync('index.html','utf8'),/href="\/supprimer-compte\.html"/,'deletion request must be discoverable in the app');
assert.equal(evaluatePlayReadiness({...publisher,monetization:'advertising'}).ready,false);
// Synthetic complete evidence only verifies report behavior, not the real app.
const complete=structuredClone(publisher);
Object.assign(complete,{address:'Fixture professional address',telephone:'Fixture telephone',registrationDetails:'Fixture registration'});
complete.childrenActivation='enabled-after-verified-parental-process';
complete.native.applicationId='fr.example.fixture';
for(const key of Object.keys(complete.evidence))complete.evidence[key]={status:'verified',reference:'fixture-only:'+key,verifiedAt:'2026-10-22'};
assert.equal(evaluatePlayReadiness(complete).ready,true,'complete synthetic evidence may clear preparation fields');
assert(evaluatePlayReadiness({...complete,childrenActivation:'blocked-pending-verification-method'}).blockers.includes('children.activationReview'),'other completed evidence must not override the owner decision to keep child activation blocked');
complete.evidence.accountDeletionEndToEnd=null;
assert(evaluatePlayReadiness(complete).blockers.includes('evidence.accountDeletionEndToEnd'),'a request page is not deletion evidence');
console.log('Privacy preparation: deletion request encoding/confirmation and explicit Play blockers verified; no player writes.');
