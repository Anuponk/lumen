// #940 copy refresh: 100 free puzzles, ad-free (French and English).\n// #932 Lot C: promotional social previews (FR/EN, 1200×630) built from real
// game assets: the app's own board capture (src/landing/board.webp, produced by
// landing-assets.mjs) and an official constellation figure
// (astronomicalIllumination, the same data the victory scene draws).
// Reproducible: serve the app, start Chrome with CDP, then run
//   LUMEN_TEST_URL=http://127.0.0.1:8000/ LUMEN_CDP_URL=http://127.0.0.1:9222 node scripts/promo-og-assets.mjs [--preview-dir=DIR]
// Writes src/landing/og.jpg and og-en.jpg; with --preview-dir, also full-size
// and thumbnail previews (WhatsApp-like large card and square crop).
import fs from 'node:fs';
import path from 'node:path';
import {connectBrowser} from './cdp-client.mjs';

const url = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
const previewDir = process.argv.find(a => a.startsWith('--preview-dir='))?.split('=')[1] || process.env.PROMO_PREVIEW_DIR || null;
const {send, evaluate} = await connectBrowser();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (expr, label) => { for (let i = 0; i < 150; i++) { if (await evaluate(expr).catch(() => false)) return; await sleep(100); } throw Error('Timed out: ' + label); };

export const COPY = {
  fr: {page: '/decouvrir.html', file: 'src/landing/og.jpg', lang: 'fr', hook: 'Peux-tu rallumer les constellations ?', sub: 'Un jeu de logique dans les étoiles', cta: '100 puzzles gratuits et sans pub'},
  en: {page: '/discover.html', file: 'src/landing/og-en.jpg', lang: 'en', hook: 'Can you relight the constellations?', sub: 'A logic puzzle among the stars', cta: '100 free puzzles · No ads'},
  // #945 Lot C: same art direction, Spanish copy.
  es: {page: '/descubrir.html', file: 'src/landing/og-es.jpg', lang: 'es', hook: '¿Puedes volver a encender las constelaciones?', sub: 'Un juego de lógica entre las estrellas', cta: '100 puzles gratis y sin anuncios'},
};
// Ursa Major (Grande Ourse), partly relit: 4 of its 6 quests solved, lit with the
// same rule as the victory scene.
const CONSTELLATION = {id: 'real-01', lit: 4, count: 6};

