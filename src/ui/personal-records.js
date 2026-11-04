import {validRecordTime,personalRecordComparison} from '../campaign/personal-records.js';
export function recordLabel(record,format){
 const labels=[];
 if(validRecordTime(record?.bestTime))labels.push('Record : '+format(record.bestTime));
 if(validRecordTime(record?.bestUnassistedTime))labels.push('Sans aide : '+format(record.bestUnassistedTime));
 return labels.join(' · ');
}
export function renderRecordResult(element,previous,confirmed,facts,format,{reused=false}={}){
 if(!element)return;
 const changed=reused?{}:personalRecordComparison(previous,confirmed,facts);
 const label=recordLabel(confirmed,format);
 element.hidden=!label;
 element.classList.toggle('personal-record-new',!!(changed.absolute||changed.unassisted));
 const message=changed.absolute?'Nouveau record !':changed.unassisted?'Nouveau record sans aide !':'';
 const delta=validRecordTime(previous?.bestTime)&&validRecordTime(facts?.seconds)?facts.seconds-previous.bestTime:null;
 element.textContent=[message,label,!message&&delta!==null?(delta===0?'Record égalé':'Écart : '+(delta>0?'+':'−')+format(Math.abs(delta))):''].filter(Boolean).join(' · ');
}
