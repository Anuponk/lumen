// #708 Lot C · Analytics › Acquisition & engagement. Presentation of
// lumen_admin_engagement (aggregates only). Rules: a missing source is
// « indisponible », never 0; acquisition while public collection is disabled is
// a partial sample, never a measurement; retention by channel is not measurable.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
// null/undefined/'' are missing data, never 0 (Number(null) would be 0).
const num=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Math.max(0,Math.round(Number(value)));

export function engagementRate(numerator,denominator){
 const n=num(numerator),d=num(denominator);
 if(n===null||d===null||d===0)return null;
 return Math.round(n/d*100);
}

// Pure model: every figure carries its definition, source, denominator and sample.
export function buildEngagementModel(data,{collectionEnabled=false}={}){
 if(!data||typeof data!=='object')return {available:false};
 const traffic=data.traffic||{},ch=data.challenges||{},daily=data.daily||null;
 const channels=(Array.isArray(data.acquisition)?data.acquisition:[]).map(row=>({
  channel:String(row.channel||''),opened:num(row.opened),started:num(row.q1_started),completed:num(row.q1_completed),
  activation:engagementRate(row.q1_completed,row.opened)}));
 return {available:true,days:num(data.days),collectionEnabled:!!collectionEnabled,
  traffic:{identifiers:num(traffic.identifiers),human:num(traffic.human),qa:num(traffic.qa),automated:num(traffic.automated_test),undetermined:num(traffic.undetermined)},
  channels,
  challenges:{created:num(ch.created),senders:num(ch.senders),sentToFriends:num(ch.sent_to_friends),accepted:num(ch.accepted),
   completed:num(ch.completed),abandoned:num(ch.abandoned),inProgress:num(ch.in_progress),guests:num(ch.guest_participations),
   completionRate:engagementRate(ch.completed,ch.accepted)},
  daily:daily?{flagEnabled:daily.flag_enabled===true,players:num(daily.players),days:num(daily.days),runs:num(daily.runs),
   completed:num(daily.completed),abandoned:num(daily.abandoned),inProgress:num(daily.in_progress),completionRate:engagementRate(daily.completed,daily.runs)}:null,
  retentionByChannel:data.retention_by_channel?.measurable===true};
}

function card(label,value,{t,note=''}={}){
 return '<div class="admin-kpi"><strong>'+(value===null||value===undefined?esc(t('admin.engagement.unavailableShort')):esc(value))+'</strong><span>'+esc(label)+'</span>'+(note?'<small>'+esc(note)+'</small>':'')+'</div>';
}
function contract(t,{definition,source,denominator,days}){
 return '<p class="analytics-contract"><b>'+esc(t('admin.engagement.definition'))+'</b> '+esc(definition)+' · <b>'+esc(t('admin.engagement.source'))+'</b> '+esc(source)
  +(denominator?' · <b>'+esc(t('admin.engagement.denominator'))+'</b> '+esc(denominator):'')+' · <b>'+esc(t('admin.engagement.period'))+'</b> '+esc(t('admin.engagement.days',{count:days??0}))+'</p>';
}
const pct=(rate,t)=>rate===null?t('admin.engagement.notComputable'):rate+' %';

