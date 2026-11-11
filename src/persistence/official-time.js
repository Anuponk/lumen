// Positive capability is scoped to the actual client/session connection.
// Old servers and offline starts retain their immutable eight-field commands.
const supported=new WeakSet();
const cacheKey=client=>typeof client?.supabaseUrl==='string'?'lumenOfficialTimeCapabilityV1:'+client.supabaseUrl:null;
export function officialTimingSupported(client,{storage=globalThis.localStorage}={}){
 if(!client)return false;if(supported.has(client))return true;
 try{const key=cacheKey(client);return !!key&&storage?.getItem(key)==='1'}catch{return false}
}
export async function refreshOfficialTimingSupport(client,{storage=globalThis.localStorage}={}){
 if(!client)return false;
 try{const result=await client.rpc('lumen_official_time_version'),key=cacheKey(client);
  if(!result.error&&result.data===1){supported.add(client);if(key)storage?.setItem(key,'1')}
  else if(!result.error&&result.data===0||result.error?.code==='PGRST202'&&result.status===404){supported.delete(client);if(key)storage?.removeItem(key)}
 }catch{}
 return officialTimingSupported(client,{storage});
}
