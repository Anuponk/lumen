// Ephemeral permissions derived from a current, expected-account server read.
// This is neither an entitlement nor an optimistic reward projection.
export function gameplayDomainState({signedIn=false,ready=false,blocked=false,userId,client,generation,failure,proof}={}){
 const held=!!signedIn&&!blocked&&!ready&&failure?.reason==='partial_reconciliation'&&failure.domain==='wallet'&&
  ['mutable_balance','invalid_balance','invalid_wallet_revision','stale_wallet_revision'].includes(failure.detail)&&
  !!userId&&!!client&&proof?.userId===userId&&proof.client===client&&proof.generation===generation&&Array.isArray(proof.confirmedQuestIds);
 const confirmedReplayIds=held?[...new Set(proof.confirmedQuestIds.filter(id=>typeof id==='string'))]:[];
 return {
  profile:blocked?'pending':ready?'confirmed':held?'review':'pending',
  achievements:blocked?'pending':ready||held?'confirmed':signedIn?'pending':'local',
  wallet:blocked?'pending':ready?'confirmed':held?'review':signedIn?'pending':'local',
  rewards:blocked||!ready&&signedIn?'pending':signedIn?'confirmed':'local',
  confirmedReplayIds
 };
}
