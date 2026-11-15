// #748: explicit install request from the presentation page (/?install=1).
// The visitor asked to install, so the usual "after quest 12" rule does not apply.

// Reads and removes the request from the address bar, so a reload or a shared
// link never shows the offer again.
export function consumeInstallRequest(win){
 try{
  const url=new URL(win.location.href);
  if(url.searchParams.get('install')!=='1')return false;
  url.searchParams.delete('install');
  win.history.replaceState(win.history.state,'',url.pathname+url.search+url.hash);
  return true;
 }catch{return false}
}

export function isIosDevice(userAgent){return /iphone|ipad|ipod/i.test(String(userAgent||''))}

// What the install sheet says: the native prompt when the browser offers one,
// otherwise the exact manual steps for the device.
export function requestedInstallCopy({prompt,ios}){
 if(prompt)return {copy:'Ajoute LUMEN à ton écran d’accueil pour retrouver ton ciel en un geste.',button:'Installer LUMEN'};
 if(ios)return {copy:'Sur iPhone : touche Partager, puis « Sur l’écran d’accueil ».',button:'J’ai compris'};
 return {copy:'Ouvre le menu ⋮ de ton navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».',button:'J’ai compris'};
}
