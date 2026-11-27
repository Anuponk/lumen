// #1044 · Analytics › Activité & Premium (docs/ANALYTICS_1044.md). Presentation of
// three aggregate reads loaded together (lumen_admin_activity, lumen_admin_conversion,
// lumen_admin_quota_simulation). Rules: a day before the coverage start is « non
// mesuré », never 0; the current Paris day is incomplete; every block names its
// source, denominator and coverage; no account identifier is ever received.
import {createTranslator} from './i18n.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const num=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);
const round1=value=>value===null?null:Math.round(value*10)/10;
export const ratio=(a,b)=>{const x=num(a),y=num(b);return x===null||y===null||y===0?null:x/y};
export const pct=(a,b)=>{const r=ratio(a,b);return r===null?null:Math.round(r*1000)/10};
export const SIMULATED_QUOTAS=Object.freeze([5,10,15,20,25,30,50]);
export const ACTIVITY_DEFAULTS=Object.freeze({days:30,includeInternal:false,segment:'all',channel:'all',windowDays:7});
const french=createTranslator({locale:'fr'}).t;
// Catalogue namespace of this section (src/ui/locales/*/admin-activity.js).
const ACTIVITY_KEYS='admin.activity.';
const attrs=props=>Object.entries(props).map(([k,v])=>k+'="'+esc(v)+'"').join(' ');
const svgRect=(props,inner='')=>'<rect '+attrs(props)+'>'+inner+'</rect>';
const dayLabel=day=>{const [,m,d]=String(day).split('-');return d&&m?d+'/'+m:String(day)};

export function buildActivityModel(activity,conversion,simulation){
 const a=activity&&typeof activity==='object'?activity:null,c=conversion&&typeof conversion==='object'?conversion:null;
 const today=a?.today||c?.today||null,dataStart=a?.dataStart||null,eventsStart=c?.eventsStart||null;
 const days=(a?.daily||[]).map(d=>{
  const covered=!!dataStart&&d.day>=dataStart,players=num(d.players),timedPlayers=num(d.timedPlayers);
  const v=x=>covered?num(x):null;
  return {day:d.day,partial:d.day===today,covered,players:v(players),finishers:v(d.finishers),
   started:v(d.started),startedNew:v(d.startedNew),startedReplay:v(d.startedReplay),
   completed:v(d.completed),completedNew:v(d.completedNew),completedReplay:v(d.completedReplay),
   avgStarted:covered?round1(ratio(d.started,players)):null,avgCompleted:covered?round1(ratio(d.completed,players)):null,
   minutes:covered?round1(num(d.seconds)/60):null,
   // Mean over players with a measured duration (the reliable denominator), coverage apart.
   avgMinutes:covered?round1(ratio(num(d.seconds)/60,timedPlayers)):null,
   timedPlayers:v(timedPlayers),freePlayers:v(d.freePlayers),premiumPlayers:v(d.premiumPlayers),
   subjectPlayers:num(d.subjectPlayers),reachNew:num(d.reachNew),reachReplay:num(d.reachReplay),newLimit:num(d.newLimit),replayLimit:num(d.replayLimit)};
 });
 const shopDays=(c?.daily||[]).map(d=>{
  const covered=!!eventsStart&&d.day>=eventsStart,v=x=>covered?num(x):null;
  return {day:d.day,partial:d.day===today,covered,opens:v(d.opens),visitors:v(d.visitors),ctas:v(d.ctas),checkouts:v(d.checkouts),
   cancels:v(d.cancels),errors:v(d.errors),purchases:num(d.purchases),blocksNew:v(d.blocksNew),blocksReplay:v(d.blocksReplay),shown:v(d.shown),blockedPlayers:v(d.blockedPlayers)};
 });
 const time=a?.time||{},premium=a?.premium||{},observed=premium.observed||{},subject=premium.subject||{};
 const funnel=(steps,base)=>steps.map((s,i)=>{const n=num(s.value),prev=i?num(steps[i-1].value):null;
  return {...s,value:n,ofInitial:pct(n,base),pass:i?pct(n,prev):null,drop:i&&prev?round1(100-pct(n,prev)):null}});
 const fb=c?.funnelBlocked||{},fs=c?.funnelShop||{},shop=c?.shop||{};
 return {available:!!a,conversionAvailable:!!c,simulationAvailable:!!simulation,today,dataStart,eventsStart,
  days,shopDays,settings:a?.settings||{},priceCents:num(a?.priceCents),premiumLaunch:a?.premiumLaunch||null,quotasOn:a?.quotasOn||null,internalPlayers:num(a?.internalPlayers),
  coverage:{completed:num(time.completed),timed:num(time.timed),rate:pct(time.timed,time.completed)},
  behaviour:a?.behaviour||null,
  premium:{free:num(premium.freePlayers),premiumPlayers:num(premium.premiumPlayers),pastThreshold:num(premium.freePastThreshold),
   subjectDays:num(subject.playerDays),subjectPlayers:num(subject.players),observed,
   reachNewRate:pct(observed.daysReachNew,subject.playerDays),reachReplayRate:pct(observed.daysReachReplay,subject.playerDays),
   reachAnyRate:pct(observed.daysReachAny,subject.playerDays),beforeAfter:premium.beforeAfter||{}},
  limits:c?.limits||{},shop:{...shop,opensPerVisitor:round1(ratio(shop.opens,shop.visitors)),conversion:pct(shop.purchases,shop.visitors)},
  funnelBlocked:funnel([{key:'active',labelKey:'stepActive',value:fb.active},{key:'blocked',labelKey:'stepBlocked',value:fb.blocked},
   {key:'shop',labelKey:'stepShopAfter',value:fb.shop},{key:'cta',labelKey:'stepCta',value:fb.cta},
   {key:'checkout',labelKey:'stepCheckout',value:fb.checkout},{key:'purchase',labelKey:'stepBought',value:fb.purchase}],fb.active),
  funnelShop:funnel([{key:'visitors',labelKey:'stepVisit',value:fs.visitors},{key:'cta',labelKey:'stepCta',value:fs.cta},
   {key:'checkout',labelKey:'stepCheckout',value:fs.checkout},{key:'purchase',labelKey:'stepConfirmed',value:fs.purchase}],fs.visitors),
  purchasesWithoutVisit:num(fs.purchasesWithoutVisit),attribution:c?.attribution||[],retention:c?.retention||null,
  simulation:simulation||null,windowDays:num(c?.windowDays)};
}