export function renderAnalyticsEngagement(host,data,{collectionEnabled=false,t}={}){
 if(!host)return;
 const m=buildEngagementModel(data,{collectionEnabled});
 if(!m.available){host.innerHTML='<p class="analytics-unavailable" role="status">'+esc(t('admin.engagement.sourceUnavailable'))+'</p>';return}
 const days=m.days;
 const traffic='<section class="analytics-block" aria-labelledby="engTraffic"><h3 id="engTraffic">'+esc(t('admin.engagement.trafficTitle'))+'</h3>'
  +'<div class="admin-kpis">'+card(t('admin.engagement.human'),m.traffic.human,{t})+card(t('admin.engagement.qa'),m.traffic.qa,{t})
  +card(t('admin.engagement.automated'),m.traffic.automated,{t})+card(t('admin.engagement.undetermined'),m.traffic.undetermined,{t})+'</div>'
  +contract(t,{definition:t('admin.engagement.trafficDefinition'),source:t('admin.engagement.sourceEvents'),denominator:t('admin.engagement.identifiers',{count:m.traffic.identifiers??0}),days})
  +(m.collectionEnabled?'':'<p class="analytics-warning">'+esc(t('admin.engagement.collectionDisabled'))+'</p>')+'</section>';
 const rows=m.channels.map(c=>'<tr><th scope="row">'+esc(c.channel)+'</th><td>'+esc(c.opened)+'</td><td>'+esc(c.started)+'</td><td>'+esc(c.completed)+'</td><td>'+esc(pct(c.activation,t))+(c.opened!==null?' <small>(n='+esc(c.opened)+')</small>':'')+'</td></tr>').join('');
 const acquisition='<section class="analytics-block" aria-labelledby="engAcq"><h3 id="engAcq">'+esc(t('admin.engagement.acquisitionTitle'))+'</h3>'
  +(m.collectionEnabled?'':'<p class="analytics-warning" role="status"><b>'+esc(t('admin.engagement.notMeasurable'))+'</b> '+esc(t('admin.engagement.acquisitionPartial'))+'</p>')
  +(rows?'<div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th scope="col">'+esc(t('admin.engagement.channel'))+'</th><th scope="col">'+esc(t('admin.engagement.opened'))+'</th><th scope="col">'+esc(t('admin.engagement.q1Started'))+'</th><th scope="col">'+esc(t('admin.engagement.q1Completed'))+'</th><th scope="col">'+esc(t('admin.engagement.activation'))+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
   :'<p>'+esc(t('admin.engagement.noOpening'))+'</p>')
  +contract(t,{definition:t('admin.engagement.acquisitionDefinition'),source:t('admin.engagement.sourceEvents'),denominator:t('admin.engagement.acquisitionDenominator'),days})+'</section>';
 const c=m.challenges;
 const challenges='<section class="analytics-block" aria-labelledby="engCh"><h3 id="engCh">'+esc(t('admin.engagement.challengesTitle'))+'</h3><div class="admin-kpis">'
  +card(t('admin.engagement.created'),c.created,{t,note:t('admin.engagement.senders',{count:c.senders??0})})+card(t('admin.engagement.sentToFriends'),c.sentToFriends,{t})
  +card(t('admin.engagement.accepted'),c.accepted,{t,note:t('admin.engagement.guests',{count:c.guests??0})})
  +card(t('admin.engagement.completed'),c.completed,{t,note:pct(c.completionRate,t)})+card(t('admin.engagement.abandoned'),c.abandoned,{t})+card(t('admin.engagement.inProgress'),c.inProgress,{t})+'</div>'
  +contract(t,{definition:t('admin.engagement.challengesDefinition'),source:t('admin.engagement.sourceServer'),denominator:t('admin.engagement.challengesDenominator'),days})+'</section>';
 const d=m.daily;
 const daily='<section class="analytics-block" aria-labelledby="engDaily"><h3 id="engDaily">'+esc(t('admin.engagement.dailyTitle'))+'</h3>'
  +(d?'<p>'+esc(d.flagEnabled?t('admin.engagement.dailyPublic'):t('admin.engagement.dailyHidden'))+'</p><div class="admin-kpis">'
   +card(t('admin.engagement.dailyPlayers'),d.players,{t})+card(t('admin.engagement.dailyDays'),d.days,{t})+card(t('admin.engagement.dailyRuns'),d.runs,{t})
   +card(t('admin.engagement.completed'),d.completed,{t,note:pct(d.completionRate,t)})+card(t('admin.engagement.abandoned'),d.abandoned,{t})+'</div>'
   +contract(t,{definition:t('admin.engagement.dailyDefinition'),source:t('admin.engagement.sourceServer'),denominator:t('admin.engagement.dailyDenominator'),days})
   :'<p>'+esc(t('admin.engagement.dailyUnavailable'))+'</p>')+'</section>';
 const retention='<section class="analytics-block" aria-labelledby="engRet"><h3 id="engRet">'+esc(t('admin.engagement.retentionTitle'))+'</h3>'
  +'<p class="analytics-warning"><b>'+esc(t('admin.engagement.notMeasurable'))+'</b> '+esc(t('admin.engagement.retentionReason'))+'</p></section>';
 host.innerHTML=traffic+acquisition+challenges+daily+retention;
}
