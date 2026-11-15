// #748: QR code of the presentation page, generated with the vendored encoder
// (src/vendor/qrcode-1.0.0.js) so the page stays static and script-free.
//   node scripts/landing-qr.mjs          writes src/landing/install-qr.svg
//   node scripts/landing-qr.mjs --check  fails if the committed file differs
import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';

export const INSTALL_URL='https://lumen.nopuna.fr/?install=1';
export const QR_FILE='src/landing/install-qr.svg';

// Encode with the real library; its drawing layer is satisfied by an inert SVG document.
export function qrMatrix(text){
 const element=()=>({setAttribute(){},setAttributeNS(){},appendChild(){},removeChild(){},hasChildNodes:()=>false});
 const document={documentElement:{tagName:'svg'},createElementNS:element,createElement:element};
 const sandbox={document,navigator:{userAgent:'node'},window:{}};sandbox.window=sandbox;
 vm.runInNewContext(fs.readFileSync('src/vendor/qrcode-1.0.0.js','utf8'),sandbox);
 const qr=new sandbox.QRCode(element(),{text,width:256,height:256,correctLevel:sandbox.QRCode.CorrectLevel.M});
 const model=qr._oQRCode,n=model.getModuleCount();
 return Array.from({length:n},(_,row)=>Array.from({length:n},(_,col)=>model.isDark(row,col)));
}

export function qrSvg(text){
 const m=qrMatrix(text),n=m.length,quiet=4,size=n+quiet*2;let d='';
 m.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)d+=`M${x+quiet} ${y+quiet}h1v1h-1z`}));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code : ${text}">`+
  `<rect width="${size}" height="${size}" fill="#ffffff"/><path fill="#07111d" d="${d}"/></svg>\n`;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const svg=qrSvg(INSTALL_URL);
 if(process.argv.includes('--check')){
  if(fs.readFileSync(QR_FILE,'utf8').replace(/\r\n/g,'\n')!==svg){console.error(QR_FILE+' is stale: run node scripts/landing-qr.mjs');process.exit(1)}
  console.log('landing-qr: '+QR_FILE+' encodes '+INSTALL_URL);
 }else{fs.writeFileSync(QR_FILE,svg);console.log('Wrote '+QR_FILE)}
}
