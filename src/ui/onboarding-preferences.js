// Local presentation preferences only. Never included in a reward/cloud profile.
// Resolve the owner at each access so an account switch cannot reuse a closure.
export function createOnboardingPreferences({storage,getOwner=()=>null,prefix='lumenOnboardingV1'}={}){
 const memory=new Map();
 const key=()=>prefix+':'+(getOwner()||'guest');
 function read(){
  const k=key();
  try{const value=JSON.parse(storage.getItem(k)||'null');if(value&&typeof value==='object'&&!Array.isArray(value)){memory.set(k,value);return value}}catch{}
  return memory.get(k)||{};
 }
 function write(patch){
  const k=key(),value={...read(),...patch};memory.set(k,value);
  try{storage.setItem(k,JSON.stringify(value))}catch{}
 }
 return {
  auto(){const value=read().auto;return typeof value==='boolean'?value:true},
  setAuto(value){write({auto:!!value})},
  seen(id){return read().tips?.includes(id)||false},
  markSeen(id){write({tips:[...new Set([...(read().tips||[]),id])]})}
 };
}
