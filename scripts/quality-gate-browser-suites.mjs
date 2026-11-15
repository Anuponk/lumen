// Shared local/CI inventory. Order retains the existing longest-first schedule.
export const browserSuites=[
  {
    "script": "sky-navigation-browser-tests.mjs",
    "output": "ci-sky-navigation.json",
    "port": 9226
  },
  {
    "script": "learning-browser-tests.mjs",
    "output": "ci-learning.json",
    "port": 9224
  },
  {
    "script": "account-session-browser-tests.mjs",
    "output": "ci-account-session.json",
    "port": 9230
  },
  {
    "script": "browser-tests.mjs",
    "output": "ci-browser.json",
    "port": 9222
  },
  {
    "script": "iau-completion-browser-tests.mjs",
    "output": "ci-iau-completion.json",
    "port": 9240
  },
  {
    "script": "first-welcome-browser-tests.mjs",
    "output": "ci-first-welcome.json",
    "port": 9237
  },
  {
    "script": "canonical-replay-browser-tests.mjs",
    "output": "ci-canonical-replay.json",
    "port": 9227
  },
  {
    "script": "campaign-resume-browser-tests.mjs",
    "output": "ci-campaign-resume.json",
    "port": 9231
  },
  {
    "script": "ux-lot-browser-tests.mjs",
    "output": "ci-ux-lot.json",
    "port": 9236
  },
  {
    "script": "late-game-browser-tests.mjs",
    "output": "ci-late-game.json",
    "port": 9225
  },
  {
    "script": "ranking-browser-tests.mjs",
    "output": "ci-ranking.json",
    "port": 9252
  },
  {
    "script": "official-time-browser-tests.mjs",
    "output": "ci-official-time.json",
    "port": 9253
  },
  {
    "script": "victory-layout-browser-tests.mjs",
    "output": "ci-victory-layout.json",
    "port": 9254
  },
  {
    "script": "victory-pending-browser-tests.mjs",
    "output": "ci-victory-pending.json",
    "port": 9257
  },
  {
    "script": "account-switch-browser-tests.mjs",
    "output": "ci-account-switch.json",
    "port": 9258
  },
  {
    "script": "analytics-admin-browser-tests.mjs",
    "output": "ci-analytics-admin.json",
    "port": 9259
  },
  {
    "script": "admin-preview-browser-tests.mjs",
    "output": "ci-admin-preview.json",
    "port": 9260
  },
  {
    "script": "learning-coach-placement-browser-tests.mjs",
    "output": "ci-learning-coach.json",
    "port": 9255
  },
  {
    "script": "quest-review-browser-tests.mjs",
    "output": "ci-quest-review.json",
    "port": 9256
  },
  {
    "script": "adventure-mastery-browser-tests.mjs",
    "output": "ci-adventure-mastery.json",
    "port": 9245
  },
  {
    "script": "adventure-05-browser-tests.mjs",
    "output": "ci-adventure-05.json",
    "port": 9239
  },
  {
    "script": "sky-return-browser-tests.mjs",
    "output": "ci-sky-return.json",
    "port": 9251
  },
  {
    "script": "offline-hint-network-browser-tests.mjs",
    "output": "ci-offline-hint-network.json",
    "port": 9243
  },
  {
    "script": "offline-hint-purchase-browser-tests.mjs",
    "output": "ci-offline-hint.json",
    "port": 9242
  },
  {
    "script": "ux-cleanup-tests.mjs",
    "output": "ci-ux.json",
    "port": 9223
  },
  {
    "script": "drag-cascade-browser-tests.mjs",
    "output": "ci-drag-cascade.json",
    "port": 9244
  },
  {
    "script": "cloud-reset-browser-tests.mjs",
    "output": "ci-cloud-reset.json",
    "port": 9250
  },
  {
    "script": "service-worker-update-browser-tests.mjs",
    "output": "ci-pwa-update.json",
    "port": 9232
  },
  {
    "script": "iau-completion-cloud-browser-tests.mjs",
    "output": "ci-iau-completion-cloud.json",
    "port": 9241
  },
  {
    "script": "incident-investigation-browser-tests.mjs",
    "output": "ci-incident-investigation.json",
    "port": 9235
  },
  {
    "script": "personal-records-browser-tests.mjs",
    "output": "ci-personal-records.json",
    "port": 9238
  },
  {
    "script": "landing-browser-tests.mjs",
    "output": "ci-landing.json",
    "port": 9261
  }
];

// #744: a presentation-page-only pull request (scripts/ci-scope.mjs) runs only the page
// suite, on the first shard; any other value is rejected rather than reducing coverage.
const LANDING_SUITE='landing-browser-tests.mjs';
function qualityScope(env){
 const scope=env.LUMEN_QUALITY_SCOPE||'full';
 if(!['full','docs','landing'].includes(scope))throw Error('Unknown LUMEN_QUALITY_SCOPE: '+scope);
 return scope;
}

export function selectQualityPlan(args=[],env=process.env) {
 const landing=qualityScope(env)==='landing';
 if(args.length===0)return {phase:'full',shard:null,scope:landing?'landing':'full',suites:landing?browserSuites.filter(s=>s.script===LANDING_SUITE):browserSuites.filter(s=>env.LUMEN_RUN_LEARNING_BROWSER!=='false'||s.script!=='learning-browser-tests.mjs')};
 if(args.length===1&&args[0]==='--node-only')return {phase:'node',shard:null,scope:landing?'landing':'full',suites:[]};
 const match=args.length===1&&/^--browser-shard=([1-3])\/3$/.exec(args[0]);
 if(!match)throw Error('Usage: quality-gate.mjs [--node-only | --browser-shard=1/3|2/3|3/3]');
 const index=Number(match[1])-1;
 if(landing)return {phase:'browser',shard:match[1]+'/3',scope:'landing',suites:index===0?browserSuites.filter(s=>s.script===LANDING_SUITE):[]};
 // Assign before optional learning selection so the other shards stay stable.
 return {phase:'browser',shard:match[1]+'/3',suites:browserSuites.filter((s,i)=>i%3===index).filter(s=>env.LUMEN_RUN_LEARNING_BROWSER!=='false'||s.script!=='learning-browser-tests.mjs')};
}
