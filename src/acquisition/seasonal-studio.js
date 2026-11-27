import {validDay} from '../campaign/seasonal-events.js';

const frame=document.getElementById('seasonal-preview');
const date=document.getElementById('date');
const locale=document.getElementById('locale');
const format=document.getElementById('format');
const view=document.getElementById('view');
const query=new URL(location.href).searchParams;
if(validDay(query.get('date')))date.value=query.get('date');
if(['fr','en','es'].includes(query.get('lang')))locale.value=query.get('lang');

function render(){
 if(!validDay(date.value))return;
 const url=new URL('/',location.origin);
 url.searchParams.set('studioPreview',date.value);
 url.searchParams.set('studioView',view.value);
 url.hash='lumen-app-language='+locale.value;
 frame.src=url.href;
}

for(const field of [date,locale,view])field.addEventListener('change',render);
format.addEventListener('change',()=>{frame.dataset.format=format.value});
render();
