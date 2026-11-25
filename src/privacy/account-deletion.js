import fr from '../ui/locales/fr/privacy.js';
import en from '../ui/locales/en/privacy.js';
import es from '../ui/locales/es/privacy.js';

const contact='valente.cedric@gmail.com';

function deletionCopy(locale){
 return locale==='es'?es:locale==='en'?en:fr;
}

export function accountDeletionMailto(accountAddress,locale='fr'){
 const address=String(accountAddress||'').trim();
 const copy=deletionCopy(locale);
 if(address.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(address)||/[\r\n?&#]/.test(address))throw Error(copy['privacy.deletion.invalid']);
 const subject=copy['privacy.deletion.subject'];
 const body=copy['privacy.deletion.body'].replace(/\{address\}/,()=>address);
 return 'mailto:'+contact+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}

export function wireAccountDeletionForm(document,openMailto){
 const form=document.getElementById('accountDeletionRequest');
 if(!form)return;
 const locale=document.documentElement.lang;
 const copy=deletionCopy(locale);
 form.onsubmit=event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const status=document.getElementById('deletionRequestStatus');
  try{
   const href=accountDeletionMailto(document.getElementById('deletionAccountAddress').value,locale);
   openMailto(href);
   status.textContent=copy['privacy.deletion.prepared'];
  }catch{status.textContent=copy['privacy.deletion.failed'].replace(/\{contact\}/,contact)}
 };
}

if(typeof document!=='undefined')wireAccountDeletionForm(document,href=>{location.href=href});
