// Browser-only #316 flow. The endpoint MUST be a same-origin, trusted
// backend route. Never send an account ID or reauth timestamp from the client.
export function createAccountErasureFlow({getAccessToken,reauthenticate,requestDeletion,clearLumenLocalData,signOut}) {
  if (![getAccessToken,reauthenticate,requestDeletion,clearLumenLocalData,signOut].every(f=>typeof f==='function')) {
    throw Error('Account erasure dependencies required');
  }
  let inFlight=false;
  return async function deleteMyLumenAccount(confirmation) {
    if(inFlight)throw Error('Deletion already in progress');
    if(confirmation!=='SUPPRIMER')throw Error('Saisis SUPPRIMER pour confirmer.');
    inFlight=true;
    try {
      // Reauth must complete a provider-specific challenge and establish a
      // server-owned, session-bound proof. Client timestamps are not accepted.
      await reauthenticate();
      const token=await getAccessToken();
      if(typeof token!=='string'||!token)throw Error('Connexion requise');
      const response=await requestDeletion({token,confirmation:'SUPPRIMER'});
      if(response?.status!=='completed')return {status:'pending',message:'Suppression non encore confirmée'};
      // Only clear local data AFTER server confirms irreversible completion.
      // If cleanup fails, keep a pending state rather than claim success.
      try {
        await signOut();
        await clearLumenLocalData();
      } catch {
        return {status:'local_cleanup_required'};
      }
      return {status:'completed'};
    } finally {inFlight=false;}
  };
}

export async function postAccountErasure({token,confirmation,fetchImpl=fetch,url='/api/lumen/account-erasure'}) {
  if(!url.startsWith('/')||url.startsWith('//'))throw Error('Same-origin endpoint required');
  const response=await fetchImpl(url,{method:'POST',credentials:'omit',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify({confirmation}),cache:'no-store',redirect:'error'});
  if(response.status===202)return {status:'pending'};
  if(!response.ok)throw Error('La suppression n’a pas été effectuée');
  const result=await response.json();
  if(result.status!=='completed')throw Error('Suppression non confirmée');
  return {status:'completed'};
}
