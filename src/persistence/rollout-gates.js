// Evaluation only. A client report cannot activate a server account or erase data.
export const RECETTE_SCENARIOS=Object.freeze(['device_a_b','two_tabs','offline_restart','close_after_capture','close_after_commit','close_after_ack','quota','indexeddb_denied','account_switch','worker_update','guest_6_account_7','restore_export','dormant_client','response_lost','rollback']);
export function evaluatePersistenceRollout(evidence,{now=Date.now()}={}){
 const blockers=[];
 const sha=/^[0-9a-f]{40}$/;
 if(!evidence||evidence.app!=='Lumen'||evidence.format!=='persistence-release-evidence-v1')return {activate:false,retire:false,blockers:['invalid_evidence']};
 const revision=evidence.revision;
 if(!sha.test(revision??''))blockers.push('revision_missing');
 const isolation=evidence.schemaIsolation;
 const privateSchema=evidence.environment==='schema_isolated'&&isolation?.revision===revision&&isolation?.schema==='lumen_recette'&&isolation?.role==='lumen_recette_runner'&&Boolean(isolation?.reference)&&isolation?.productionAccess===false&&isolation?.sharedAuthWrites===false&&isolation?.publicApi===false&&isolation?.rlsEnabled===true;
 const separateProject=evidence.environment==='isolated'&&evidence.projectRef!==evidence.productionProjectRef;
 if((!privateSchema&&!separateProject)||!evidence.projectRef||!evidence.productionProjectRef)blockers.push('isolated_environment_required');
 if(evidence.protocol!==1||evidence.serverRevision!==revision||evidence.clientRevision!==revision)blockers.push('version_attestation_required');
 if(evidence.ci?.revision!==revision||evidence.ci?.success!==true)blockers.push('exact_revision_ci_required');
 for(const scenario of RECETTE_SCENARIOS){
  const proof=evidence.scenarios?.[scenario];
  if(proof?.revision!==revision||proof?.passed!==true||proof?.transport!=='real'||!proof?.reference)blockers.push('scenario:'+scenario);
 }
 if(evidence.physicalAndroid?.revision!==revision||evidence.physicalAndroid?.passed!==true||new Set(evidence.physicalAndroid?.devices??[]).size<2)blockers.push('physical_android_required');
 if(evidence.shadow?.revision!==revision||evidence.shadow?.secondEmissions!==0||evidence.shadow?.parity!==true)blockers.push('shadow_parity_required');
 if(evidence.losses!==0||evidence.doubleRewards!==0||evidence.unreviewedBaselines!==0)blockers.push('safety_threshold');
 const activate=blockers.length===0;
 const since=Date.parse(evidence.observation?.startedAt),until=Date.parse(evidence.observation?.endedAt);
 if(evidence.observation?.revision!==revision||!Number.isFinite(since)||!Number.isFinite(until)||until>now||since>until||until-since<14*86400000||evidence.observation?.broadCohort!==true)blockers.push('observation_required');
 if(evidence.legacyWriters!==0||evidence.migrationParity!==true||evidence.originalsRestorable!==true||evidence.mirrorServerDerived!==true)blockers.push('retirement_parity_required');
 return {activate,retire:blockers.length===0,blockers};
}
