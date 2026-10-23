export const MAX_PROFILE_BYTES=524288;
const encoder=new TextEncoder();
// JSONB text adds a space after each structural comma/colon. Punctuation inside
// strings must not count as structure, including escaped quotes/backslashes.
export function profileStorageBytes(json){
 let separators=0,inString=false,escaped=false;
 for(const char of json){
  if(inString){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')inString=false;}
  else if(char==='"')inString=true;
  else if(char===','||char===':')separators++;
 }
 let numberExpansion=0;
 // PostgreSQL numeric expands scientific notation in JSONB text. Skip quoted
 // tokens entirely so strings containing an exponent do not consume reserve.
 const tokens=/"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?[eE][+-]?\d+)/g;
 for(const match of json.matchAll(tokens)){
  if(!match[1])continue;
  const token=match[1],negative=token.startsWith('-')?1:0;
  const [coefficient,exponent]=token.slice(negative).toLowerCase().split('e');
  const digits=coefficient.replace('.','').length,point=(coefficient.indexOf('.')<0?coefficient.length:coefficient.indexOf('.'))+Number(exponent);
  const expanded=negative+(point<=0?2-point+digits:point>=digits?point:digits+1);
  numberExpansion+=Math.max(0,expanded-token.length);
 }
 return encoder.encode(json).byteLength+separators+numberExpansion;
}
