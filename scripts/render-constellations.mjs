import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CONSTELLATION_FACTS, localizedConstellationFact } from '../src/campaign/constellation-facts.js';
import { createTranslator, locales } from '../src/ui/i18n.js';

const PAGES={fr:new URL('../constellations/index.html',import.meta.url),en:new URL('../constellations/en.html',import.meta.url)};
const paths={fr:'/constellations/',en:'/constellations/en.html'};
const site='https://lumen.nopuna.fr';

function html(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function sourceLink(source) {
  const url = new URL(source);
  if (url.protocol !== 'https:') throw new Error('An HTTPS source is required.');
  return html(url.href);
}

function renderCard(fact,total,locale,t) {
  const rank=t("fact.ordinal",{count:fact.areaRank},{type:"ordinal"});
  const surface=locale==="fr"?new Intl.NumberFormat("fr").format(fact.areaSqDeg)+"°²":t("fact.areaValue",{area:fact.areaSqDeg});
  return `    <article class="constellation-entry" id="${html(fact.id)}">
     <h3>${html(fact.name)}</h3>
     <dl class="constellation-story">
      <dt>${html(t("fact.origin"))}</dt>
      <dd>${html(fact.nameOrigin)}</dd>
      <dt>${html(t("fact.anecdote"))}</dt>
      <dd>${html(fact.funFact)}</dd>
     </dl>
     <dl class="constellation-metrics">
      <div><dt>${html(t("fact.area"))}</dt><dd>${html(surface)}</dd></div>
      <div><dt>${html(t("fact.directoryRank"))}</dt><dd>${html(t("fact.rankValue",{rank,total}))}</dd></div>
     </dl>
     <details class="constellation-sources">
      <summary>${html(t("fact.directorySources"))}<span class="constellation-visually-hidden">${html(t("fact.directorySourcesFor",{name:fact.name}))}</span></summary>
      <ul>${fact.sources.map((source, index) => `<li><a href="${sourceLink(source)}">${html(t("fact.directoryReference",{number:index+1}))} · ${html(new URL(source).hostname.replace(/^www\./, ''))}</a></li>`).join('')}</ul>
     </details>
    </article>`;
}

export function renderConstellations(locale="fr") {
  const {t}=createTranslator({locale});
  const fr=locale==="fr",alternate=fr?"en":"fr";
  const count=CONSTELLATION_FACTS.length;
  const title=html(t("fact.directoryTitle",{count}));
  const description=html(t("fact.directoryDescription",{count}));
  const order=new Intl.Collator(locale,{sensitivity:"base"});
  const entries=CONSTELLATION_FACTS.map(fact=>localizedConstellationFact(fact,t))
    .sort((a,b)=>order.compare(a.name,b.name)).map(fact=>renderCard(fact,count,locale,t)).join("\n");
  return `<!doctype html>
<!-- Généré depuis src/campaign/constellation-facts.js par node scripts/render-constellations.mjs. -->
<html lang="${locale}">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <title>${title} — Lumen</title>
 <meta name="description" content="${description}">
 <link rel="canonical" href="${site+paths[locale]}">
 <link rel="alternate" hreflang="fr" href="${site+paths.fr}">
 <link rel="alternate" hreflang="en" href="${site+paths.en}">
 <link rel="alternate" hreflang="x-default" href="${site+paths.fr}">
 <meta property="og:type" content="website">
 <meta property="og:locale" content="${fr?"fr_FR":"en_US"}">
 <meta property="og:locale:alternate" content="${fr?"en_US":"fr_FR"}">
 <meta property="og:site_name" content="Lumen">
 <meta property="og:title" content="${title}">
 <meta property="og:description" content="${description}">
 <meta property="og:url" content="${site+paths[locale]}">
 <meta property="og:image" content="https://lumen.nopuna.fr/src/landing/${fr?"og.jpg":"og-en.jpg"}">
 <meta property="og:image:alt" content="${html(t("fact.directoryAlt"))}">
 <meta name="theme-color" content="#07111d">
 <link rel="icon" href="/icon.svg" type="image/svg+xml">
 <link rel="stylesheet" href="/src/landing/landing.css">
 <link rel="stylesheet" href="/src/landing/constellations.css">
 <script src="/src/landing/constellations.js" type="module"></script>
</head>
<body>
 <header class="hero constellation-hero">
  <p class="brand"><a href="/${fr?"decouvrir.html":"discover.html"}">✦ LUMEN</a></p>
  <p><a href="${paths[alternate]}" hreflang="${alternate}" lang="${alternate}">${fr?"English":"Français"}</a></p>
  <h1>${title}</h1>
  <p class="lead">${html(t("fact.directoryLead",{count}))}</p>
  <p class="cta"><a class="play" href="/">${html(t("fact.directoryPlay"))}</a></p>
 </header>
 <main>
  <section aria-labelledby="constellation-list-title">
   <h2 id="constellation-list-title">${html(t("fact.directoryHeading"))}</h2>
   <p class="constellation-intro">${html(t("fact.directoryIntro"))}</p>
   <div class="constellation-search" id="constellation-search" hidden>
    <label for="constellation-name">${html(t("fact.directorySearch"))}</label>
    <input id="constellation-name" type="search" placeholder="${html(t("fact.directoryExample"))}" autocomplete="off">
    <p id="constellation-results" role="status" data-empty="${html(t("fact.directoryEmpty"))}" data-single="${html(t("fact.directoryCount",{count:1}))}" data-many="${html(locales[locale].messages["fact.directoryCount"].other.replace("{count}","%s"))}">${html(t("fact.directoryCount",{count}))}</p>
   </div>
   <div class="constellation-directory">
${entries}
   </div>
  </section>
 </main>
 <footer>
  <p><a href="/${fr?"decouvrir.html":"discover.html"}">${html(t("fact.directoryExplore"))}</a> · <a href="/${fr?"apprendre-constellations.html":"learn-constellations.html"}">${html(t("fact.directoryGuide"))}</a> · <a href="/${fr?"mentions-legales.html":"legal-notice.html"}">${html(t("app.legal"))}</a> · <a href="/${fr?"confidentialite.html":"privacy-policy.html"}">${html(t("app.privacy"))}</a></p>
 </footer>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);

  if (args.length && (args.length!==1 || args[0]!=="--check")) {
    console.error("Usage: node scripts/render-constellations.mjs [--check]");
    process.exitCode=2;
  } else for(const [locale,file] of Object.entries(PAGES)){
    const generated=renderConstellations(locale);
    if(!args.length){writeFileSync(file,generated);continue}
    const current=existsSync(file)?readFileSync(file,"utf8").replace(/\r\n/g,"\n"):"";
    if(current!==generated){console.error("Regenerate the "+locale+" directory with node scripts/render-constellations.mjs");process.exitCode=1}
  }
}
