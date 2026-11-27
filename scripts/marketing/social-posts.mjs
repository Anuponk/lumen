// #1056 · Plan of the daily 08:00 Facebook posts.
//   node scripts/marketing/social-posts.mjs                 write content/generated/social-posts.json
//   node scripts/marketing/social-posts.mjs --check         CI: the committed plan is up to date
//   node scripts/marketing/social-posts.mjs --metricool=out.csv [--from=…] [--to=…]   Metricool calendar import
// The default plan covers December/January. CSV ranges use the native daily
// schedule; no Meta or Metricool publication is performed by this tool.
import fs from 'node:fs';
import path from 'node:path';
import { canonicalQuestAtGridRevision } from '../../src/campaign/canonical-quests.js';
import { addDays } from '../../src/acquisition/mini-puzzle.js';
import { metricoolCsv, planPosts } from '../../src/acquisition/social-posts.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const OUT = path.join(root, 'content/generated/social-posts.json');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

export function buildPlan({from='2026-12-01',to='2027-01-31'}={}) {
  const schedule = read('content/generated/daily-schedule.json');
  if(!schedule.days.some(d=>d.day===from)||!schedule.days.some(d=>d.day===to)||from>to)throw Error('Range outside the native daily schedule');
  const posts = planPosts({
    from,
    to,
    schedule,
    addDays,
    sizeOf: (entry) => canonicalQuestAtGridRevision(entry.questId, entry.gridRevision).size,
    privateMedia: true,
  });
  return { schema: 'lumen-social-posts-v1', timeZone: 'Europe/Paris', channel: 'facebook', from, to, posts };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('marketing/social-posts.mjs')) {
  const args = process.argv.slice(2);
  const csv = args.find((a) => a.startsWith('--metricool='))?.split('=')[1];
  const fromArg=args.find(a=>a.startsWith('--from='))?.split('=')[1];
  const toArg=args.find(a=>a.startsWith('--to='))?.split('=')[1];
  const plan = csv?buildPlan({...(fromArg?{from:fromArg}:{}),...(toArg?{to:toArg}:{})}):buildPlan();
  const text = JSON.stringify(plan, null, 1) + '\n';
  if (args.includes('--check')) {
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) {
      console.error('Run node scripts/marketing/social-posts.mjs: content/generated/social-posts.json is stale');
      process.exit(1);
    }
    console.log('social-posts: ' + plan.posts.length + ' posts up to date');
  } else if (csv) {
    // Optional --from=AAAA-MM-JJ --to=AAAA-MM-JJ, e.g. one month per import.
    const from = args.find((a) => a.startsWith('--from='))?.split('=')[1] || plan.from;
    const to = args.find((a) => a.startsWith('--to='))?.split('=')[1] || plan.to;
    const posts = plan.posts.filter((p) => p.day >= from && p.day <= to);
    // --draft: import as drafts (a one-row rehearsal before the real batch).
    fs.writeFileSync(csv, metricoolCsv(posts, { draft: args.includes('--draft') }));
    console.log('social-posts: ' + posts.length + ' rows (' + from + ' → ' + to + ') written to ' + csv);
  } else {
    fs.writeFileSync(OUT, text);
    console.log('social-posts: wrote ' + plan.posts.length + ' posts (' + plan.from + ' → ' + plan.to + ')');
  }
}
