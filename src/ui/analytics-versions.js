// #708 Lot D · Release comparison (Synchronisation & incidents). Failure rates
// per version always come with their exposure (hydrations); a small sample is
// labelled, never ranked; an unknown version stays « inconnue ».
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const num=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Math.max(0,Math.round(Number(value)));
export const MIN_VERSION_SAMPLE=20;

export function versionRate(failures,hydrations){
 const f=num(failures),h=num(hydrations);
 return f===null||h===null||h===0?null:Math.round(f/h*1000)/10;
}
// Pure model: « examine » only with a sufficient sample AND a clear gap.
export function buildVersionModel(data){
 if(!data||typeof data!=='object')return {available:false};
 const overall=versionRate(data.totals?.failures,data.totals?.hydrations);
 const rows=(Array.isArray(data.versions)?data.versions:[]).map(v=>{
  const hydrations=num(v.hydrations),rate=versionRate(v.failures,v.hydrations);
  const small=hydrations===null||hydrations<MIN_VERSION_SAMPLE;
  const examine=!small&&rate!==null&&overall!==null&&rate>=Math.max(overall*2,overall+5);
  return {version:String(v.version||'unknown'),hydrations,failures:num(v.failures),blocked:num(v.blocked),players:num(v.players),
   devices:num(v.devices),waiting:num(v.waiting_devices),rate,small,examine,lastSeen:v.last_seen||null};
 });
 return {available:true,days:num(data.days),overall,overallSample:num(data.totals?.hydrations),rows};
}

export function renderVersionHealth(host,data,{t}={}){
 if(!host)return;
 const m=buildVersionModel(data);
 if(!m.available){host.innerHTML='<p class="analytics-unavailable" role="status">'+esc(t('admin.versions.unavailable'))+'</p>';return}
 const label=v=>v==='unknown'?t('admin.versions.unknown'):v;
 const status=r=>r.small?t('admin.versions.small'):r.examine?t('admin.versions.examine'):t('admin.versions.normal');
 const body=m.rows.map(r=>'<tr'+(r.examine?' class="analytics-row-alert"':'')+'><th scope="row">'+esc(label(r.version))+'</th><td>'+esc(r.players??'—')+'</td><td>'+esc(r.hydrations??'—')+'</td><td>'+esc(r.failures??'—')+'</td><td>'
  +esc(r.rate===null?t('admin.engagement.notComputable'):r.rate+' %')+'</td><td>'+esc(r.blocked??'—')+'</td><td>'+esc(r.waiting??'—')+(r.devices?' / '+esc(r.devices):'')+'</td><td>'+esc(status(r))+'</td></tr>').join('');
 host.innerHTML='<section class="analytics-block" aria-labelledby="versionsTitle"><h3 id="versionsTitle">'+esc(t('admin.versions.title'))+'</h3>'
  +'<p>'+esc(m.overall===null?t('admin.versions.noOverall'):t('admin.versions.overall',{rate:m.overall,count:m.overallSample??0}))+'</p>'
  +(body?'<div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th scope="col">'+esc(t('admin.versions.version'))+'</th><th scope="col">'+esc(t('admin.versions.players'))+'</th><th scope="col">'+esc(t('admin.versions.hydrations'))+'</th><th scope="col">'+esc(t('admin.versions.failures'))+'</th><th scope="col">'+esc(t('admin.versions.rate'))+'</th><th scope="col">'+esc(t('admin.versions.blocked'))+'</th><th scope="col">'+esc(t('admin.versions.waiting'))+'</th><th scope="col">'+esc(t('admin.versions.status'))+'</th></tr></thead><tbody>'+body+'</tbody></table></div>'
   :'<p>'+esc(t('admin.versions.none'))+'</p>')
  +'<p class="analytics-contract"><b>'+esc(t('admin.engagement.definition'))+'</b> '+esc(t('admin.versions.definition',{count:MIN_VERSION_SAMPLE}))+' · <b>'+esc(t('admin.engagement.source'))+'</b> '+esc(t('admin.versions.source'))
  +' · <b>'+esc(t('admin.engagement.period'))+'</b> '+esc(t('admin.engagement.days',{count:m.days??0}))+'</p></section>';
}
