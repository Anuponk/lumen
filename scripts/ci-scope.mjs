// #744: classify a pull-request diff for the CI. Fail closed: an empty, unreadable or
// unknown change runs the full gate.
//   docs    – documentation only (existing rule)
//   landing – the static presentation page (#736) and its own tests, with or without docs
//   full    – anything else, including index.html, the service worker, workflows and this file
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const LANDING_FILES=new Set(['decouvrir.html','discover.html','descubrir.html','comment-jouer.html','how-to-play.html','como-jugar.html','apprendre-constellations.html','learn-constellations.html','aprender-constelaciones.html','robots.txt','sitemap.xml','scripts/how-to-play.mjs',
 'scripts/landing-seo-tests.mjs','scripts/landing-browser.mjs','scripts/landing-browser-tests.mjs','scripts/landing-assets.mjs','scripts/promo-og-assets.mjs']);

export const isDocs=p=>p==='AGENTS.md'||(p.startsWith('docs/')&&p.endsWith('.md')&&!p.startsWith('docs/validation/'));
export const isLanding=p=>LANDING_FILES.has(p)||(/^src\/landing\/[^/]+$/.test(p)&&!p.includes('..'));

export function classifyScope(paths){
 if(!Array.isArray(paths)||!paths.length||paths.some(p=>typeof p!=='string'||!p))return 'full';
 if(paths.every(isDocs))return 'docs';
 if(paths.every(p=>isDocs(p)||isLanding(p)))return 'landing';
 return 'full';
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let scope='full';
 try{scope=classifyScope(fs.readFileSync(process.argv[2],'utf8').split(/\r?\n/).filter(Boolean))}
 catch(error){console.log('Cannot classify the diff; running the full gate:',error.message)}
 console.log('CI scope:',scope);
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`scope=${scope}\nrun_full=${scope==='docs'?'false':'true'}\n`);
}
