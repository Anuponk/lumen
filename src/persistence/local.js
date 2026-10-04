export function createLocalPersistence(localStorage,getProgress,options={}){
const progressKey=options.progressKey||"lumenProgressV1";
function loadLumenProgress(){try{const p=JSON.parse(localStorage.getItem(progressKey))||{solved:{},badges:{}};if(!p.historyBackup&&p.solved&&Object.keys(p.solved).length)p.historyBackup={...p.solved};return p}catch(e){return {solved:{},badges:{}}}}
function saveLumenProgress(){const lumenProgress=getProgress();try{localStorage.setItem(progressKey,JSON.stringify(lumenProgress))}catch(e){}}
return {loadLumenProgress,saveLumenProgress,progressKey};
}
