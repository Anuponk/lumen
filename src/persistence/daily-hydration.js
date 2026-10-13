// Merge server-authoritative daily history into a verified full cloud profile.
// Keep server reward ledger separate from spendable balance: never mint shards during hydration.
export function reconcileDailyIntoCloudProfile(profile,rows=[],engagement=[]){
 const updated=structuredClone(profile);
 updated.daily=updated.daily&&typeof updated.daily==='object'?updated.daily:{};
 updated.daily.dates=updated.daily.dates&&typeof updated.daily.dates==='object'?updated.daily.dates:{};
 updated.daily.rewards=updated.daily.rewards&&typeof updated.daily.rewards==='object'?updated.daily.rewards:{};
 let changed=false;
 for(const row of rows||[]){
  const key=String(row?.play_date??'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key))continue;
  if(!updated.daily.dates[key]){updated.daily.dates[key]=1;changed=true}
 }
 const rewarded=engagement?.[0]?.rewarded_days||{};
 for(const [date,amount] of Object.entries(rewarded)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  const value=Math.max(0,Number(amount)||0),key='streak:'+date;
  if(value&&!updated.daily.rewards[key]){updated.daily.rewards[key]=value;changed=true}
 }
 return {profile:updated,changed};
}
