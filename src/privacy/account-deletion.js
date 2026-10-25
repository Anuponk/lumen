const contact='valente.cedric@gmail.com';

export function accountDeletionMailto(accountAddress){
 const address=String(accountAddress||'').trim();
 if(address.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(address)||/[\r\n?&#]/.test(address))throw Error('Indique une adresse de compte valide.');
 const subject='Demande de suppression de mon compte Lumen';
 const body='Bonjour,\n\nJe demande la suppression de mon compte Lumen et des données Lumen associées.\nAdresse du compte : '+address+'\n\nCette demande concerne Lumen, pas mes autres services éventuels. Merci de me confirmer les étapes de vérification et la réalisation de la suppression.\n';
 return 'mailto:'+contact+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}

export function wireAccountDeletionForm(document,openMailto){
 const form=document.getElementById('accountDeletionRequest');
 if(!form)return;
 form.onsubmit=event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const status=document.getElementById('deletionRequestStatus');
  try{
   const href=accountDeletionMailto(document.getElementById('deletionAccountAddress').value);
   openMailto(href);
   status.textContent='La demande est préparée dans ta messagerie. Envoie ce message pour la transmettre ; aucune suppression ni aucun envoi automatique n’a eu lieu.';
  }catch{status.textContent='Impossible de préparer le message. Vérifie l’adresse ou contacte directement '+contact+'.'}
 };
}

if(typeof document!=='undefined')wireAccountDeletionForm(document,href=>{location.href=href});
