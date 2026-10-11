import assert from "node:assert/strict";
import {resolveAuthEmailBrand} from "../src/auth/email-brand-routing.js";
for(const url of ["https://lumen.nopuna.fr/","https://lumen.nopuna.fr/?next=123"]){
 assert.equal(resolveAuthEmailBrand(url).brand,"lumen");
}
for(const url of ["https://soldezen.fr/","https://www.soldezen.fr/auth/callback"]){
 assert.equal(resolveAuthEmailBrand(url).brand,"soldezen");
}
for(const url of ["","https://evil.com/","https://lumen.nopuna.fr.evil.com/","https://evil.com/?brand=lumen","http://lumen.nopuna.fr/","https://user:pass@lumen.nopuna.fr/","https://lumen.nopuna.fr:444/","https://lumen.nopuna.fr./","not a url"]){
 assert.equal(resolveAuthEmailBrand(url).brand,null,url);
}
assert.equal(resolveAuthEmailBrand("https://soldezen.fr/?brand=lumen").brand,"soldezen");
console.log("Auth email brand classification regression passed");
