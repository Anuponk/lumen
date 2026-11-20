// #820: dedicated password-recovery screen, distinct from sign-in and from the
// account editor. Pure state machine: the DOM, Auth and storage are injected.
// No password, token or provider message ever leaves this module.

export const RECOVERY_MIN_PASSWORD_LENGTH=12;

// Local checks before contacting the provider. Provider rules (weak/same
// password) are still enforced by Supabase and classified by setAccountPassword.
export function validateNewPassword(password,confirmation){
 if(typeof password!=='string'||password.length<RECOVERY_MIN_PASSWORD_LENGTH)return 'password';
 if(password!==confirmation)return 'mismatch';
 return null;
}

// Bounded, human messages. The form stays visible for every recoverable error.
export function passwordRecoveryErrorCopy(reason){
 switch(reason){
  case 'password':return 'Utilise au moins 12 caractères.';
  case 'mismatch':return 'Les deux mots de passe ne correspondent pas. Corrige la confirmation.';
  case 'same_password':return 'Choisis un mot de passe différent de l’ancien.';
  case 'weak_password':return 'Ce mot de passe est trop faible. Choisis-en un plus long ou plus varié.';
  case 'network':return 'Connexion impossible. Ton mot de passe n’a pas été modifié. Vérifie ton réseau, puis réessaie.';
  case 'session_expired':case 'signed_out':case 'session_changed':
   return 'Ce lien de réinitialisation n’est plus actif. Demande un nouveau lien : ton mot de passe n’a pas été modifié.';
  default:return 'Le mot de passe n’a pas pu être modifié. Réessaie dans un instant.';
 }
}

// Errors after which retrying with the same recovery session is pointless.
const SESSION_LOST=new Set(['session_expired','signed_out','session_changed']);

// What the screen shows for each phase. `action` drives the single main button
// outside the form; `form` says whether the two password fields are shown.
export function passwordRecoveryView(state){
 switch(state.phase){
  case 'verifying':return {title:'Vérification de ton lien…',text:'Un instant, nous vérifions ton lien de réinitialisation.',form:false,action:null};
  case 'form':case 'saving':return {title:'Choisis ton nouveau mot de passe',
   text:'Ton lien de réinitialisation a été vérifié.'+(state.email?' Compte : '+state.email+'.':''),
   form:true,busy:state.phase==='saving',error:state.error?passwordRecoveryErrorCopy(state.error):'',
   submitLabel:state.phase==='saving'?'Enregistrement…':'Enregistrer mon nouveau mot de passe',action:null};
  case 'success':return state.signedIn
   ?{title:'Mot de passe modifié !',text:'Ton nouveau mot de passe est enregistré. Utilise-le lors de ta prochaine connexion.',form:false,action:'continue',label:'Continuer mon aventure'}
   :{title:'Mot de passe modifié !',text:'Ton nouveau mot de passe est enregistré. Connecte-toi avec lui pour retrouver ton aventure.',form:false,action:'signin',label:'Se connecter'};
  case 'unreachable':return {title:'Vérification impossible pour le moment',text:'Ton lien n’a pas pu être vérifié. Vérifie ta connexion, puis rouvre le lien depuis l’e-mail.',form:false,action:'close',label:'Fermer'};
  case 'invalid':return {title:'Ce lien n’est plus actif',text:passwordRecoveryErrorCopy(state.error||'session_expired'),form:false,action:'recover',label:'Demander un nouveau lien'};
  default:return null;
 }
}

// One recovery attempt bound to the account whose recovery session opened it.
// updatePassword(password) -> {ok, reason}; currentUser() -> {id,email}|null.
export function createPasswordRecoveryFlow({updatePassword,currentUser,render=()=>{}}){
 let state={phase:'idle'};
 const set=next=>{state=next;render(state,passwordRecoveryView(state));return state};
 const owner=()=>{const user=currentUser();return user?.id?user:null};
 return {
  get state(){return state},
  // A recovery link was detected but the provider verdict is not known yet.
  verifying(){if(state.phase==='idle')set({phase:'verifying'});return state},
  // The recovery session is established: bind the form to that account.
  open(){
   const user=owner();
   if(!user)return set({phase:'invalid',error:'signed_out'});
   if(['form','saving','success'].includes(state.phase)&&state.ownerId===user.id)return state;
   return set({phase:'form',ownerId:user.id,email:typeof user.email==='string'?user.email:'',error:null});
  },
  // A verified link without any session cannot change a password.
  sessionMissing(){if(state.phase!=='success')set({phase:'invalid',error:'signed_out'});return state},
  // Auth did not answer: neither a success nor an expired link can be stated.
  unreachable(){if(state.phase==='verifying')set({phase:'unreachable'});return state},
  async submit(password,confirmation){
   if(state.phase!=='form')return {ok:false,reason:'busy'}; // double submission
   const invalid=validateNewPassword(password,confirmation);
   if(invalid){set({...state,error:invalid});return {ok:false,reason:invalid}}
   const ownerId=state.ownerId;
   // Only the account that opened the recovery link may change its password.
   if(owner()?.id!==ownerId){set({phase:'invalid',error:'session_changed'});return {ok:false,reason:'session_changed'}}
   set({...state,phase:'saving',error:null});
   let result;
   try{result=await updatePassword(password)}catch{result={ok:false,reason:'network'}}
   if(!result?.ok){
    const reason=result?.reason||'password_update';
    if(SESSION_LOST.has(reason))set({phase:'invalid',error:reason});
    else set({...state,phase:'form',error:reason});
    return {ok:false,reason};
   }
   // Success is only stated after the provider confirmed the update. The
   // follow-up action matches the real session (#820).
   set({phase:'success',ownerId,signedIn:owner()?.id===ownerId});
   return {ok:true};
  },
  close(){return set({phase:'idle'})}
 };
}
