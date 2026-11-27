// Standalone preview: no game boot, Supabase, analytics, profile or attempt writes.
import {dailyPresentation,validDay} from '../campaign/seasonal-events.js';
import {canonicalQuestList} from '../campaign/canonical-quests.js';
import {boardSvg} from './daily-creative.js';
const sample=canonicalQuestList().find(q=>q.legacyIndex===0);
const board=boardSvg(sample.reg,[]);
function render(){
 const day=document.getElementById('date').value;if(!validDay(day))return;
 const p=dailyPresentation(day,document.getElementById('locale').value);
 document.getElementById('event').textContent=(p.event?.skin.decoration??'')+' '+p.title;
 document.getElementById('day').textContent=p.dayLabel;
 document.getElementById('celebration').textContent=p.celebration;
 document.getElementById('campaign').textContent=p.campaign+' · '+p.hashtags;
 document.getElementById('creative').style.setProperty('--accent',p.event?.skin.accent??'#9be8f4');
 document.getElementById('board').innerHTML=board;
}
document.getElementById('date').addEventListener('change',render);
document.getElementById('locale').addEventListener('change',render);
document.getElementById('download').onclick=()=>{
 const p=dailyPresentation(document.getElementById('date').value,document.getElementById('locale').value);
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#081a30"/><g fill="'+(p.event?.skin.accent??'#9be8f4')+'" font-family="sans-serif"><text x="64" y="130" font-size="30">✦ LUMEN · DÉMONSTRATION</text><text x="64" y="240" font-size="42">'+p.title+'</text><text x="64" y="310" font-size="24">'+p.dayLabel+'</text></g><g transform="translate(710 105)">'+board+'</g></svg>';
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 const a=document.createElement('a');a.href=url;a.download='lumen-habillage-demo.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
render();
