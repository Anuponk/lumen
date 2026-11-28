import { contentMapModel } from '../../src/campaign/content.js';
import { canonicalQuestList } from '../../src/campaign/canonical-quests.js';
import {
  constellationFactForId,
  localizedConstellationFact,
} from '../../src/campaign/constellation-facts.js';
import { summarizeWeek } from '../../src/campaign/daily-week.js';
import {
  celestialScope,
  celestialMastered,
  questHasMissingBadges,
  nextIncompleteBadgeQuest,
} from '../../src/ui/celestial-progress.js';
import {
  astronomicalIllumination,
  astronomicalPrimarySvg,
} from '../../src/ui/astronomical-reference-svg.js';
import { createTranslator } from '../../src/ui/i18n.js';
import { adventureDisplayName } from '../../src/ui/adventure-copy.js';
import { renderDailyWeek } from '../../src/ui/daily-view.js';
import { createPodium, createRankRow, htmlDocument } from '../../src/ui/podium.js';
import { storyboard, destinations, names, referenceCaptures } from './storyboard.js';

const { t } = createTranslator({ locale: 'fr' });
const screen = document.querySelector('#screen');
const nav = document.querySelector('#primary');
const catalogue = canonicalQuestList();
const packs = contentMapModel().skies.flatMap((sky) => sky.packs);
const badgeKeys = ['speed', 'autonomy', 'noError', 'mastery'];
const symbols = { speed: '⚡', autonomy: '🧠', noError: '✓', mastery: '✦' };
const badgeLabel = (key) => t('results.' + key);
const badgeClass = (key) => (key === 'noError' ? 'no-error' : key);
const seed = { solved: {}, performances: {}, canonicalQuestState: {} };
const histories = new Map();
for (const [index, quest] of catalogue.slice(0, 34).entries()) {
  const badges = { speed: index % 3 !== 1, autonomy: index % 8 !== 6, noError: index % 8 < 6 };
  badges.mastery = badges.speed && badges.autonomy && badges.noError;
  if (quest.constellationId === packs[0].constellations[0].id) {
    for (const key of badgeKeys) badges[key] = true;
  }
  const record = { version: 2, badges, bestSeconds: badges.speed ? 39 + (index % 15) : 62 + index };
  if (quest.legacyIndex === null) {
    seed.canonicalQuestState[quest.id] = { ...record, solved: true };
  } else {
    seed.solved[quest.legacyIndex] = true;
    seed.performances[quest.legacyIndex] = record;
  }
  histories.set(quest.id, record);
}
const routes = new Set(Object.keys(storyboard));
const overview = new Set(['E04', 'E05', 'E06']);
const detail = new Set(['E07', 'E09']);
const questScreens = new Set(['E11', 'E12', 'E13', 'E20']);
let packIndex = 0;
let constellationIndex = 0;
let state = 'E04';
let selectedQuest = catalogue[34];
let filteredJourney = false;
let swipeStart;

const esc = (value) =>
  String(value ?? '').replace(
    /[<>&"'\x60]/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
        '\x60': '&#96;',
      })[c],
  );
const link = (route, label = names[route], primary = false) =>
  '<button type="button" data-go="' +
  route +
  '"' +
  (primary ? ' class="preview-primary"' : '') +
  '>' +
  esc(label) +
  '</button>';
const navLinks = (route) =>
  '<div class="preview-cta">' + destinations[route].map((item) => link(item)).join('') + '</div>';
const pack = () => packs[packIndex];
const constellation = () => pack().constellations[constellationIndex] ?? pack().constellations[0];
const questsOf = (entry) =>
  catalogue.filter((quest) => quest.constellationId === entry.id && quest.packId === entry.packId);
const packQuests = () => catalogue.filter((quest) => quest.packId === pack().id);

function badgeTotal(stats) {
  return (
    '<strong class="badge-total" aria-label="Total badges">' +
    stats.earned +
    '/' +
    stats.possible +
    '</strong>'
  );
}

function counts(quests, stats = celestialScope(seed, quests), includeTotal = true) {
  return (
    '<div class="badge-counts">' +
    badgeKeys
      .map((key) => {
        const ratio = stats.badges[key] + '/' + quests.length;
        return (
          '<span aria-label="' +
          esc(badgeLabel(key) + ' ' + ratio) +
          '" title="' +
          esc(badgeLabel(key)) +
          '"><span aria-hidden="true">' +
          symbols[key] +
          '</span>' +
          ratio +
          '</span>'
        );
      })
      .join('') +
    (includeTotal ? badgeTotal(stats) : '') +
    '</div>'
  );
}

