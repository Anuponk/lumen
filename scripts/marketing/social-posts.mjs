// #1056 · Plan of the daily 08:00 Facebook posts.
//   node scripts/marketing/social-posts.mjs                 write content/generated/social-posts.json
//   node scripts/marketing/social-posts.mjs --check         CI: the committed plan is up to date
//   node scripts/marketing/social-posts.mjs --metricool=out.csv   CSV for a Metricool bulk import
// The plan covers the mini-puzzle calendar range. Publication itself is done
// by the o2switch cron (scripts/lumen_social_post.py), off by default.
import fs from 'node:fs';
import path from 'node:path';
import { canonicalQuestAtGridRevision } from '../../src/campaign/canonical-quests.js';
import { addDays } from '../../src/acquisition/mini-puzzle.js';
import { metricoolCsv, planPosts } from '../../src/acquisition/social-posts.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const OUT = path.join(root, 'content/generated/social-posts.json');
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

export function buildPlan() {
  const calendar = read('content/generated/mini-calendar.json');
  const schedule = read('content/generated/daily-schedule.json');
  const from = calendar.days[0].day,
    to = calendar.days.at(-1).day;
  const posts = planPosts({
    from,
    to,
    calendar,
    schedule,
    addDays,
    sizeOf: (entry) => canonicalQuestAtGridRevision(entry.questId, entry.gridRevision).size,
    imageExists: (file) => fs.existsSync(path.join(root, file)),
  });
  return { schema: 'lumen-social-posts-v1', timeZone: 'Europe/Paris', channel: 'facebook', from, to, posts };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('marketing/social-posts.mjs')) {
  const args = process.argv.slice(2);
  const plan = buildPlan();
  const text = JSON.stringify(plan, null, 1) + '\n';
  const csv = args.find((a) => a.startsWith('--metricool='))?.split('=')[1];
  if (args.includes('--check')) {
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== text) {
      console.error('Run node scripts/marketing/social-posts.mjs: content/generated/social-posts.json is stale');
      process.exit(1);
    }
    console.log('social-posts: ' + plan.posts.length + ' posts up to date');
  } else if (csv) {
    fs.writeFileSync(csv, metricoolCsv(plan.posts));
    console.log('social-posts: ' + plan.posts.length + ' rows written to ' + csv);
  } else {
    fs.writeFileSync(OUT, text);
    console.log('social-posts: wrote ' + plan.posts.length + ' posts (' + plan.from + ' → ' + plan.to + ')');
  }
}
