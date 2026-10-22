import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

export function evaluatePlayReadiness(config){
 const blockers=[];
 for(const key of ['legalName','commercialName','siren','siret','contactEmail','address','telephone','registrationDetails'])if(!String(config?.[key]||'').trim())blockers.push('publisher.'+key);
 if(!/^\d{9}$/.test(config?.siren||''))blockers.push('publisher.siren.format');
 if(!/^\d{14}$/.test(config?.siret||'')||!config.siret.startsWith(config.siren))blockers.push('publisher.siret.format');
 if(config?.monetization!=='free-no-ads-no-purchases')blockers.push('monetization.review');
 if(config?.audience!=='mixed-including-children')blockers.push('audience.review');
 if(!config?.native?.applicationId)blockers.push('native.applicationId');
 if(!Number.isInteger(config?.native?.targetApiReviewed)||!config?.native?.targetApiReviewedOn)blockers.push('native.targetApiReview');
 for(const key of ['privacyPolicy','legalPages','accountDeletionEndToEnd','childSafety','nativeDevice','dataSafety','storeListing','identityIsolation','assetLicenses','businessActivity']){
  const evidence=config?.evidence?.[key];
  if(evidence?.status!=='verified'||!evidence.reference||!evidence.verifiedAt)blockers.push('evidence.'+key);
 }
 return {ready:blockers.length===0,blockers,scope:'Preparation report; does not submit or control the remote Play Console.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const config=JSON.parse(fs.readFileSync(new URL('../content/legal/publisher.json',import.meta.url),'utf8'));
 const result=evaluatePlayReadiness(config);console.log(JSON.stringify(result,null,2));
 if(process.argv.includes('--enforce')&&!result.ready)process.exitCode=1;
}
