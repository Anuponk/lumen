// Pure classification only: never use this as an authorization decision.
// Keep server secrets, delivery and webhook signature verification separate.
export const AUTH_EMAIL_BRANDS=Object.freeze({
 lumen:Object.freeze({name:"Lumen",hosts:["lumen.nopuna.fr"]}),
 soldezen:Object.freeze({name:"SoldeZen",hosts:["soldezen.fr","www.soldezen.fr"]})
});
export function resolveAuthEmailBrand(redirectTo){
 if(typeof redirectTo!=="string"||!redirectTo)return {brand:null,reason:"missing_redirect"};
 let url;
 try{url=new URL(redirectTo)}catch{return {brand:null,reason:"invalid_url"}}
 if(url.protocol!=="https:"||url.username||url.password||url.port||url.hostname.endsWith(".")||url.origin==="null")
  return {brand:null,reason:"unsafe_redirect"};
 const matches=Object.entries(AUTH_EMAIL_BRANDS).filter(([,config])=>config.hosts.includes(url.hostname.toLowerCase()));
 if(matches.length!==1)return {brand:null,reason:"unrecognized_origin"};
 return {brand:matches[0][0],reason:null};
}