function figure(entry, stats, className) {
  const projection = astronomicalIllumination(entry, stats.completed, stats.total);
  if (!projection) return '<span></span>';
  const coords = projection.figure.pts;
  const minX = Math.min(...coords.map(([x]) => x)) - 12;
  const minY = Math.min(...coords.map(([, y]) => y)) - 12;
  const w = Math.max(...coords.map(([x]) => x)) - minX + 12;
  const h = Math.max(...coords.map(([, y]) => y)) - minY + 12;
  return (
    '<svg aria-hidden="true" class="' +
    className +
    '" viewBox="' +
    [minX, minY, w, h].join(' ') +
    '">' +
    astronomicalPrimarySvg(entry, stats.completed, stats.total) +
    '</svg>'
  );
}

function arrows(label) {
  return (
    '<div class="adventure-controls"><button type="button" data-step="-1" aria-label="Précédent" ' +
    (packIndex === 0 ? 'disabled' : '') +
    '>‹</button><span>' +
    label +
    '</span><button type="button" data-step="1" aria-label="Suivant" ' +
    (packIndex === packs.length - 1 ? 'disabled' : '') +
    '>›</button></div>'
  );
}

const daily = () => link('E19', 'Défi du jour');
const continueQuest = () => link('E10', 'Continuer', true);

function adventure() {
  const quests = packQuests();
  const progress = state === 'E06'
    ? { ...seed, solved: { ...seed.solved }, canonicalQuestState: { ...seed.canonicalQuestState } }
    : seed;
  if (state === 'E06') {
    for (const quest of quests) {
      if (quest.legacyIndex === null) {
        progress.canonicalQuestState[quest.id] = { ...progress.canonicalQuestState[quest.id], solved: true };
      } else {
        progress.solved[quest.legacyIndex] = true;
      }
    }
  }
  const stats = celestialScope(progress, quests);
  const cards = pack()
    .constellations.map((entry, index) => {
      const items = questsOf(entry);
      const value = celestialScope(progress, items);
      const code = celestialMastered(value)
        ? 'mastered'
        : value.complete
          ? 'complete'
          : value.completed
            ? 'active'
            : 'new';
      const label = {
        mastered: 'Maîtrisée',
        complete: 'Terminée',
        active: 'En cours',
        new: 'À découvrir',
      }[code];
      return (
        '<button type="button" data-constellation="' +
        index +
        '" data-state="' +
        code +
        '"><span class="card-symbol">' +
        figure(entry, value, 'figure') +
        badgeTotal(value) +
        '</span>' +
        '<span><strong class="card-name">' +
        esc(entry.label) +
        '</strong><span class="card-state">' +
        value.completed +
        '/' +
        value.total +
        ' · ' +
        label +
        '</span></span>' +
        counts(items, value, false) +
        '</button>'
      );
    })
    .join('');
  return (
    '<section class="preview-panel adventure-summary"><div class="screen-heading"><h1>' +
    esc(adventureDisplayName(pack(), t)) +
    '</h1>' +
    arrows(packIndex + 1 + '/' + packs.length) +
    '</div><p class="preview-meta">' +
    stats.completed +
    '/' +
    stats.total +
    ' quêtes · ' +
    pack().constellations.length +
    ' constellations</p><progress aria-label="Progression de l’aventure" max="' +
    stats.total +
    '" value="' +
    stats.completed +
    '"></progress>' +
    counts(quests, stats) +
    '</section><div id="constellations">' +
    cards +
    '</div><div class="preview-cta">' +
    continueQuest() +
    daily() +
    '</div>'
  );
}

function questBadges(record) {
  return (
    '<span class="performance-grid">' +
    badgeKeys
      .map((key) => {
        const held = !!record?.badges[key];
        const label = badgeLabel(key) + (held ? ' obtenu' : ' à obtenir');
        return (
          '<span class="performance-slot ' +
          badgeClass(key) +
          (held ? ' earned' : '') +
          '" aria-label="' +
          esc(label) +
          '" title="' +
          esc(label) +
          '">' +
          symbols[key] +
          '</span>'
        );
      })
      .join('') +
    '</span>'
  );
}

