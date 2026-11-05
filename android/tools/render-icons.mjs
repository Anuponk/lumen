// Render the approved repository SVG, never a separately drawn raster logo.
// Start an isolated Chromium CDP session and set LUMEN_CDP_URL before running.
import fs from 'node:fs';
import {connectBrowser} from '../../scripts/cdp-client.mjs';
const repo=new URL('../../',import.meta.url);
const res=new URL('app/src/main/res/',new URL('../',import.meta.url));
const svg=fs.readFileSync(new URL('icon-maskable.svg',repo),'utf8');
const paths=[...svg.matchAll(/<path d="([^"]+)" fill="([^"]+)"\/>/g)]
 .filter(([, ,fill])=>fill!=='url(#cloud)')
 .map(([,d,fill])=>({d,fill:fill==='url(#gold)'?'#ffd77a':fill}));
if(paths.length!==5||paths.some(p=>!/^#[a-f0-9]{6}$/i.test(p.fill)))throw Error('Review changed SVG geometry before generating Android assets');
const header='<?xml version="1.0" encoding="utf-8"?>\n<!-- Geometry from repository icon-maskable.svg (#625). -->\n';
const vector=monochrome=>header+'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512">\n'+
 paths.filter((_,i)=>!monochrome||i<3).map(p=>`    <path android:fillColor="${monochrome?'#ffffff':p.fill}" android:pathData="${p.d}" />`).join('\n')+'\n</vector>\n';
fs.writeFileSync(new URL('drawable/ic_foreground.xml',res),vector(false));
fs.writeFileSync(new URL('drawable/ic_monochrome.xml',res),vector(true));
fs.writeFileSync(new URL('values/colors.xml',res),header+'<resources><color name="night">#081333</color></resources>\n');
const browser=await connectBrowser();
try{
 await browser.send('Page.enable');await browser.send('Runtime.enable');
 await browser.send('Emulation.setDefaultBackgroundColorOverride',{color:{r:0,g:0,b:0,a:0}});
 await browser.send('Page.navigate',{url:'data:text/html;base64,'+Buffer.from('<!doctype html><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>'+svg).toString('base64')});
 for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192],['splash',512]]){
  await browser.send('Emulation.setDeviceMetricsOverride',{width:size,height:size,deviceScaleFactor:1,mobile:false});
  // Legacy launchers need transparent rounded corners; adaptive icons own their
  // mask and the TWA splash stays opaque. Do not suppress IconLauncherShape lint.
  await browser.evaluate(`document.querySelector('svg').style.borderRadius=${JSON.stringify(density==='splash'?'0':'21.1%')}`);
  await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',true);
  const image=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:size,height:size,scale:1}});
  const output=density==='splash'?'drawable-nodpi/splash.png':`mipmap-${density}/ic_launcher.png`;
  fs.writeFileSync(new URL(output,res),Buffer.from(image.data,'base64'));
  console.log(output+' '+size+'x'+size);
 }
}finally{await browser.send('Browser.close').catch(()=>{});}
