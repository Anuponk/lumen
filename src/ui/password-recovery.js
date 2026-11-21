import {createTranslator} from './i18n.js';

const french=createTranslator().t;

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
export function passwordRecoveryErrorCopy(reason,t=french){
 switch(reason){
  case 'password':return t('account.passwordTooShort');
  case 'mismatch':return t('account.passwordMismatch');
  case 'same_password':return t('account.passwordSame');
  case 'weak_password':return t('account.passwordWeak');
  case 'network':return t('account.passwordNetwork');
  case 'session_expired':case 'signed_out':case 'session_changed':
   return t('account.passwordExpired');
  default:return t('account.passwordUpdateFailed');
 }
}

// Errors after which retrying with the same recovery session is pointless.
const SESSION_LOST=new Set(['session_expired','signed_out','session_changed']);

// What the screen shows for each phase. `action` drives the single main button
// outside the form; `form` says whether the two password fields are shown.
export function passwordRecoveryView(state,t=french){
 switch(state.phase){
  case 'verifying':return {title:t('account.verifyingLink'),text:t('account.passwordChecking'),form:false,action:null};
  case 'form':case 'saving':return {title:t('account.passwordChoose'),
   text:state.email?t('account.passwordVerifiedEmail',{email:state.email}):t('account.passwordVerified'),
   form:true,busy:state.phase==='saving',error:state.error?passwordRecoveryErrorCopy(state.error,t):'',
   submitLabel:state.phase==='saving'?t('account.passwordSaving'):t('account.savePassword'),action:null};
  case 'success':return state.signedIn
   ?{title:t('account.passwordChanged'),text:t('account.passwordChangedCopy'),form:false,action:'continue',label:t('account.continue')}
   :{title:t('account.passwordChanged'),text:t('account.passwordChangedSignIn'),form:false,action:'signin',label:t('account.signIn')};
  case 'unreachable':return {title:t('account.passwordLinkUnreachable'),text:t('account.passwordLinkUnreachableCopy'),form:false,action:'close',label:t('app.close')};
  case 'invalid':return {title:t('account.passwordLinkInvalid'),text:passwordRecoveryErrorCopy(state.error||'session_expired',t),form:false,action:'recover',label:t('account.passwordLinkNew')};
  default:return null;
 }
}

// One recovery attempt bound to the account whose recovery session opened it.
// updatePassword(password) -> {ok, reason}; currentUser() -> {id,email}|null.
export function createPasswordRecoveryFlow({updatePassword,currentUser,render=()=>{},t=french}){
 let state={phase:'idle'};
 const set=next=>{state=next;render(state,passwordRecoveryView(state,t));return state};
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