function tools(t=french,locale='fr'){
 const tr=(key,params)=>t(ACTIVITY_KEYS+key,params);
 const fmt=(value,suffix='')=>value===null||value===undefined?'—':(typeof value==='number'?value.toLocaleString(locale==='en'?'en-GB':locale):String(value))+suffix;
 const when=at=>{try{return new Date(at).toLocaleString(locale==='en'?'en-GB':locale,{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return String(at)}};
 return {tr,fmt,when,pctText:value=>fmt(value,' %')};
}

// ---- Charts: one value axis, thin bars, today dimmed, « non mesuré » apart. --------
export function barChart({id,title,rows,series,unit='',note='',t=french,locale='fr'}){
 const {tr,fmt}=tools(t,locale);
 const w=Math.max(rows.length*14,280),h=120,pad=18,max=Math.max(1,...rows.map(r=>series.reduce((s,k)=>s+(num(r[k.key])??0),0)));
 const bw=Math.max(3,Math.floor((w-pad)/Math.max(1,rows.length))-2);
 const bars=rows.map((r,i)=>{
  const x=pad+i*(bw+2);
  if(r.covered===false)return '<g class="act-unmeasured">'+svgRect({x,y:h-6,width:bw,height:2},'<title>'+esc(dayLabel(r.day)+' · '+tr('notMeasured'))+'</title>')+'</g>';
  let y=h;const parts=series.map(s=>{const v=num(r[s.key])??0,bh=Math.round((h-8)*v/max);y-=bh;
   return bh>0?svgRect({class:['act-'+s.tone,r.partial?'act-partial':''].join(' ').trim(),x,y,width:bw,height:bh,rx:2}):''}).join('');
  const tip=dayLabel(r.day)+(r.partial?' ('+tr('incomplete')+')':'')+' · '+series.map(s=>s.label+' '+fmt(r[s.key],unit)).join(' · ');
  return '<g class="act-bar" tabindex="0" aria-label="'+esc(tip)+'">'+svgRect({class:'act-hit',x,y:0,width:bw+2,height:h})+parts+'<title>'+esc(tip)+'</title></g>';
 }).join('');
 const legend=series.length>1?'<p class="act-legend">'+series.map(s=>'<span><i class="act-'+s.tone+'"></i>'+esc(s.label)+'</span>').join('')+'</p>':'';
 const head='<tr><th scope="col">'+esc(tr('day'))+'</th>'+series.map(s=>'<th scope="col">'+esc(s.label)+'</th>').join('')+'</tr>';
 const body=rows.map(r=>'<tr><th scope="row">'+esc(dayLabel(r.day)+(r.partial?' *':''))+'</th>'+series.map(s=>'<td>'+esc(r.covered===false?tr('notMeasured'):fmt(r[s.key],unit))+'</td>').join('')+'</tr>').join('');
 return '<figure class="act-chart" id="'+esc(id)+'"><figcaption><strong>'+esc(title)+'</strong><small>'+esc(tr('max',{value:fmt(round1(max),unit)}))+'</small></figcaption>'+legend
  +'<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none" role="img" aria-label="'+esc(title)+'"><line class="act-axis" x1="'+pad+'" x2="'+w+'" y1="'+h+'" y2="'+h+'"></line>'+bars+'</svg>'
  +'<p class="act-x"><span>'+esc(dayLabel(rows[0]?.day||''))+'</span><span>'+esc(dayLabel(rows.at(-1)?.day||'')+' *')+'</span></p>'
  +(note?'<p class="analytics-contract">'+esc(note)+'</p>':'')
  +'<details class="act-table"><summary>'+esc(tr('values'))+'</summary><div class="analytics-table-wrap"><table class="analytics-table"><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div></details></figure>';
}
function kpi(label,value,note=''){return '<div class="admin-kpi"><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span>'+(note?'<small>'+esc(note)+'</small>':'')+'</div>'}
function contract(text){return '<p class="analytics-contract">'+esc(text)+'</p>'}
export function funnelView(title,steps,{note='',t=french,locale='fr'}={}){
 const {tr,fmt,pctText}=tools(t,locale),base=steps[0]?.value||0;
 return '<figure class="act-funnel"><figcaption><strong>'+esc(title)+'</strong></figcaption><ol>'+steps.map((s,i)=>{
  const width=base?Math.max(2,Math.round(100*(s.value||0)/base)):0;
  return '<li><div class="act-funnel-row"><span class="act-funnel-label">'+esc((i+1)+'. '+tr(s.labelKey))+'</span><strong>'+esc(fmt(s.value))+'</strong></div>'
   +'<div class="act-funnel-track"><i style="width:'+width+'%"></i></div>'
   +'<small>'+esc(tr('ofStepOne',{pct:pctText(s.ofInitial)})+(i?tr('passDrop',{pass:pctText(s.pass),drop:pctText(s.drop)}):''))+'</small></li>'}).join('')
  +'</ol>'+(note?contract(note):'')+'</figure>';
}
const ORIGIN_KEYS={locked_adventure:'originLocked',quota_new:'originQuotaNew',quota_replay:'originQuotaReplay',voluntary:'originVoluntary',premium_feature:'originFeature',other:'originOther',unattributed:'originNone'};
const SEGMENT_KEYS={all:'segAll',free:'segFree',premium:'segPremium'},CHANNEL_KEYS={all:'segAll',web:'chWeb',play:'chPlay'};

function filters(f,tr){
 const sel=(name,label,options,value)=>'<label>'+esc(label)+' <select data-activity-filter="'+name+'">'+Object.entries(options).map(([k,v])=>'<option value="'+esc(k)+'"'+(String(value)===k?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
 const map=keys=>Object.fromEntries(Object.entries(keys).map(([k,v])=>[k,tr(v)]));
 return '<form class="act-filters" data-activity-filters>'+sel('days',tr('period'),{7:tr('days',{count:7}),30:tr('days',{count:30}),90:tr('days',{count:90})},f.days)
  +sel('segment',tr('players'),map(SEGMENT_KEYS),f.segment)+sel('channel',tr('channel'),map(CHANNEL_KEYS),f.channel)+sel('windowDays',tr('attribution'),{0:tr('sameDay'),7:tr('sevenDays')},f.windowDays)
  +'<label class="act-check"><input type="checkbox" data-activity-filter="includeInternal"'+(f.includeInternal?' checked':'')+'> '+esc(tr('includeInternal'))+'</label></form>';
}

export function renderActivityCockpit(host,{activity,conversion,simulation,filters:f=ACTIVITY_DEFAULTS,status='',onFilter=()=>{},t=french,locale='fr'}={}){
 if(!host)return;
 const {tr,fmt,when,pctText}=tools(t,locale);
 const m=buildActivityModel(activity,conversion,simulation);
 const internal=f.includeInternal?tr('internalIncluded'):m.internalPlayers?tr('internalExcludedCount',{count:m.internalPlayers}):tr('internalExcluded');
 const head=filters(f,tr)+'<p class="act-scope" role="status">'+esc(status||(m.available?tr('scope',{segment:tr(SEGMENT_KEYS[f.segment]||'segAll'),internal}):''))+'</p>';
 if(!m.available){host.innerHTML=head+'<p class="analytics-unavailable" role="status">'+esc(tr('unavailable'))+'</p>';bind(host,f,onFilter);return}
 const chart=(id,title,rows,series,unit='')=>barChart({id,title:tr(title),rows,series:series.map(s=>({...s,label:tr(s.labelKey)})),unit,t,locale});
 const section=(title,body)=>'<details class="analytics-block act-section" open><summary><h3>'+esc(tr(title))+'</h3></summary>'+body+'</details>';
 const table=(heads,rows)=>'<div class="analytics-table-wrap"><table class="analytics-table"><thead><tr>'+heads.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'
  +rows.map(r=>'<tr'+(r.current?' class="act-current"':'')+'><th scope="row">'+esc(r.cells[0])+'</th>'+r.cells.slice(1).map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const s=m.settings,newLimit=num(s.quota_new_daily),replayLimit=num(s.quota_replay_daily),threshold=num(s.quota_threshold_constellation);
 const activityBlock=section('activityTitle','<div class="act-grid">'
  +chart('actPlayers','chartPlayers',m.days,[{key:'players',labelKey:'players',tone:'a'}])
  +chart('actStarted','chartStarted',m.days,[{key:'startedNew',labelKey:'new',tone:'a'},{key:'startedReplay',labelKey:'replays',tone:'b'}])
  +chart('actCompleted','chartCompleted',m.days,[{key:'completedNew',labelKey:'new',tone:'a'},{key:'completedReplay',labelKey:'replays',tone:'b'}])
  +chart('actAvgStarted','chartAvgStarted',m.days,[{key:'avgStarted',labelKey:'mean',tone:'a'}])
  +chart('actAvgCompleted','chartAvgCompleted',m.days,[{key:'avgCompleted',labelKey:'mean',tone:'a'}])
  +'</div>'+contract(tr('activityDefinition')+' '+tr('scopeNote',{start:m.dataStart||'—'})));
 const b=m.behaviour||{},dist=(b.distribution||[]).filter(x=>x.bucket!=='0'),zero=(b.distribution||[]).find(x=>x.bucket==='0');
 const total=dist.reduce((sum,x)=>sum+(x.count||0),0)||1;
 const timeBlock=section('timeTitle','<div class="act-grid">'
  +chart('actMinutes','chartMinutes',m.days,[{key:'minutes',labelKey:'minutes',tone:'a'}],tr('minUnit'))
  +chart('actAvgMinutes','chartAvgMinutes',m.days,[{key:'avgMinutes',labelKey:'mean',tone:'a'}],tr('minUnit'))
  +'</div>'+contract(tr('timeDefinition',{timed:fmt(m.coverage.timed),completed:fmt(m.coverage.completed),rate:pctText(m.coverage.rate)}))
  +'<h4>'+esc(tr('behaviourTitle'))+'</h4><div class="admin-kpis">'+kpi(tr('mean'),fmt(b.mean))+kpi(tr('median'),fmt(b.median))+kpi('P75',fmt(b.p75))+kpi('P90',fmt(b.p90))+kpi('P95',fmt(b.p95))
  +kpi(tr('meanNew'),fmt(b.meanNew))+kpi(tr('meanReplay'),fmt(b.meanReplay))+kpi(tr('playerDays'),fmt(b.playerDays),tr('playersCount',{count:fmt(b.players)}))+'</div>'
  +'<figure class="act-dist"><figcaption><strong>'+esc(tr('distTitle'))+'</strong></figcaption>'
  +dist.map(x=>{const [from,to]=String(x.bucket).split('-');return '<div class="act-dist-row"><span>'+esc(x.bucket==='31+'?tr('bucketOver'):tr('bucketRange',{from,to}))+'</span><span class="act-funnel-track"><i style="width:'+Math.round(100*(x.count||0)/total)+'%"></i></span><strong>'+esc(fmt(x.count))+'</strong></div>'}).join('')
  +'</figure>'+contract(tr('distNote',{count:fmt(zero?.count)})));
 const o=m.premium.observed||{},l=m.limits||{},ba=m.premium.beforeAfter||{},sim=m.simulation?.simulation||[];
 const quotaBlock=section('quotaTitle',
  '<p class="act-settings">'+esc(tr('settings',{state:tr(s.quotas_enabled===true?'quotasOn':'quotasOff'),newLimit:fmt(newLimit),replayLimit:fmt(replayLimit),threshold:fmt(threshold),
   since:m.quotasOn?tr('activeSince',{date:when(m.quotasOn)}):'',price:m.priceCents!==null?fmt(m.priceCents/100)+' €':'—'}))+'</p>'
  +'<div class="admin-kpis">'+kpi(tr('freeActive'),fmt(m.premium.free))+kpi(tr('premiumActive'),fmt(m.premium.premiumPlayers))+kpi(tr('pastThreshold'),fmt(m.premium.pastThreshold))
  +kpi(tr('subjectDays'),fmt(m.premium.subjectDays),tr('playersCount',{count:fmt(m.premium.subjectPlayers)}))+'</div>'
  +table([tr('situation'),tr('newQuests'),tr('replays')],[
   {cells:[tr('reached'),fmt(o.daysReachNew)+' · '+pctText(m.premium.reachNewRate),fmt(o.daysReachReplay)+' · '+pctText(m.premium.reachReplayRate)]},
   {cells:[tr('distinct'),fmt(o.playersReachNew),fmt(o.playersReachReplay)]},
   {cells:[tr('blocked'),fmt(l.blocksNew),fmt(l.blocksReplay)]},
   {cells:[tr('distinct'),fmt(l.blockedPlayersNew),fmt(l.blockedPlayersReplay)]},
   {cells:[tr('shown'),fmt(l.shownNew),fmt(l.shownReplay)]}])
  +contract(tr('limitsDefinition',{any:fmt(o.daysReachAny),anyRate:pctText(m.premium.reachAnyRate),blockedDays:fmt(l.blockedPlayerDays),start:m.eventsStart||'—'}))
  +chart('actLimits','chartLimits',m.days.map((d,i)=>({...d,blocks:(m.shopDays[i]?.blocksNew??0)+(m.shopDays[i]?.blocksReplay??0),covered:d.newLimit!==null})),
    [{key:'reachNew',labelKey:'reachedNewShort',tone:'a'},{key:'blocks',labelKey:'blockedShort',tone:'b'}])
  +'<h4>'+esc(tr('simTitle',{replay:fmt(replayLimit)}))+'</h4>'
  +(sim.length?table([tr('quota'),tr('simReachNew'),tr('simReachAny'),tr('simPlayers'),tr('simBeyond')],sim.map(x=>{const current=num(x.newQuota)===newLimit;
    return {current,cells:[fmt(num(x.newQuota))+(current?tr('inForce'):''),pctText(num(x.pctDaysReachNew)),pctText(num(x.pctDaysReachAny)),fmt(num(x.players)-num(x.playersNeverReaching))+' / '+fmt(num(x.players)),pctText(num(x.pctAttemptsBeyond))]}}))
   :'<p>'+esc(tr('simUnavailable'))+'</p>')
  +contract(tr('simNote',{userDays:fmt(num(m.simulation?.coverage?.userDays)),since:m.quotasOn?when(m.quotasOn):'—'}))
  +(ba.before||ba.after?'<h4>'+esc(tr('sinceLaunch',{date:m.premiumLaunch?when(m.premiumLaunch):'—'}))+'</h4>'
   +table([tr('periodCol'),tr('playerDays'),tr('quests'),tr('new'),tr('replays'),tr('minutes')],['before','after'].filter(k=>ba[k]).map(k=>({cells:[tr(k),fmt(num(ba[k].playerDays)),fmt(num(ba[k].meanStarted)),fmt(num(ba[k].meanNew)),fmt(num(ba[k].meanReplay)),fmt(num(ba[k].meanMinutes))]})))
   +contract(tr('beforeAfterNote')):''));
 const sh=m.shop||{},ret=m.retention||{},origins=Object.entries(sh.origins||{}),attrib=m.attribution||[];
 const windowLabel=tr(m.windowDays===0?'sameDay':'sevenDays');
 const rr=(label,k)=>({cells:[tr(label),fmt(num(ret.blocked?.[k])),fmt(num(ret.reference?.[k]))]});
 const convBlock=section('convTitle',m.conversionAvailable?(
  '<div class="admin-kpis">'+kpi(tr('opens'),fmt(num(sh.opens)))+kpi(tr('visitors'),fmt(num(sh.visitors)))+kpi(tr('opensPerVisitor'),fmt(sh.opensPerVisitor))
  +kpi(tr('ctas'),fmt(num(sh.ctas)),tr('playersCount',{count:fmt(num(sh.ctaPlayers))}))+kpi(tr('checkouts'),fmt(num(sh.checkouts)),tr('playersCount',{count:fmt(num(sh.checkoutPlayers))}))
  +kpi(tr('cancelErrors'),fmt(num(sh.cancels))+' / '+fmt(num(sh.errors)))+kpi(tr('purchases'),fmt(num(sh.purchases)))+kpi(tr('shopConversion'),pctText(sh.conversion),tr('buyersOverVisitors'))+'</div>'
  +'<div class="act-grid">'+chart('actShop','chartShop',m.shopDays,[{key:'opens',labelKey:'openings',tone:'a'}])
  +chart('actShopSteps','chartShopSteps',m.shopDays,[{key:'ctas',labelKey:'taps',tone:'a'},{key:'purchases',labelKey:'buys',tone:'b'}])+'</div>'
  +(origins.length?table([tr('origin'),tr('openings'),tr('visitors')],origins.map(([k,v])=>({cells:[ORIGIN_KEYS[k]?tr(ORIGIN_KEYS[k]):k,fmt(num(v.opens)),fmt(num(v.visitors))]}))):'<p>'+esc(tr('noOpening'))+'</p>')
  +contract(tr('shopDefinition',{expired:fmt(num(sh.stripeSessions?.expired)),complete:fmt(num(sh.stripeSessions?.complete)),median:fmt(num(sh.closeMedianSeconds),tr('secondsUnit')),start:m.eventsStart||'—'}))
  +'<div class="act-grid">'+funnelView(tr('funnelBlocked'),m.funnelBlocked,{note:tr('funnelBlockedNote',{window:windowLabel}),t,locale})
  +funnelView(tr('funnelShop'),m.funnelShop,{note:tr('funnelShopNote',{count:fmt(m.purchasesWithoutVisit)}),t,locale})+'</div>'
  +'<h4>'+esc(tr('attributionTitle',{window:windowLabel}))+'</h4>'
  +(attrib.length?table([tr('lastVisitOrigin'),tr('channel'),tr('buys')],attrib.map(x=>({cells:[ORIGIN_KEYS[x.origin]?tr(ORIGIN_KEYS[x.origin]):x.origin,CHANNEL_KEYS[x.channel]?tr(CHANNEL_KEYS[x.channel]):x.channel,fmt(num(x.purchases))]}))):'<p>'+esc(tr('noPurchase'))+'</p>')
  +contract(tr('attributionNote'))
  +'<h4>'+esc(tr('retentionTitle'))+'</h4>'
  +table([tr('indicator'),tr('blockedDays'),tr('reference')],[rr('playerDays','playerDays'),rr('players','players'),rr('rJ1','j1'),rr('rJ7Eligible','j7Eligible'),rr('rJ7','j7'),
   rr('rSameDay','sameDayQuests'),rr('rPrev','prevQuests'),rr('rNext','nextQuests'),rr('rNextMinutes','nextMinutes'),rr('rConversion','conversion7'),rr('rAge','ageDays'),rr('rProgression','progression')])
  +contract(tr('retentionNote'))
 ):'<p class="analytics-unavailable" role="status">'+esc(tr('convUnavailable'))+'</p>');
 host.innerHTML=head+activityBlock+timeBlock+quotaBlock+convBlock;
 bind(host,f,onFilter);
}
function bind(host,f,onFilter){
 host.querySelector('[data-activity-filters]')?.addEventListener('change',event=>{
  const target=event.target,name=target?.dataset?.activityFilter;if(!name)return;
  onFilter({...f,[name]:target.type==='checkbox'?target.checked:['days','windowDays'].includes(name)?Number(target.value):target.value});
 });
}