function constellationScreen(filtered) {
  const entry = constellation();
  const quests = questsOf(entry);
  const stats = celestialScope(seed, quests);
  const shown = filtered ? quests.filter((quest) => questHasMissingBadges(seed, quest)) : quests;
  const rows = shown.map((quest) => {
    const record = histories.get(quest.id);
    const label = record
      ? record.bestSeconds + ' s'
      : quest.id === catalogue[34].id
        ? 'À jouer'
        : 'À découvrir';
    return (
      '<button type="button" class="quest-row" data-quest="' +
      esc(quest.id) +
      '" data-filtered="' +
      filtered +
      '"><strong>Q' +
      quest.position +
      '</strong><span>' +
      label +
      '</span>' +
      questBadges(record) +
      '</button>'
    );
  });
  return (
    '<section class="preview-panel"><div class="screen-heading"><div><h1>' +
    esc(entry.label) +
    '</h1><p>' +
    stats.completed +
    '/' +
    stats.total +
    ' quêtes</p></div>' +
    figure(entry, stats, 'detail-figure') +
    '</div>' +
    counts(quests, stats) +
    '</section>' +
    '<div class="detail-tools">' +
    link('E04', 'Mon ciel') +
    link('E08', 'Fiche astronomique') +
    '<label><input type="checkbox" data-filter ' +
    (filtered ? 'checked' : '') +
    '> À compléter</label></div>' +
    '<div class="detail-rows">' +
    (rows.join('') || '<p>Tous les badges de cette constellation sont obtenus.</p>') +
    '</div>' +
    '<div class="preview-cta"><button type="button" data-constellation-step="-1" ' +
    (constellationIndex === 0 ? 'disabled' : '') +
    '>‹ Constellation</button><button type="button" data-constellation-step="1" ' +
    (constellationIndex === pack().constellations.length - 1 ? 'disabled' : '') +
    '>Constellation ›</button></div>'
  );
}

function facts() {
  const entry = constellation();
  const fact = constellationFactForId(entry.id);
  if (!fact) return reference();
  const { name, nameOrigin, funFact } = localizedConstellationFact(fact, t);
  const stats = celestialScope(seed, questsOf(entry));
  return (
    '<section class="preview-panel"><div class="screen-heading"><h1>' +
    esc(name) +
    '</h1>' +
    figure(entry, stats, 'detail-figure') +
    '</div><p>' +
    esc(nameOrigin) +
    '</p><p>' +
    esc(funFact) +
    '</p></section>' +
    link(filteredJourney ? 'E09' : 'E07', 'Retour à la constellation')
  );
}

function play() {
  const entry = packs
    .flatMap((item) => item.constellations)
    .find((item) => item.id === selectedQuest.constellationId);
  return (
    '<section class="preview-panel"><h1>Jouer</h1><p>' +
    esc(entry?.label) +
    ' · Quête ' +
    selectedQuest.ordinal +
    '</p></section><div class="preview-cta">' +
    link('E11', 'Continuer', true) +
    daily() +
    '</div>'
  );
}

function board() {
  const label = state === 'E20' ? 'Défi du jour' : 'Quête ' + selectedQuest.ordinal;
  return (
    '<section class="preview-panel"><div class="screen-heading"><h1>' +
    label +
    '</h1>' +
    link('E13', 'Pause') +
    '</div><div class="preview-board" aria-label="Grille du catalogue"></div>' +
    '<div class="preview-grid-actions">' +
    link('E12', 'Aides et indices') +
    link(state === 'E20' ? 'E21' : 'E14', 'Afficher le résultat de recette') +
    '</div></section>'
  );
}

function drawBoard() {
  const boardElement = screen.querySelector('.preview-board');
  const palette = [
    '#2e536b',
    '#355f53',
    '#572f51',
    '#69563e',
    '#373c69',
    '#63586d',
    '#3a6875',
    '#6b4745',
    '#4b5d42',
    '#545469',
  ];
  boardElement.style.gridTemplateColumns = 'repeat(' + selectedQuest.size + ', 1fr)';
  selectedQuest.reg.forEach((row, r) =>
    row.forEach((territory, c) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.style.setProperty('--territory', palette[territory % palette.length]);
      cell.setAttribute('aria-label', 'Ligne ' + (r + 1) + ', colonne ' + (c + 1));
      cell.addEventListener('click', () => {
        cell.textContent = cell.textContent ? '' : '✦';
      });
      boardElement.append(cell);
    }),
  );
}

function rankings() {
  const ordered = Array.from({ length: 7 }, (_, index) => ({
    nickname: 'Joueur ' + String.fromCharCode(65 + index),
    position: index + 1,
    place: index + 1,
    value: 3410 - index * 210 + ' pts',
  }));
  const html = htmlDocument();
  const podium = createPodium(html, ordered, { t });
  const rest = ordered.slice(3).map((item) => createRankRow(html, item, { t }).outerHTML);
  return (
    '<section class="preview-panel"><div class="screen-heading"><h1>Classements</h1>' +
    arrows(packIndex + 1 + '/' + packs.length) +
    '</div><p>' +
    esc(adventureDisplayName(pack(), t)) +
    '</p>' +
    podium.outerHTML +
    '<ol class="lumen-rank-list" start="4">' +
    rest.join('') +
    '</ol></section>' +
    link('E26')
  );
}

