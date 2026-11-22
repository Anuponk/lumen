// Paint the hold before the game shell when a stored session or auth return
// needs restoring. Storage and URL hints only affect presentation.
try{
 const query=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
 const authReturn=query.has('lumen_confirm')||query.has('code')||query.has('token_hash')||fragment.has('access_token');
 const storedSession=localStorage.getItem('sb-tjdjlavmusmncuszhsuw-auth-token');
 if(query.get('qa')!=='new'&&(authReturn||storedSession||sessionStorage.getItem('lumenAccountSwitchHoldV1')==='1')){
  const hold=document.getElementById('accountSwitchHold');
  // Cover the previous account immediately. Reveal the copy only once it
  // uses the same saved preference as the game shell.
  hold.classList.add('localizing');
  hold.hidden=false;
  import('./i18n.js').then(({createLocalePreference})=>{
   if(!hold.classList.contains('localizing'))return;
   const preference=createLocalePreference({storage:localStorage,languages:navigator.languages,language:navigator.language});
   const {t}=preference.translator();
   document.documentElement.lang=preference.locale;
   for(const node of hold.querySelectorAll('[data-game-text]'))node.textContent=t(node.dataset.gameText);
  }).catch(()=>{}).finally(()=>hold.classList.remove('localizing'));
  document.body.classList.add('account-switch-hold');
  // A pending identity change cannot use the prior owner's offline cache.
  const storedOwner=storedSession?JSON.parse(storedSession)?.user?.id:null;
  if(authReturn||storedOwner&&storedOwner!==localStorage.getItem('lumenCloudOwnerId'))hold.dataset.unverifiedOwner='true';
 }
}catch{}
