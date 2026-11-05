import {currentCatalogueOrigin,catalogueOrigin} from '../campaign/catalogue-origin.js';

// Local preservation is distinct from cloud acknowledgement. Issue callbacks
// contain fixed codes, never provider messages or raw profile bytes.
export function createLocalPersistence(storage,getProgress,options={}){
 const progressKey=options.progressKey||'lumenProgressV1';
 const fresh=()=>({solved:{},badges:{},catalogueOrigin:currentCatalogueOrigin});
 const notify=(name,value)=>{try{options[name]?.(value)}catch{/* Presentation cannot undo a durable write. */}};
 const fail=code=>{const result={ok:false,durable:false,code};notify('onIssue',result);return result};
 function parse(raw,checkOrigin=true){
  const p=JSON.parse(raw);
  if(!p||typeof p!=='object'||Array.isArray(p)||!p.solved||typeof p.solved!=='object'||Array.isArray(p.solved)||!p.badges||typeof p.badges!=='object'||Array.isArray(p.badges))throw Error('Invalid local profile');
  if(checkOrigin)try{catalogueOrigin(p)}catch{throw Object.assign(Error('Unsupported local profile'),{code:'LOCAL_UNSUPPORTED_PROFILE'})}
  return p;
 }
 function loadLumenProgress(){
  let raw;try{raw=storage.getItem(progressKey)}catch{fail('LOCAL_READ_FAILED');return fresh()}
  if(raw===null)return fresh();
  try{
   const p=parse(raw,false);
   if(!p.historyBackup&&Object.keys(p.solved).length)p.historyBackup={...p.solved};
   try{if(p.catalogueOrigin===undefined&&catalogueOrigin(p)===currentCatalogueOrigin)p.catalogueOrigin=currentCatalogueOrigin;else catalogueOrigin(p)}catch{fail('LOCAL_UNSUPPORTED_PROFILE')}
   return p;
  }catch(error){fail(error.code==='LOCAL_UNSUPPORTED_PROFILE'?error.code:'LOCAL_INVALID_DATA');return fresh()}
 }
 function preserveInvalid(raw){
  let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619)}
  const prefix='lumenLocalQuarantineV1:'+progressKey+':'+(hash>>>0).toString(16)+':'+raw.length;
  // A collision never overwrites another original; identical bytes reuse it.
  for(let sequence=0;sequence<64;sequence++){
   const key=prefix+':'+sequence,previous=storage.getItem(key);
   if(previous!==null&&previous!==raw)continue;
   if(previous===null)storage.setItem(key,raw);
   if(storage.getItem(key)!==raw)throw Error('Quarantine unverified');
   return;
  }
  throw Error('Quarantine unavailable');
 }
 function saveLumenProgress(){
  let raw;try{raw=storage.getItem(progressKey)}catch{return fail('LOCAL_READ_FAILED')}
  if(raw!==null){
   try{parse(raw)}catch(error){
    if(error.code==='LOCAL_UNSUPPORTED_PROFILE')return fail(error.code);
    try{preserveInvalid(raw)}catch{return fail('LOCAL_QUARANTINE_FAILED')}
   }
  }
  let json;try{json=JSON.stringify(getProgress());parse(json)}catch{return fail('LOCAL_INVALID_DATA')}
  try{
   if(storage.getItem(progressKey)!==raw)return fail('LOCAL_CHANGED');
   storage.setItem(progressKey,json);
   if(storage.getItem(progressKey)!==json)return fail('LOCAL_WRITE_UNVERIFIED');
  }catch{return fail('LOCAL_WRITE_FAILED')}
  const result={ok:true,durable:true};notify('onSave',result);return result;
 }
 return {loadLumenProgress,saveLumenProgress,progressKey};
}