function dailyScreen(withWeek) {
  const week = summarizeWeek({
    monday: '2026-11-23',
    days: [
      {
        day: '2026-11-23',
        state: 'completed',
        final: true,
        general_rank: 3,
        general_total: 12,
        run: { score: 51 },
      },
      { day: '2026-11-24', state: 'missed', final: true },
      {
        day: '2026-11-25',
        state: 'completed',
        final: true,
        general_rank: 4,
        general_total: 15,
        run: { score: 62 },
      },
      {
        day: '2026-11-26',
        state: 'completed',
        final: true,
        general_rank: 2,
        general_total: 13,
        run: { score: 49 },
      },
      { day: '2026-11-27', state: 'missed', final: true },
    ],
  });
  return (
    '<section class="preview-panel"><h1>Défi du jour</h1><p>1 seul essai et même grille pour tous.</p></section>' +
    '<div class="preview-cta">' +
    link('E20', 'Jouer au Défi', true) +
    link('E22', 'Ma semaine') +
    link('E23', 'Historique') +
    '</div>' +
    (withWeek
      ? '<section class="preview-panel"><h2>Ma semaine</h2>' +
        renderDailyWeek(week, { t }) +
        '</section>'
      : '') +
    link('E26', 'Classements du Défi')
  );
}

function result() {
  const quest = selectedQuest;
  const record = histories.get(quest.id);
  const next = filteredJourney
    ? nextIncompleteBadgeQuest(
        catalogue,
        quest,
        seed,
        (item) => item.ordinal <= catalogue[34].ordinal,
      )
    : catalogue.find(
        (item) => item.ordinal === quest.ordinal + 1 && item.ordinal <= catalogue[34].ordinal,
      );
  return (
    '<section class="preview-panel"><h1>Victoire</h1><p>Quête ' +
    quest.ordinal +
    (record ? ' · ' + record.bestSeconds + ' secondes' : '') +
    '</p>' +
    questBadges(record) +
    '</section><div class="preview-cta">' +
    (next ? '<button type="button" data-next="' + esc(next.id) + '">Quête suivante</button>' : '') +
    link(filteredJourney ? 'E09' : 'E07', 'Retour à la constellation') +
    '</div><div class="preview-cta">' +
    link('E15') +
    link('E16') +
    '</div>'
  );
}

const notes = {
  E13: 'La tentative reste disponible à la reprise. Réinitialiser et abandonner conservent leurs confirmations.',
  E37: 'Définir la langue FR, EN ou ES, gérer les sons et l’assistance.',
  E38: 'Consulter les préférences et l’autorisation de rappel sur l’appareil.',
  E39: 'Retrouver les règles, les signalements et les diagnostics.',
  E41: 'La limite est lue dans le moteur de quotas. Retour au parcours gratuit ou accès à la boutique.',
  E42: 'Le canal Stripe ou Google Play est proposé par l’application selon l’appareil.',
  E43: 'La confirmation provient du reçu et permet d’explorer le ciel débloqué.',
  E44: 'La restauration utilise les reçus du compte et conserve les anciens droits.',
  E45: 'Les quêtes et tentatives accessibles hors ligne restent disponibles.',
  E46: 'La synchronisation vérifie le compte et la confirmation des opérations en attente.',
  E47: 'Les opérations en attente restent disponibles pour une nouvelle tentative.',
  E48: 'Le rejeu reste accessible pendant le délai, sans nouveau badge ni meilleur rang.',
  E49: 'Proposition : parcours de sept jours, quêtes résolues, badges et records personnels.',
  E50: 'Découvrir les duels depuis Social ou reprendre l’exploration.',
};

function reference() {
  const image = referenceCaptures[state];
  const intro =
    state === 'E19'
      ? '1 seul essai et même grille pour tous.'
      : (notes[state] ?? storyboard[state]);
  return (
    '<section class="preview-panel"><h1>' +
    esc(names[state]) +
    '</h1><p>' +
    esc(intro) +
    '</p>' +
    (image
      ? '<img class="reference-image" src="../validation/' +
        esc(image) +
        '" alt="Capture LUMEN de référence pour ' +
        esc(names[state]) +
        '"><p class="preview-meta">Capture de référence V1</p>'
      : '') +
    '</section>' +
    navLinks(state)
  );
}

