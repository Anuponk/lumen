// Presentation/navigation only. The existing RPCs remain the data/access boundary.
export const ANALYTICS_SECTIONS=Object.freeze(['overview','players','activity','acquisition','journeys','sync','support']);
const route=pathname=>/^\/admin\/analytics\/?$/.test(pathname);
export function analyticsSection(value){return ANALYTICS_SECTIONS.includes(value)?value:'overview'}

export function createAnalyticsNavigation({window,document,modal,allowed,onOpen,onClose=()=>{},onPeriodChange=()=>{},onSection=()=>{}}){
 const nav=modal.querySelector('[data-analytics-navigation]');
 const panels=[...modal.querySelectorAll('[data-analytics-panel]')];
 const access=document.getElementById('adminAnalyticsAccess');
 const days=document.getElementById('adminCockpitDays');
 let section='overview',returnUrl='/',returnFocus=null,opened=false,previousOverflow='';
 const locationUrl=()=>new URL(window.location.href);
 function select(value,{write=true,focus=false}={}){
  section=analyticsSection(value);modal.dataset.analyticsCurrent=section;
  for(const panel of panels)panel.hidden=panel.dataset.analyticsPanel!==section;
  for(const button of nav.querySelectorAll('[data-analytics-section]')){
   const selected=button.dataset.analyticsSection===section;
   if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
   if(selected&&focus)button.focus();
  }
  if(opened)onSection(section);
  if(write&&opened){const url=locationUrl();url.pathname='/admin/analytics';url.searchParams.set('section',section);url.searchParams.set('days',days.value);window.history.pushState(null,'',url.pathname+url.search+url.hash)}
 }
 function open({fromRoute=false}={}){
  if(!allowed())return false;
  if(!opened){
   const current=locationUrl();returnUrl=route(current.pathname)?'/':current.pathname+current.search+current.hash;
   returnFocus=document.activeElement;previousOverflow=document.body.style.overflow;
   document.body.style.overflow='hidden';opened=true;modal.hidden=false;
   const period=current.searchParams.get('days')||'7';
   if(fromRoute)days.value=[...days.options].some(option=>option.value===period)?period:'7';
   select(fromRoute?current.searchParams.get('section'):section,{write:false});
   if(!fromRoute){const url=locationUrl();url.pathname='/admin/analytics';url.searchParams.set('section',section);url.searchParams.set('days',days.value);window.history.pushState(null,'',url.pathname+url.search+url.hash)}
   if(access)access.hidden=true;
   onOpen();modal.querySelector('#adminCockpitClose').focus();
  }else{
   const current=locationUrl(),requested=current.searchParams.get('days')||'7';
   const period=[...days.options].some(option=>option.value===requested)?requested:'7';
   select(current.searchParams.get('section'),{write:false});
   if(period&&period!==days.value&&[...days.options].some(option=>option.value===period)){days.value=period;onPeriodChange()}
  }
  return true;
 }
 function close({write=true}={}){
  if(opened){opened=false;modal.hidden=true;document.body.style.overflow=previousOverflow;onClose();if(returnFocus?.isConnected)returnFocus.focus()}
  if(write&&route(locationUrl().pathname))window.history.pushState(null,'',returnUrl);
 }
 function syncAccess(){
  if(!allowed()){
   close({write:false});
   if(access)access.hidden=!route(locationUrl().pathname);
   return;
  }
  if(access)access.hidden=true;
  if(route(locationUrl().pathname))open({fromRoute:true});
 }
 nav.addEventListener('click',event=>{
  const button=event.target.closest('[data-analytics-section]');
  if(button&&nav.contains(button)&&allowed())select(button.dataset.analyticsSection);
 });
 days.addEventListener('change',()=>{if(!opened||!allowed())return;const url=locationUrl();url.searchParams.set('days',days.value);window.history.replaceState(null,'',url.pathname+url.search+url.hash)});
 modal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();close();return}
  if(event.key!=='Tab')return;
  const nodes=[...modal.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex="0"]')].filter(n=>!n.disabled&&n.getClientRects().length);
  const first=nodes[0],last=nodes.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
 });
 window.addEventListener('popstate',()=>{if(route(locationUrl().pathname))syncAccess();else {close({write:false});if(access)access.hidden=true}});
 select(section,{write:false});
 return {open,close,syncAccess,navigate:value=>{if(opened&&allowed())select(value,{focus:true})},section:()=>section};
}
