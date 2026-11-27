// 1200×630 JPEGs for private Metricool attachments, using the private date-to-grid plan.
// Start a loopback static server and Chrome with CDP, then pass --private-plan=FILE
// and --output=DIRECTORY outside the application checkout. Optional --from and --to.
import fs from 'node:fs';
import path from 'node:path';
import { connectBrowser } from '../cdp-client.mjs';
import {outsideCheckout} from './private-daily-plan.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith('--' + name + '='))?.split('=')[1] || fallback;
const from = arg('from', '2026-12-01'),
  to = arg('to', '2027-01-31');

export {boardSvg,composition} from '../../src/acquisition/daily-creative.js';
import {composition} from '../../src/acquisition/daily-creative.js';

async function render({ send, evaluate }, spec) {
  await evaluate(`(()=>{
    const s=${JSON.stringify(spec)};
    let seed=11;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;
    const stars=Array.from({length:120},()=>'radial-gradient(circle at '+(rnd()*100).toFixed(1)+'% '+(rnd()*100).toFixed(1)+'%, rgba(255,255,255,'+(0.3+rnd()*0.6).toFixed(2)+') 0 '+(rnd()<0.15?1.6:0.9)+'px, transparent '+(rnd()<0.15?2.4:1.4)+'px)').join(',');
    document.documentElement.lang='fr';
    document.head.querySelector('link[href="/src/landing/landing.css"]')?.remove();
    document.body.dataset.seasonal=s.skin;
    document.body.style.cssText='margin:0;width:1200px;height:630px;overflow:hidden;background:'+stars+','+(s.skin?'var(--winter-sky)':'radial-gradient(ellipse at 70% 25%,#1f4f80 0,#11345a 40%,#081a30 80%)');
    document.body.innerHTML='<main style="position:relative;width:1200px;height:630px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">'
     +'<div class="winter-garland" style="transform:scale(2);transform-origin:top center" aria-hidden="true"></div><div class="winter-starlight" aria-hidden="true"></div>'
     +'<div style="position:absolute;left:64px;top:70px;width:610px">'
     +'<p style="margin:0 0 18px;color:#f2d48a;font-weight:800;letter-spacing:.32em;font-size:28px">✦ LUMEN</p>'
     +'<p style="margin:0 0 18px;color:'+(s.skin?'#f2d48a':'#9be8f4')+';font-weight:700;font-size:28px">'+s.kicker+'</p>'
     +'<h1 style="margin:0 0 22px;color:#fff;font-size:56px;line-height:1.12;font-weight:800;text-shadow:0 4px 24px rgba(0,0,0,.45)">'+s.hook+'</h1>'
     +'<p style="margin:0 0 30px;color:#d6e9f6;font-size:27px;font-weight:600">'+s.sub+'</p>'
     +'<p style="display:inline-block;margin:0;padding:13px 28px;border-radius:999px;background:linear-gradient(180deg,#9be8f4,#4fb9d3);color:#05202b;font-weight:800;font-size:26px">'+s.cta+'</p>'
     +'</div><div style="position:absolute;right:70px;top:105px;box-shadow:0 24px 70px rgba(0,0,0,.55);border-radius:22px">'+s.board+'</div></main>';
  })()`);
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 84 });
  return Buffer.from(data, 'base64');
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('marketing/social-visuals.mjs')) {
  const schedulePath = outsideCheckout(arg('private-plan', '.'));
  const out = outsideCheckout(arg('output', '.'));
  const schedule = JSON.parse(fs.readFileSync(schedulePath,'utf8'));
  if(schedule.schema!=='lumen-private-daily-v1'||schedule.timeZone!=='Europe/Paris')throw Error('Expected a private schedule');
  const base = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
  if(base.hostname!=='127.0.0.1'&&base.hostname!=='localhost')throw Error('Private visuals require a local renderer');
  const specs = schedule.days.filter((p)=>p.day>=from&&p.day<=to).map(post=>composition(post,{schedule}));
  if(!specs.length)throw Error('Nothing to render for that date range');

  fs.mkdirSync(out, { recursive: true });
  const cdp = await connectBrowser();
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: new URL('/d/', base).href });
    let ready=false;
    for(let i=0;i<100&&!ready;i++){
      ready=await cdp.evaluate("location.pathname==='/d/'&&document.readyState==='complete'&&[...document.styleSheets].some(s=>s.href?.endsWith('/winter-stars.css'))").catch(()=>false);
      if(!ready)await new Promise(resolve=>setTimeout(resolve,60));
    }
    if(!ready)throw Error('The local seasonal stylesheet did not load');
    for (const spec of specs) {
      const jpeg = await render(cdp, spec);
      fs.writeFileSync(path.join(out, spec.file), jpeg, {mode:0o600});
      console.log(spec.file, jpeg.length, 'bytes');
    }
  } finally {
    await cdp.send('Browser.close').catch(() => {});
  }
}