async function compose(copy) {
  await send('Emulation.setDeviceMetricsOverride', {width: 1200, height: 630, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: new URL(copy.page, url).href});
  await until(`location.pathname===${JSON.stringify(copy.page)}&&document.readyState==='complete'`, copy.page);
  await evaluate(`(async()=>{
    const {astronomicalIllumination}=await import('/src/ui/astronomical-reference-svg.js');
    const c=${JSON.stringify(CONSTELLATION)};
    const data=astronomicalIllumination({id:c.id},c.lit,c.count);
    if(!data)throw Error('constellation figure unavailable');
    const {figure,litIndices}=data;
    const xs=figure.pts.map(p=>p[0]),ys=figure.pts.map(p=>p[1]);
    const [minX,maxX,minY,maxY]=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
    const W=470,H=125,s=Math.min(W/(maxX-minX||1),H/(maxY-minY||1));
    const P=([x,y])=>[(x-minX)*s+20,(y-minY)*s+20];
    const svgNS='http://www.w3.org/2000/svg';
    let svg='<svg xmlns="'+svgNS+'" width="'+(W+40)+'" height="'+(H+40)+'" viewBox="0 0 '+(W+40)+' '+(H+40)+'"><defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    for(const [a,b] of figure.edges){const on=litIndices.has(a)&&litIndices.has(b);const [x1,y1]=P(figure.pts[a]),[x2,y2]=P(figure.pts[b]);
      svg+='<line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+(on?'#8de1ef':'rgba(169,192,211,.35)')+'" stroke-width="'+(on?4:2.5)+'" stroke-linecap="round"'+(on?' filter="url(#g)"':'')+'/>';}
    figure.pts.forEach((pt,i)=>{const on=litIndices.has(i);const [x,y]=P(pt);
      svg+='<circle cx="'+x+'" cy="'+y+'" r="'+(on?10:6)+'" fill="'+(on?'#ffe3a1':'#4c6680')+'"'+(on?' filter="url(#g)"':'')+'/>';});
    svg+='</svg>';
    // Deterministic star field.
    let seed=7;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;
    const stars=Array.from({length:110},()=>'radial-gradient(circle at '+(rnd()*100).toFixed(1)+'% '+(rnd()*100).toFixed(1)+'%, rgba(255,255,255,'+(0.35+rnd()*0.6).toFixed(2)+') 0 '+(rnd()<0.15?1.6:0.9)+'px, transparent '+(rnd()<0.15?2.4:1.4)+'px)').join(',');
    document.documentElement.lang=${JSON.stringify(copy.lang)};
    document.body.style.cssText='margin:0;width:1200px;height:630px;overflow:hidden;background:'+stars+',radial-gradient(ellipse at 72% 30%,#1f5a8a 0,#123a63 38%,#0a1d35 78%)';
    document.body.innerHTML='<main style="position:relative;width:1200px;height:630px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">'
     +'<div style="position:absolute;left:60px;top:78px;width:640px">'
     +'<p style="margin:0 0 22px;color:#f2d48a;font-weight:800;letter-spacing:.32em;font-size:30px">✦ LUMEN</p>'
     +'<h1 style="margin:0 0 26px;color:#ffffff;font-size:62px;line-height:1.1;font-weight:800;text-shadow:0 4px 24px rgba(0,0,0,.45)">'+${JSON.stringify(copy.hook)}+'</h1>'
     +'<p style="margin:0 0 30px;color:#d6e9f6;font-size:30px;font-weight:600">'+${JSON.stringify(copy.sub)}+'</p>'
     +'<p style="display:inline-block;margin:0;padding:14px 30px;border-radius:999px;background:linear-gradient(180deg,#9be8f4,#4fb9d3);color:#05202b;font-weight:800;font-size:28px;box-shadow:0 0 34px rgba(141,225,239,.45)">'+${JSON.stringify(copy.cta)}+' ✦</p>'
     +'</div>'
     +'<div style="position:absolute;right:62px;top:178px;width:400px;height:400px;border-radius:30px;overflow:hidden;border:2px solid rgba(141,225,239,.55);box-shadow:0 0 0 6px rgba(141,225,239,.08),0 24px 70px rgba(0,0,0,.55)"><img id="grid" src="/src/landing/board.webp" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center 45%"></div>'
     +'<div style="position:absolute;right:28px;top:6px;opacity:.98">'+svg+'</div>'
     +'</main>';
  })()`);
  await until("document.getElementById('grid')?.complete&&document.getElementById('grid').naturalWidth>0", 'grid capture');
  await sleep(300);
  const {data} = await send('Page.captureScreenshot', {format: 'jpeg', quality: 86});
  fs.writeFileSync(copy.file, Buffer.from(data, 'base64'));
  console.log(copy.file, fs.statSync(copy.file).size, 'bytes');
}

// What a messenger shows: a ~400 px wide large card and a small square crop.
async function previews(copy, name) {
  if (!previewDir) return;
  fs.mkdirSync(previewDir, {recursive: true});
  const src = new URL('/' + copy.file + '?' + Date.now(), url).href;
  await send('Emulation.setDeviceMetricsOverride', {width: 1200, height: 630, deviceScaleFactor: 1, mobile: false});
  await evaluate(`document.body.style.cssText='margin:0;background:#0b141a';document.body.innerHTML='<img id="i" src="${src}" style="display:block">'`);
  await until("document.getElementById('i').complete", 'full');
  fs.writeFileSync(path.join(previewDir, name + '-full.png'), Buffer.from((await send('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', {width: 420, height: 380, deviceScaleFactor: 1, mobile: true});
  await evaluate(`document.body.style.cssText='margin:0;padding:10px;background:#0b141a;font:14px system-ui;color:#e9edef';document.body.innerHTML='<div style="width:400px;border-radius:10px;overflow:hidden;background:#1f2c34"><img src="${src}" style="width:400px;height:210px;display:block;object-fit:cover"><div style="padding:8px 10px"><b>Lumen</b><br><span style="color:#8696a0">lumen.nopuna.fr</span></div></div><div style="margin-top:10px;display:flex;gap:10px;align-items:center;background:#1f2c34;border-radius:8px;padding:6px;width:388px"><img src="${src}" style="width:72px;height:72px;object-fit:cover;border-radius:6px"><span>Lumen · ${copy.page.slice(1)}</span></div>'`);
  await sleep(400);
  fs.writeFileSync(path.join(previewDir, name + '-small.png'), Buffer.from((await send('Page.captureScreenshot', {format: 'png'})).data, 'base64'));
}

try {
  await send('Page.enable'); await send('Runtime.enable');
  for (const [locale, copy] of Object.entries(COPY)) { await compose(copy); await previews(copy, 'og-promo-' + locale); }
} finally {
  await send('Browser.close').catch(() => {});
}
