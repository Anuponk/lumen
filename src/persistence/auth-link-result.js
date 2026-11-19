// #820: outcome of an e-mail link (sign-up confirmation or password recovery).
// Pure helpers: no token, address or provider message ever leaves this module.

const VERIFIED_TYPES={signup:'signup',invite:'signup',recovery:'recovery',magiclink:'other',email_change:'other',email:'signup'};

// Supabase's native /auth/v1/verify redirects back with either a session in the
// fragment (#access_token=…&type=signup) or an error (#error=…&error_code=…).
// Read it synchronously at boot, before the SDK consumes or clears the URL.
export function readNativeAuthLinkResult(href){
 let url;
 try{url=new URL(String(href||''))}catch{return null}
 const fragment=new URLSearchParams(url.hash.replace(/^#/,''));
 const read=key=>fragment.get(key)??url.searchParams.get(key);
 const error=read('error'),errorCode=read('error_code'),description=read('error_description');
 if(error||errorCode)return {status:'error',kind:null,reason:classifyAuthLinkError(errorCode||error,description)};
 const type=fragment.get('type');
 if(fragment.get('access_token')&&Object.hasOwn(VERIFIED_TYPES,type))return {status:'verified',kind:VERIFIED_TYPES[type]};
 return null;
}

// Only bounded reasons: never echo the provider message.
export function classifyAuthLinkError(code,message){
 const text=String(code||'')+' '+String(message||'');
 if(/otp_expired|expired|already.*used|invalid|not.?found|flow_state/i.test(text))return 'expired_or_used';
 if(/fetch|network|timeout|unavailable|failed to/i.test(text))return 'network';
 return 'invalid';
}

// Remove only the error parameters of a failed redirect, keeping the rest.
export function scrubNativeAuthLinkError(win){
 try{
  const url=new URL(win.location.href);
  const fragment=new URLSearchParams(url.hash.replace(/^#/,''));
  let changed=false;
  for(const key of ['error','error_code','error_description','sb']){
   if(fragment.has(key)){fragment.delete(key);changed=true}
   if(url.searchParams.has(key)){url.searchParams.delete(key);changed=true}
  }
  if(!changed)return false;
  const hash=fragment.toString();
  win.history.replaceState(win.history.state,'',url.pathname+url.search+(hash?'#'+hash:''));
  return true;
 }catch{return false}
}

// What the player sees. Success is only stated for a verified link; the action
// follows the real session: continue when signed in, otherwise sign in.
export function authLinkMessage(result,{signedIn=false}={}){
 if(!result)return null;
 if(result.status==='verified'){
  if(result.kind!=='signup')return null;
  return signedIn
   ?{title:'Adresse e-mail confirmée !',text:'Ton compte Lumen est prêt.',action:'continue',label:'Continuer mon aventure'}
   :{title:'Adresse e-mail confirmée !',text:'Ton compte Lumen est prêt. Connecte-toi pour retrouver ton aventure.',action:'signin',label:'Se connecter'};
 }
 if(result.reason==='network')return {title:'Vérification impossible pour le moment',
  text:'Le lien n’a pas pu être vérifié. Vérifie ta connexion, puis rouvre le lien depuis l’e-mail.',action:'close',label:'Fermer'};
 if(result.kind==='recovery')return {title:'Ce lien n’est plus valide',
  text:'Ce lien de réinitialisation a expiré ou a déjà été utilisé. Demande un nouveau lien : seul le plus récent fonctionne.',action:'recover',label:'Demander un nouveau lien'};
 return {title:'Ce lien n’est plus valide',
  text:'Il a expiré ou a déjà été utilisé. Si tu as déjà confirmé ton adresse, connecte-toi simplement. Sinon, recommence l’inscription pour recevoir un nouveau lien.',
  action:signedIn?'continue':'signin',label:signedIn?'Continuer mon aventure':'Se connecter'};
}
