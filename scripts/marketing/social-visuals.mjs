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
import { buildPlan } from './social-posts.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const OUT = path.join(root, 'content/social');
const arg = (name, fallback) => process.argv.find((a) => a.startsWith('--' + name + '='))?.split('=')[1] || fallback;
const from = arg('from', '2026-12-01'),
  to = arg('to', '2026-12-31');

// Pure: an SVG board, territories plus the Guardians that are public.
export function boardSvg(reg, given = [], { size = 420, frame = '#0b1726' } = {}) {
  const n = reg.length,
    cell = (size - 12) / n,
    o = 6;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`];
  parts.push(`<rect width="${size}" height="${size}" rx="22" fill="${frame}"/>`);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      parts.push(
        `<rect x="${(o + c * cell).toFixed(1)}" y="${(o + r * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="${
          TERRITORY_COLORS[reg[r][c] % TERRITORY_COLORS.length]
        }" stroke="#0b1726" stroke-opacity=".45" stroke-width="1"/>`,
      );
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const x = o + c * cell,
        y = o + r * cell;
      if (r > 0 && reg[r - 1][c] !== reg[r][c])
        parts.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + cell).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#0b1726" stroke-width="5"/>`);
      if (c > 0 && reg[r][c - 1] !== reg[r][c])
        parts.push(`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + cell).toFixed(1)}" stroke="#0b1726" stroke-width="5"/>`);
    }
  for (const [r, c] of given)
    parts.push(
      `<text x="${(o + (c + 0.5) * cell).toFixed(1)}" y="${(o + (r + 0.5) * cell + cell * 0.2).toFixed(1)}" text-anchor="middle" font-size="${(cell * 0.62).toFixed(0)}" font-weight="800" fill="#ffe3a1" style="filter:drop-shadow(0 0 6px rgba(255,227,161,.9))">✦</text>`,
    );
  parts.push('</svg>');
  return parts.join('');
}

function frDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('fr', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function composition(post, { calendar, schedule }) {
  if (post.kind === 'mini') {
    const entry = calendar.days.find((e) => e.day === post.day);
    const puzzle = miniPuzzle(entry, canonicalQuestById(entry.questId));
    const door = adventDoor(post.day);
    return {
      file: 'mini-' + post.day + '.jpg',
      kicker: door ? 'Calendrier de l’Avent · case ' + door : 'Mini-puzzle · ' + frDay(post.day),
      hook: puzzle.missing === 1 ? 'Saurez-vous placer le dernier Gardien ?' : 'Saurez-vous placer les ' + puzzle.missing + ' derniers Gardiens ?',
      sub: 'Un mini-puzzle en une minute, sans compte ni installation',
      cta: 'lumen.nopuna.fr/mini',
      board: boardSvg(puzzle.reg, puzzle.given),
      gold: Boolean(door),
    };
  }
  const daily = schedule.days.find((e) => e.day === post.day);
  const quest = canonicalQuestAtGridRevision(daily.questId, daily.gridRevision);
  return {
    file: 'official-' + post.day + '.jpg',
    kicker: 'Défi du jour · ' + frDay(post.day),
    hook: 'Une grille, une seule tentative officielle',
    sub: 'Qui fera le meilleur temps aujourd’hui ?',
    cta: 'Relever le défi dans LUMEN',
    board: boardSvg(quest.reg, [], { frame: '#c9a24a' }),
    gold: true,
  };
}

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
     +'<p style="margin:0 0 18px;color:'+(s.gold?'#f2d48a':'#9be8f4')+';font-weight:700;font-size:28px">'+s.kicker+'</p>'
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
  for (const e of calendar.days.filter((e) => e.day >= from && e.day <= to))
    specs.set('mini' + e.day, composition({ kind: 'mini', day: e.day }, { calendar, schedule }));
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
