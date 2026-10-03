export function createLocalPersistence(localStorage,getProgress){
function loadLumenProgress(){try{const p=JSON.parse(localStorage.getItem("lumenProgressV1"))||{solved:{},badges:{}};if(!p.historyBackup&&p.solved&&Object.keys(p.solved).length)p.historyBackup={...p.solved};return p}catch(e){return {solved:{},badges:{}}}}
function saveLumenProgress(){const lumenProgress=getProgress();try{localStorage.setItem("lumenProgressV1",JSON.stringify(lumenProgress))}catch(e){}}
return {loadLumenProgress,saveLumenProgress};
}
