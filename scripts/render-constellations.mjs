import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { CONSTELLATION_FACTS } from '../src/campaign/constellation-facts.js';

const CONSTELLATIONS_PAGE = new URL('../constellations/index.html', import.meta.url);

const order = new Intl.Collator('fr', { sensitivity: 'base' });
const area = new Intl.NumberFormat('fr-FR');

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

function renderCard(fact, total) {
  return `    <article class="constellation-entry" id="${html(fact.id)}">
     <h3>${html(fact.name)}</h3>
     <dl class="constellation-story">
      <dt>Pourquoi ce nom ?</dt>
      <dd>${html(fact.nameOrigin)}</dd>
      <dt>Le savais-tu ?</dt>
      <dd>${html(fact.funFact)}</dd>
     </dl>
     <dl class="constellation-metrics">
      <div><dt>Surface apparente</dt><dd>${area.format(fact.areaSqDeg)}°²</dd></div>
      <div><dt>Rang par taille</dt><dd>${fact.areaRank}${fact.areaRank === 1 ? 'er' : 'e'} sur ${total}</dd></div>
     </dl>
     <details class="constellation-sources">
      <summary>Sources<span class="constellation-visually-hidden"> de ${html(fact.name)}</span></summary>
      <ul>${fact.sources.map((source, index) => `<li><a href="${sourceLink(source)}">Référence ${index + 1} · ${html(new URL(source).hostname.replace(/^www\./, ''))}</a></li>`).join('')}</ul>
     </details>
    </article>`;
}

export function renderConstellations() {
  const facts = CONSTELLATION_FACTS;
  const count = facts.length;
  const title = `Les ${count} constellations du ciel`;
  const description = `Découvrez les ${count} constellations officielles, l’origine de leur nom, leurs anecdotes et la place qu’elles occupent dans le ciel.`;
  const entries = [...facts].sort((first, second) => order.compare(first.name, second.name))
    .map((fact) => renderCard(fact, count)).join('\n');
  return `<!doctype html>
<!-- Généré depuis src/campaign/constellation-facts.js par node scripts/render-constellations.mjs. -->
<html lang="fr">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <title>${title} — Lumen</title>
 <meta name="description" content="${description}">
 <link rel="canonical" href="https://lumen.nopuna.fr/constellations/">
 <meta property="og:type" content="website">
 <meta property="og:locale" content="fr_FR">
 <meta property="og:site_name" content="Lumen">
 <meta property="og:title" content="${title}">
 <meta property="og:description" content="${description}">
 <meta property="og:url" content="https://lumen.nopuna.fr/constellations/">
 <meta property="og:image" content="https://lumen.nopuna.fr/src/landing/og.jpg">
 <meta property="og:image:alt" content="Une grille Lumen et une constellation rallumée">
 <meta name="theme-color" content="#07111d">
 <link rel="icon" href="/icon.svg" type="image/svg+xml">
 <link rel="stylesheet" href="/src/landing/landing.css">
 <link rel="stylesheet" href="/src/landing/constellations.css">
 <script src="/src/landing/constellations.js" type="module"></script>
</head>
<body>
 <header class="hero constellation-hero">
  <p class="brand"><a href="/decouvrir.html">✦ LUMEN</a></p>
  <h1>${title}</h1>
  <p class="lead">Derrière chaque constellation se cachent une histoire, un nom et parfois une légende. Découvrez les ${count} constellations officielles et leurs anecdotes, puis retrouvez-les dans Lumen.</p>
  <p class="cta"><a class="play" href="/">Découvrir les constellations en jouant à Lumen</a></p>
 </header>
 <main>
  <section aria-labelledby="constellation-list-title">
   <h2 id="constellation-list-title">Les constellations de A à Z</h2>
   <p class="constellation-intro">Une constellation est une région du ciel vue depuis la Terre. Sa surface se mesure en degrés carrés et ses étoiles peuvent se trouver à des distances très différentes.</p>
   <div class="constellation-search" id="constellation-search" hidden>
    <label for="constellation-name">Rechercher par nom</label>
    <input id="constellation-name" type="search" placeholder="Par exemple Orion" autocomplete="off">
    <p id="constellation-results" role="status">${count} constellations</p>
   </div>
   <div class="constellation-directory">
${entries}
   </div>
  </section>
 </main>
 <footer>
  <p><a href="/decouvrir.html">Découvrir Lumen</a> · <a href="/apprendre-constellations.html">Apprendre les constellations en jouant</a> · <a href="/mentions-legales.html">Mentions légales</a> · <a href="/confidentialite.html">Confidentialité</a></p>
 </footer>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);

  if (!args.length) {
    writeFileSync(CONSTELLATIONS_PAGE, renderConstellations());
  } else if (args.length === 1 && args[0] === '--check') {
    const current = existsSync(CONSTELLATIONS_PAGE)
      ? readFileSync(CONSTELLATIONS_PAGE, 'utf8').replace(/\r\n/g, '\n')
      : '';
    if (current !== renderConstellations()) {
      console.error('Run node scripts/render-constellations.mjs to regenerate the public page.');
      process.exitCode = 1;
    }
  } else {
    console.error('Usage: node scripts/render-constellations.mjs [--check]');
    process.exitCode = 2;
  }
}
