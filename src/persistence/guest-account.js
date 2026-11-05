import {validateCloudProfile,cloudSafelyCoversLocal,isAttemptStartPerformance} from './cloud-profile.js';
import {currentCatalogueOrigin} from '../campaign/catalogue-origin.js';

// A missing owner denotes a real guest. A signed-out account cache is still
// owned and must never be imported into the next account (#528).
export function guestAccountSeed(incoming,currentOwner,accountId,fresh){
 if(currentOwner===accountId)return incoming;
 if(currentOwner)return fresh;
 const guest=validateCloudProfile(incoming);
 if(guest.walletRevision||guest.legacyVictoryRevision)throw Error('Profil invité lié à une autorité de compte');
 if(guest.shards===undefined)guest.shards=3;
 if(!Number.isSafeInteger(guest.shards)||guest.shards<0)throw Error('Solde invité invalide');
 return guest;
}

export function preserveGuestBeforeHydration(storage,{accountId,currentOwner,sessionValid=()=>true}={}){
 if(currentOwner||!sessionValid())return null;
 const raw=storage.getItem('lumenProgressV1');
 if(raw===null)return null;
 validateCloudProfile(JSON.parse(raw));
 // Fixed account-scoped copy: retries must not replace the original evidence.
 const prefix='lumenGuestBeforeAccount_'+accountId;
 let key=prefix,sequence=0;
 // A guest may continue offline after a failed login. Retain the earlier copy
 // and preserve the newer one too; retries of identical bytes reuse their copy.
 while(storage.getItem(key)!==null&&storage.getItem(key)!==raw)key=prefix+'_'+(++sequence);
 if(storage.getItem(key)===null)storage.setItem(key,raw);
 if(storage.getItem(key)!==raw)throw Error('Sauvegarde invitée non vérifiée');
 return raw;
}

export function guestNeedsReconciliation(guest,cloud){
 // A virgin browser has the guest starter reserve and today's catalogue
 // origin, not evidence of a grant/spend or an account's historical cohort.
 // Ignore only those defaults for coverage of an EXISTING cloud profile.
 // The original is still archived; new-account seeding remains unchanged.
 const empty=value=>value===undefined||!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(empty);
 const starts=guest?.performances;
 const startsOnly=starts===undefined||!!starts&&typeof starts==='object'&&!Array.isArray(starts)&&
  Object.entries(starts).every(([key,record])=>/^(0|[1-9]\d*)$/.test(key)&&isAttemptStartPerformance(record,Number(key)));
 const untouched=guest&&[undefined,3].includes(guest.shards)&&
  guest.walletRevision===undefined&&guest.legacyVictoryRevision===undefined&&
  [undefined,currentCatalogueOrigin].includes(guest.catalogueOrigin)&&
  [undefined,0].includes(guest.xp)&&[undefined,null,0].includes(guest.skyScore)&&
  (guest.autonomousWins===0||empty(guest.autonomousWins))&&
  startsOnly&&['solved','historyBackup','badges','stars','noHint','canonicalQuestState','challenges','daily'].every(key=>empty(guest[key]));
 if(untouched){
  // Empty daily containers are also scaffolding, not earned dates/rewards.
  // Pure first-gesture timestamps are archived locally, never imported as an
  // account cooldown or treated as a completed/qualified performance.
  const {shards,catalogueOrigin,daily,performances,...evidence}=guest;
  return !cloudSafelyCoversLocal(evidence,cloud);
 }
 return !cloudSafelyCoversLocal(guest,cloud);
}
