import {currentCatalogueOrigin,catalogueOrigin} from '../campaign/catalogue-origin.js';
export function createLocalPersistence(localStorage,getProgress,options={}){
const progressKey=options.progressKey||"lumenProgressV1";
function loadLumenProgress(){try{const p=JSON.parse(localStorage.getItem(progressKey))||{solved:{},badges:{},catalogueOrigin:currentCatalogueOrigin};if(!p.historyBackup&&p.solved&&Object.keys(p.solved).length)p.historyBackup={...p.solved};if(p.catalogueOrigin===undefined&&catalogueOrigin(p)===currentCatalogueOrigin)p.catalogueOrigin=currentCatalogueOrigin;return p}catch(e){return {solved:{},badges:{},catalogueOrigin:currentCatalogueOrigin}}}
function saveLumenProgress(){const lumenProgress=getProgress();try{localStorage.setItem(progressKey,JSON.stringify(lumenProgress));options.onSave?.()}catch(e){}}
return {loadLumenProgress,saveLumenProgress,progressKey};
}
