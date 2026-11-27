// #1056 / #1057 · Visuals of the daily posts and Open Graph previews (1200×630 JPEG).
//   mini-AAAA-MM-JJ.jpg      the mini-puzzle as published: territories and the given
//                            Guardians only, never the missing ones
//   official-AAAA-MM-JJ.jpg  the Défi du jour before its first move: territories only
// Same pipeline as scripts/promo-og-assets.mjs (serve the app, Chrome with CDP):
//   LUMEN_TEST_URL=http://127.0.0.1:8000/ LUMEN_CDP_URL=http://127.0.0.1:9222 \
//     node scripts/marketing/social-visuals.mjs [--from=2026-12-01] [--to=2026-12-31]
// Then regenerate the pages and the plan: node scripts/mini-calendar.mjs &&
// node scripts/marketing/social-posts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { connectBrowser } from '../cdp-client.mjs';
import { canonicalQuestAtGridRevision, canonicalQuestById } from '../../src/campaign/canonical-quests.js';
import { adventDoor, miniPuzzle } from '../../src/acquisition/mini-puzzle.js';
import { TERRITORY_COLORS } from '../../src/acquisition/mini-game.js';
import {dailyPresentation} from '../../src/campaign/seasonal-events.js';
import { buildPlan } from './social-posts.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const OUT = path.join(root, 'content/social');
const arg = (name, fallback) => process.argv.find((a) => a.startsWith('--' + name + '='))?.split('=')[1] || fallback;
const from = arg('from', '2026-12-01'),
  to = arg('to', '2027-01-31');

export {boardSvg,composition} from '../../src/acquisition/daily-creative.js';
import {composition} from '../../src/acquisition/daily-creative.js';

async function render({ send, evaluate }, base, spec) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: new URL('/mini/', base).href });
  for (let i = 0; i < 100 && !(await evaluate("document.readyState==='complete'").catch(() => false)); i++)
    await new Promise((r) => setTimeout(r, 60));
  await evaluate(`(()=>{
    const s=${JSON.stringify(spec)};
    let seed=11;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280;
    const stars=Array.from({length:120},()=>'radial-gradient(circle at '+(rnd()*100).toFixed(1)+'% '+(rnd()*100).toFixed(1)+'%, rgba(255,255,255,'+(0.3+rnd()*0.6).toFixed(2)+') 0 '+(rnd()<0.15?1.6:0.9)+'px, transparent '+(rnd()<0.15?2.4:1.4)+'px)').join(',');
    document.documentElement.lang='fr';
    document.head.querySelectorAll('link[rel=stylesheet]').forEach(l=>l.remove());
    document.body.style.cssText='margin:0;width:1200px;height:630px;overflow:hidden;background:'+stars+',radial-gradient(ellipse at 70% 25%,#1f4f80 0,#11345a 40%,#081a30 80%)';
    document.body.innerHTML='<main style="position:relative;width:1200px;height:630px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">'
     +'<div style="position:absolute;left:64px;top:70px;width:610px">'
     +'<p style="margin:0 0 18px;color:#f2d48a;font-weight:800;letter-spacing:.32em;font-size:28px">✦ LUMEN</p>'
     +'<p style="margin:0 0 18px;color:'+(s.gold?'#f2d48a':'#9be8f4')+';font-weight:700;font-size:28px">'+s.kicker+' '+(s.decoration??'')+'</p>'
     +'<h1 style="margin:0 0 22px;color:#fff;font-size:56px;line-height:1.12;font-weight:800;text-shadow:0 4px 24px rgba(0,0,0,.45)">'+s.hook+'</h1>'
     +'<p style="margin:0 0 30px;color:#d6e9f6;font-size:27px;font-weight:600">'+s.sub+'</p>'
     +'<p style="display:inline-block;margin:0;padding:13px 28px;border-radius:999px;background:linear-gradient(180deg,#9be8f4,#4fb9d3);color:#05202b;font-weight:800;font-size:26px">'+s.cta+'</p>'
     +'</div><div style="position:absolute;right:70px;top:105px;box-shadow:0 24px 70px rgba(0,0,0,.55);border-radius:22px">'+s.board+'</div></main>';
  })()`);
  await new Promise((r) => setTimeout(r, 250));
  const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 84 });
  return Buffer.from(data, 'base64');
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('marketing/social-visuals.mjs')) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const calendar = read('content/generated/mini-calendar.json'),
    schedule = read('content/generated/daily-schedule.json');
  const base = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
  const posts = buildPlan().posts.filter((p) => p.day >= from && p.day <= to);
  // Every mini day also gets its Open Graph preview, even when the post is official.
  const specs = new Map();
  for (const p of posts) specs.set(p.kind + p.day, composition(p, { calendar, schedule }));

  fs.mkdirSync(OUT, { recursive: true });
  const cdp = await connectBrowser();
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    for (const spec of specs.values()) {
      const jpeg = await render(cdp, base, spec);
      fs.writeFileSync(path.join(OUT, spec.file), jpeg);
      console.log(spec.file, jpeg.length, 'bytes');
    }
  } finally {
    await cdp.send('Browser.close').catch(() => {});
  }
}