function accountOrSocial() {
  const account = state === 'E35';
  const groups = account
    ? [['Compte', ['E36', 'E37', 'E38']], ['Services', ['E39', 'E40', 'E49']]]
    : [['Amis', ['E28', 'E29']], ['Duels', ['E30', 'E31']], ['Activité', ['E33', 'E22']]];
  return '<h1>' + esc(names[state]) + '</h1>' + groups.map(([label, items]) =>
    '<section class="preview-panel"><h2>' + esc(label) + '</h2><div class="preview-menu">' +
    items.map((route) => link(route)).join('') + '</div></section>').join('');
}

function render() {
  screen.classList.toggle('is-adventure', overview.has(state) || state === 'E25');
  nav.hidden = questScreens.has(state);
  const tab =
    overview.has(state) || detail.has(state) || state === 'E08'
      ? 'E04'
      : state === 'E25' || state === 'E26'
        ? 'E25'
        : /^E(2[7-9]|3[0-4])$/.test(state)
          ? 'E27'
          : state;
  nav.querySelectorAll('button').forEach((button) => {
    if (button.dataset.go === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('#scenario').value = state;
  if (overview.has(state)) screen.innerHTML = adventure();
  else if (detail.has(state)) screen.innerHTML = constellationScreen(state === 'E09');
  else if (state === 'E08') screen.innerHTML = facts();
  else if (state === 'E10') screen.innerHTML = play();
  else if (state === 'E19' || state === 'E22') screen.innerHTML = dailyScreen(state === 'E22');
  else if (state === 'E25') screen.innerHTML = rankings();
  else if (state === 'E27' || state === 'E35') screen.innerHTML = accountOrSocial();
  else if (state === 'E11' || state === 'E20') {
    screen.innerHTML = board();
    drawBoard();
  } else if (state === 'E14') screen.innerHTML = result();
  else screen.innerHTML = reference();
}

function go(route) {
  if (!routes.has(route)) return;
  state = route;
  history.replaceState(null, '', '#' + route.toLowerCase());
  render();
  screen.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function advance(delta) {
  const next = Math.min(packs.length - 1, Math.max(0, packIndex + delta));
  if (next === packIndex) return;
  packIndex = next;
  constellationIndex = 0;
  go(state === 'E25' ? 'E25' : 'E05');
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.dailyDay) {
    go('E23');
    return;
  }
  const {
    go: route,
    step,
    constellation,
    constellationStep,
    quest,
    filtered,
    next,
  } = button.dataset;
  if (route) go(route);
  else if (step) advance(Number(step));
  else if (constellation !== undefined) {
    constellationIndex = Number(constellation);
    go('E07');
  } else if (constellationStep) {
    constellationIndex += Number(constellationStep);
    go(state);
  } else if (quest) {
    filteredJourney = filtered === 'true';
    selectedQuest = catalogue.find((item) => item.id === quest);
    go(histories.has(quest) ? 'E14' : 'E11');
  } else if (next) {
    selectedQuest = catalogue.find((item) => item.id === next);
    const nextIndex = pack().constellations.findIndex(
      (item) => item.id === selectedQuest.constellationId,
    );
    if (nextIndex >= 0) constellationIndex = nextIndex;
    go('E11');
  }
});
screen.addEventListener('change', (event) => {
  if (event.target.matches('[data-filter]')) {
    filteredJourney = event.target.checked;
    go(filteredJourney ? 'E09' : 'E07');
  }
});
screen.addEventListener('pointerdown', (event) => {
  if (screen.classList.contains('is-adventure')) swipeStart = [event.clientX, event.clientY];
});
screen.addEventListener('pointercancel', () => {
  swipeStart = undefined;
});
screen.addEventListener('pointerup', (event) => {
  if (!swipeStart) return;
  const [x, y] = swipeStart;
  swipeStart = undefined;
  const dx = event.clientX - x;
  if (Math.abs(dx) > 55 && Math.abs(dx) > 1.5 * Math.abs(event.clientY - y))
    advance(Math.sign(-dx));
});
const select = document.querySelector('#scenario');
for (const [key, label] of Object.entries(names)) select.add(new Option(key + ' · ' + label, key));
select.addEventListener('change', () => go(select.value));
function routeFromHash() {
  go(location.hash.slice(1).toUpperCase() || 'E04');
}
window.addEventListener('hashchange', routeFromHash);
if (routes.has(location.hash.slice(1).toUpperCase())) routeFromHash();
else render();
