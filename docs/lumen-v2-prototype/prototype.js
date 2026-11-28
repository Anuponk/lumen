import { contentMapModel } from '../../src/campaign/content.js';
import { canonicalQuestList } from '../../src/campaign/canonical-quests.js';
import { catalogueQuestDecision } from '../../src/campaign/catalogue-access.js';
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
import { renderDailyWeek, renderDailyBoard } from '../../src/ui/daily-view.js';
import {
  createPodium,
  createRankRow,
  createMyPosition,
  htmlDocument,
  rankWindow,
} from '../../src/ui/podium.js';
import { deriveSocialEvents } from '../../src/ui/social-notifications.js';
import { createPlayPreview } from './play-preview.js';
import { adventureOfferModel, mountPremiumOffer } from '../../src/ui/adventure-offer.js';
import { storyboard, destinations, names, referenceCaptures } from './storyboard.js';

const { t } = createTranslator({ locale: 'fr' });
const screen = document.querySelector('#screen');
const nav = document.querySelector('#primary');
const catalogue = canonicalQuestList();
// The preview account owns Horizons lointains. Later adventures show the locked path.
const packs = contentMapModel(['real-adventure-02']).skies.flatMap((sky) => sky.packs);
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
let rankingIndex = 0;
let constellationIndex = 0;
let state = 'E04';
let selectedQuest = catalogue[34];
let resumeQuest = selectedQuest;
let filteredJourney = false;
let badgeView = false;
let swipeStart;
let suppressClick = false;
let playRoute = 'E11';
const playPreview = createPlayPreview({
  screen,
  t,
  go,
  back: () => {
    if (['E12', 'E13'].includes(state) && !history.state?.depth) go(playRoute, { replace: true });
    else back();
  },
});
const notifications = deriveSocialEvents({
  friends: [{ nickname: 'Camille', state: 'incoming', since: '2026-11-28T08:00:00Z' }],
  received: [{ challenge_id: 'demo-duel', sender: 'Alex', created_at: '2026-11-28T09:00:00Z' }],
  sent: [
    {
      challenge_id: 'demo-result',
      unread_count: 1,
      participants: [{ name: 'Lou', status: 'completed', completed_at: '2026-11-28T10:00:00Z' }],
    },
  ],
  t,
});
const notificationDestinations = {
  'friend-request': ['E29', 'Voir la demande'],
  'challenge-received': ['E31', 'Voir le duel'],
  'challenge-result': ['E32', 'Voir le résultat'],
};
const readNotifications = new Set();
const decisions = new Map();
let openedNotification;

function completion(scope) {
  const available = scope.total + scope.possible;
  if (!available) return 0;
  if (celestialMastered(scope)) return 100;
  return Math.min(99, Math.floor((100 * (scope.completed + scope.earned)) / available));
}

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
const questAccess = (quest) =>
  catalogueQuestDecision(quest, seed, catalogue, {
    packAllowed: packs.find((item) => item.id === quest.packId)?.accessible === true,
    signedIn: true,
    cloudReady: true,
  });
const readyQuest = (quest) => questAccess(quest).status === 'ready';

// Owner decision 28/11 (D18): showing a locked adventure opens the shop directly.
let shopPack;
const lockedAdventureAction = () =>
  '<button type="button" data-shop-pack="' + esc(pack().id) + '">Voir l’accès</button>';
function openShop(target) {
  shopPack = target;
  go('E40');
}

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

function arrows(index, scope) {
  return (
    '<div class="adventure-controls"><button type="button" data-step="-1" aria-label="' +
    scope +
    ' précédente" ' +
    (index === 0 ? 'disabled' : '') +
    '>‹</button><span aria-label="Aventure ' +
    (index + 1) +
    ' sur ' +
    packs.length +
    '">' +
    (index + 1) +
    '/' +
    packs.length +
    '</span><button type="button" data-step="1" aria-label="' +
    scope +
    ' suivante" ' +
    (index === packs.length - 1 ? 'disabled' : '') +
    '>›</button></div>'
  );
}

const daily = () => link('E19', 'Défi du jour');
const continueQuest = () =>
  '<button type="button" class="preview-primary" data-resume>Reprendre la quête ' +
  resumeQuest.ordinal +
  '</button>';

function adventure() {
  const quests = packQuests();
  const progress =
    state === 'E06'
      ? {
          ...seed,
          solved: { ...seed.solved },
          canonicalQuestState: { ...seed.canonicalQuestState },
        }
      : seed;
  if (state === 'E06') {
    for (const quest of quests) {
      if (quest.legacyIndex === null) {
        progress.canonicalQuestState[quest.id] = {
          ...progress.canonicalQuestState[quest.id],
          solved: true,
        };
      } else {
        progress.solved[quest.legacyIndex] = true;
      }
    }
  }
  const stats = celestialScope(progress, quests);
  const percent = completion(stats);
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
      const mark = { mastered: '✦', complete: '✓', active: '◐', new: '○' }[code];
      const cardPercent = completion(value);
      return (
        '<button type="button" data-constellation="' +
        index +
        (pack().accessible ? '' : '" data-pack-locked="true') +
        '" data-state="' +
        code +
        '" style="--card-progress:' +
        parseInt(cardPercent, 10) +
        '%"><span class="card-symbol">' +
        (badgeView ? badgeTotal(value) : figure(entry, value, 'figure')) +
        '</span><span class="card-copy"><strong class="card-name">' +
        esc(entry.label) +
        '</strong><span class="card-state">' +
        '<span aria-hidden="true">' +
        (pack().accessible ? mark : '🔒') +
        '</span> ' +
        (pack().accessible ? label : 'Verrouillée') +
        '</span></span><strong class="card-percent" aria-label="' +
        cardPercent +
        ' pour cent de complétion">' +
        cardPercent +
        ' %</strong>' +
        (badgeView ? counts(items, value, false) : '') +
        '</button>'
      );
    })
    .join('');
  return (
    '<section class="adventure-summary"><div class="screen-heading"><h1>' +
    esc(adventureDisplayName(pack(), t)) +
    '</h1>' +
    arrows(packIndex, 'Aventure') +
    '</div>' +
    (pack().accessible ? '' : '<span class="access-label">🔒 Verrouillée</span>') +
    '<div class="adventure-totals"><span>' +
    stats.completed +
    '/' +
    stats.total +
    ' quêtes · ' +
    stats.earned +
    '/' +
    stats.possible +
    ' badges</span><strong aria-label="' +
    percent +
    ' pour cent de complétion globale">' +
    percent +
    ' %</strong></div><progress aria-label="Complétion globale de l’aventure" max="100" value="' +
    percent +
    '"></progress>' +
    (badgeView ? counts(quests, stats) : '') +
    '</section><div class="sky-actions">' +
    (pack().accessible
      ? continueQuest()
      : '<span class="locked-adventure-actions">' + lockedAdventureAction() + '</span>') +
    daily() +
    '</div>' +
    '<div class="sky-section-heading"><h2>Constellations</h2>' +
    '<button type="button" class="subtle-action" data-badges aria-pressed="' +
    badgeView +
    '">Badges</button></div>' +
    '<div id="constellations" class="' +
    (badgeView ? 'show-badges' : '') +
    '">' +
    cards +
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
    const access = questAccess(quest);
    const available = access.status === 'ready';
    const prerequisite = catalogue.find((item) => item.id === access.questId);
    const prerequisiteGroup =
      prerequisite && prerequisite.constellationId !== entry.id
        ? pack().constellations.find((item) => item.id === prerequisite.constellationId)
        : null;
    const label = available ? (record ? record.bestSeconds + ' s' : 'À jouer') : '🔒 Verrouillée';
    return (
      '<button type="button" class="quest-row" data-quest="' +
      esc(quest.id) +
      '" data-filtered="' +
      filtered +
      '" data-access="' +
      access.status +
      '"' +
      (prerequisite
        ? ' aria-controls="quest-lock-' + esc(quest.id) + '" aria-expanded="false"'
        : '') +
      (access.status === 'pack-locked' ? ' disabled' : '') +
      '><strong>Q' +
      quest.position +
      '</strong><span>' +
      label +
      '</span>' +
      questBadges(record) +
      '</button>' +
      (prerequisite
        ? '<p class="quest-lock-note" id="quest-lock-' +
          esc(quest.id) +
          '" hidden>Résous la quête ' +
          prerequisite.position +
          (prerequisiteGroup ? ' (' + esc(prerequisiteGroup.label) + ')' : '') +
          ' pour débloquer celle-ci.</p>'
        : '')
    );
  });
  return (
    '<div class="detail-adventure"><div><strong>' +
    esc(adventureDisplayName(pack(), t)) +
    '</strong>' +
    (pack().accessible ? '' : '<span class="access-label">🔒 Verrouillée</span>') +
    '</div>' +
    arrows(packIndex, 'Aventure') +
    '</div>' +
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
    (pack().accessible
      ? ''
      : '<div class="preview-cta locked-adventure-actions">' + lockedAdventureAction() + '</div>') +
    '<div class="detail-tools">' +
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
    '</p></section>'
  );
}

function play() {
  const entry = packs
    .flatMap((item) => item.constellations)
    .find((item) => item.id === resumeQuest.constellationId);
  return (
    '<section class="preview-panel"><h1>Jouer</h1><p>' +
    esc(entry?.label) +
    ' · Quête ' +
    resumeQuest.ordinal +
    '</p></section><div class="preview-cta">' +
    continueQuest() +
    daily() +
    '</div>'
  );
}

// D21/D22 (28/11): one Classements screen, production components. Two toggles:
// Aventure / Défi du jour, then Général / Mes amis. Adventure: podium, « Ta position »,
// « Voir autour de ma position » (±5, rankWindow). Défi: the production daily board.
let rankingMode = 'adventure';
let rankingScope = 'general';
let rankingAround = false;
const rivals = ['Loutre', 'Anupon', 'Badoune', 'Léna', 'Van', 'Axelle', 'Tom', 'Ama', 'Celine', 'Rocky45',
  'Fanab', 'Nono77', 'Rrrrrr', 'Nopuna2', 'Frodimus', 'Renomyke', 'Anup14', 'Nopuna-l1', 'Mia', 'Hugo',
  'Zoé', 'Lucas', 'Inès', 'Noé'];
function adventureBoard() {
  const friends = rankingScope === 'friends';
  const names = friends ? ['Loutre', 'Léna', 'Tom'] : rivals;
  const mePlace = friends ? 3 : 14;
  const total = names.length + 1;
  const rows = [];
  for (let place = 1, n = 0; place <= total; place++) {
    const mine = place === mePlace;
    rows.push({ place, position: place, mine, nickname: mine ? t('ranking.you') : names[n++],
      value: (4340 - (place - 1) * 175).toLocaleString('fr-FR') + ' pts' });
  }
  const html = htmlDocument();
  let out = createPodium(html, rows.slice(0, 3), { t }).outerHTML;
  const me = rows[mePlace - 1];
  // As in production (#1067): hidden while the unfolded list already shows my row.
  if (mePlace > 3 && !rankingAround) out += createMyPosition(html, me, { t }).outerHTML;
  if (rankingAround) {
    const { offset, limit } = rankWindow({ place: mePlace, total });
    out +=
      '<ol class="lumen-rank-list" start="' + (offset + 1) + '">' +
      rows.slice(offset, offset + limit).map((row) => createRankRow(html, row, { t }).outerHTML).join('') +
      '</ol><button type="button" class="subtle-action" data-rank-around="0">' + esc(t('groupRanking.less')) + '</button>';
  } else if (total > 3) {
    out += '<button type="button" class="subtle-action" data-rank-around="1">' +
      esc(t(mePlace > 3 ? 'groupRanking.around' : 'groupRanking.rest')) + '</button>';
  }
  return out + '<p class="daily-board-count">' + esc(total + (friends ? ' amis classés' : ' joueurs classés')) + '</p>';
}
function dailyBoard() {
  const friends = rankingScope === 'friends';
  const part = friends
    ? { participants: 4, top: [
        { rank: 1, nickname: 'Loutre', score: 41 },
        { rank: 2, nickname: 'Moi', score: 49, mine: true },
        { rank: 3, nickname: 'Léna', score: 58 }], me: { rank: 2, score: 49 } }
    : { participants: 15, top: [
        { rank: 1, nickname: 'Loutre', score: 38 },
        { rank: 2, nickname: 'Anupon', score: 41 },
        { rank: 3, nickname: 'Badoune', score: 44 }], me: { rank: 6, score: 49 } };
  return renderDailyBoard(part, { scope: rankingScope, t, formatDuration: (seconds) => seconds + ' s' });
}
function rankTabs(name, items, current) {
  return (
    '<div class="daily-tabs" role="tablist">' +
    items.map(([value, label]) =>
      '<button type="button" role="tab" data-' + name + '="' + value + '" aria-selected="' + (value === current) + '">' + esc(label) + '</button>',
    ).join('') + '</div>'
  );
}
function rankings() {
  const daily = rankingMode === 'daily';
  return (
    '<section class="preview-panel preview-rankings"><h1>Classements</h1>' +
    rankTabs('rank-mode', [['adventure', 'Aventure'], ['daily', 'Défi du jour']], rankingMode) +
    rankTabs('rank-scope', [['general', t('daily.general')], ['friends', t('daily.friends')]], rankingScope) +
    (daily
      ? '<div class="screen-heading"><h2>Défi du jour</h2></div><div class="daily-board-panel">' + dailyBoard() + '</div>' +
        '<div class="preview-cta">' + link('E19', 'Jouer au Défi') + link('E22', 'Ma semaine') + '</div>'
      : '<div class="screen-heading"><h2>' + esc(adventureDisplayName(packs[rankingIndex], t)) + '</h2>' +
        arrows(rankingIndex, 'Aventure du classement') + '</div>' + adventureBoard()) +
    '</section>'
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

// D23 (28/11): the quest ranking lives in the quest (victory and review), as in
// production: podium of the 3 best official times + « Ta position » when off it.
function questPodium(mine) {
  const times = [
    { nickname: 'Loutre', seconds: Math.max(18, mine - 9) },
    { nickname: 'Anupon', seconds: Math.max(20, mine - 5) },
    { nickname: 'Badoune', seconds: Math.max(22, mine - 2) },
    { nickname: t('ranking.you'), seconds: mine, mine: true },
    { nickname: 'Léna', seconds: mine + 6 },
    { nickname: 'Tom', seconds: mine + 14 },
  ].sort((a, b) => a.seconds - b.seconds);
  const rows = times.map((row, index) => ({ ...row, place: index + 1, position: index + 1, value: row.seconds + ' s' }));
  const html = htmlDocument();
  const me = rows.find((row) => row.mine);
  return (
    '<h2>' + esc(t('ranking.top')) + '</h2>' +
    createPodium(html, rows.slice(0, 3), { t }).outerHTML +
    (me.place > 3 ? createMyPosition(html, me, { t }).outerHTML : '') +
    '<p class="daily-board-count">' + esc(rows.length + ' joueurs classés sur cette quête') + '</p>'
  );
}

function result() {
  const quest = selectedQuest;
  const record = histories.get(quest.id);
  const next = filteredJourney
    ? nextIncompleteBadgeQuest(catalogue, quest, seed, readyQuest)
    : catalogue.find((item) => item.ordinal === quest.ordinal + 1 && readyQuest(item));
  return (
    '<section class="preview-panel"><h1>Victoire</h1><p>Quête ' +
    quest.ordinal +
    (record ? ' · ' + record.bestSeconds + ' secondes' : '') +
    '</p>' +
    questBadges(record) +
    '</section>' +
    (record ? '<section class="preview-panel quest-ranking">' + questPodium(record.bestSeconds) + '</section>' : '') +
    '<div class="preview-cta">' +
    (record ? link('E11', 'Rejouer') : '') +
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
    (state === 'E12' || state === 'E13'
      ? '<button type="button" class="preview-primary" data-back>Reprendre la partie</button>'
      : navLinks(state))
  );
}

function accountOrSocial() {
  const account = state === 'E35';
  const groups = account
    ? [
        ['Compte', ['E36', 'E37', 'E38']],
        ['Services', ['E39', 'E40', 'E49']],
      ]
    : [
        ['Amis', ['E28', 'E29']],
        ['Duels', ['E30', 'E31']],
        ['Activité', ['E33', 'E22']],
      ];
  return (
    '<h1>' +
    esc(names[state]) +
    '</h1>' +
    groups
      .map(
        ([label, items]) =>
          '<section class="preview-panel"><h2>' +
          esc(label) +
          '</h2><div class="preview-menu">' +
          items.map((route) => link(route)).join('') +
          '</div></section>',
      )
      .join('')
  );
}

function notificationInbox() {
  return (
    '<h1>Notifications</h1><ul class="preview-inbox">' +
    notifications
      .map((item) => {
        const [, label] = notificationDestinations[item.kind];
        const done = readNotifications.has(item.id);
        return (
          '<li class="preview-panel"><button type="button" class="notification-row" data-notification="' +
          esc(item.id) +
          '"><strong>' +
          esc(item.text) +
          '</strong><span>' +
          esc(done ? 'Traitée · ' + label : label) +
          ' ›</span></button></li>'
        );
      })
      .join('') +
    '</ul>'
  );
}

function notificationAction(item) {
  const decision = decisions.get(item.id);
  if (item.kind === 'challenge-result') {
    return (
      '<section class="preview-panel"><h1>Résultat du duel</h1><p>' +
      esc(item.text) +
      '</p></section>'
    );
  }
  return (
    '<section class="preview-panel"><h1>' +
    esc(names[state]) +
    '</h1><p>' +
    esc(item.text) +
    '</p>' +
    (decision
      ? '<p role="status">' +
        esc(decision === 'accept' ? 'Invitation acceptée.' : 'Invitation refusée.') +
        '</p>'
      : '<div class="preview-cta notification-actions"><button type="button" data-decision="accept" class="preview-primary">Accepter</button>' +
        '<button type="button" data-decision="decline">Refuser</button></div>') +
    '</section>'
  );
}

// D18 + D19: the shop is the production offer (#1029), rendered by the real component
// in the same frame as the app (title, adventure kicker, single offer, free exit).
function shopFrame() {
  return (
    '<div id="adventureNotice" class="adventure-notice preview-shop" role="dialog" aria-modal="true" aria-labelledby="adventureNoticeTitle">' +
    '<div><strong id="adventureNoticeTitle" tabindex="-1">' +
    esc(t('premiumShop.title')) +
    '</strong><div id="preview-shop-offer"></div>' +
    '<button type="button" id="adventureNoticeClose" data-shop-close>' +
    esc(t('store.continueFree')) +
    '</button></div></div>'
  );
}
function mountShop() {
  const target = shopPack ?? packs.find((item) => !item.accessible) ?? pack();
  const model = adventureOfferModel({
    pack: target,
    packs,
    quests: catalogue,
    progress: seed,
    signedIn: true,
    purchasesAvailable: true,
    premium: { product: 'lumen-premium', priceCents: 499 },
    t,
  });
  mountPremiumOffer(screen.querySelector('#preview-shop-offer'), model, {
    t,
    locale: 'fr',
    onBuy: () => go('E42'),
    onContinue: () => back(),
  });
}

function render() {
  const inSky = overview.has(state) || detail.has(state) || state === 'E08';
  const playing = questScreens.has(state);
  screen.classList.toggle('is-adventure', overview.has(state) || state === 'E25');
  nav.hidden = playing;
  document.querySelector('.preview-header').hidden = playing;
  if (!playing) playPreview.leave();
  document.getElementById('preview-brand-title').textContent = overview.has(state)
    ? 'Mon ciel'
    : 'LUMEN';
  const notificationButton = document.querySelector('.preview-header [data-go="E33"]');
  const count = notifications.filter((item) => !readNotifications.has(item.id)).length;
  const badge = document.getElementById('notification-count');
  notificationButton.hidden = questScreens.has(state);
  badge.hidden = !count;
  badge.textContent = count;
  notificationButton.setAttribute(
    'aria-label',
    count ? 'Notifications, ' + count + ' à consulter ou traiter' : 'Notifications',
  );
  document.querySelector('.context-back').hidden =
    overview.has(state) || ['E10', 'E25', 'E27'].includes(state);
  const tab = inSky
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
  else if (state === 'E25' || state === 'E26') {
    if (state === 'E26') rankingMode = 'daily';
    screen.innerHTML = rankings();
  }
  else if (state === 'E33') screen.innerHTML = notificationInbox();
  else if (openedNotification && notificationDestinations[openedNotification.kind][0] === state) {
    screen.innerHTML = notificationAction(openedNotification);
  } else if (state === 'E27' || state === 'E35') screen.innerHTML = accountOrSocial();
  else if (playing) {
    const daily = playRoute === 'E20';
    const quest = daily ? catalogue[6] : selectedQuest;
    const adventure = packs.find((item) => item.id === quest.packId);
    const entry = adventure?.constellations.find((item) => item.id === quest.constellationId);
    playPreview.show({
      quest,
      daily,
      panel: state === playRoute ? undefined : state,
      prefilled: !daily && quest.id === catalogue[34].id,
      label: daily ? 'Défi du jour' : 'Quête ' + quest.ordinal,
      subtitle: daily ? 'Défi commun' : (entry?.label ?? adventureDisplayName(adventure, t)),
    });
  } else if (state === 'E14') screen.innerHTML = result();
  else if (state === 'E40') {
    screen.innerHTML = shopFrame();
    mountShop();
  }
  else screen.innerHTML = reference();
}

function go(route, { replace = false, focus, scroll = true } = {}) {
  if (!routes.has(route)) return;
  state = route;
  if (route === 'E11' || route === 'E20') playRoute = route;
  const depth = history.state?.preview ? history.state.depth : 0;
  history[replace ? 'replaceState' : 'pushState'](
    {
      preview: true,
      depth: replace ? depth : depth + 1,
      route,
      packIndex,
      rankingIndex,
      constellationIndex,
      questId: selectedQuest.id,
      notificationId: openedNotification?.id,
      playRoute,
      filteredJourney,
      badgeView,
    },
    '',
    '#' + route.toLowerCase(),
  );
  render();
  (focus ? (screen.querySelector(focus) ?? screen) : screen).focus({ preventScroll: true });
  if (scroll) window.scrollTo(0, 0);
}

function advance(delta) {
  const ranking = state === 'E25';
  const inDetail = detail.has(state);
  const index = ranking ? rankingIndex : packIndex;
  const next = Math.min(packs.length - 1, Math.max(0, index + delta));
  if (next === index) return false;
  if (ranking) rankingIndex = next;
  else if (!packs[next].accessible) {
    openShop(packs[next]);
    return true;
  } else {
    packIndex = next;
    constellationIndex = 0;
  }
  go(ranking || inDetail ? state : 'E05', {
    replace: !inDetail,
    scroll: inDetail,
    focus: '[data-step="' + delta + '"]:not(:disabled)',
  });
  return true;
}

function back() {
  if (history.state?.preview && history.state.depth > 0) history.back();
  else
    go(state === 'E08' || state === 'E14' ? (filteredJourney ? 'E09' : 'E07') : 'E04', {
      replace: true,
    });
}

document.addEventListener(
  'click',
  (event) => {
    if (suppressClick && event.detail && screen.contains(event.target)) {
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-back')) {
    back();
    return;
  }
  if (button.hasAttribute('data-badges')) {
    badgeView = !badgeView;
    go(state, { replace: true, scroll: false, focus: '[data-badges]' });
    return;
  }
  if (button.hasAttribute('data-resume')) {
    selectedQuest = resumeQuest;
    filteredJourney = false;
    go('E11');
    return;
  }
  if (button.dataset.dailyDay) {
    go('E23');
    return;
  }
  if (button.dataset.notification) {
    openedNotification = notifications.find((item) => item.id === button.dataset.notification);
    if (openedNotification.kind === 'challenge-result')
      readNotifications.add(openedNotification.id);
    go(notificationDestinations[openedNotification.kind][0]);
    return;
  }
  if (button.dataset.decision && openedNotification) {
    decisions.set(openedNotification.id, button.dataset.decision);
    readNotifications.add(openedNotification.id);
    render();
    screen.focus({ preventScroll: true });
    return;
  }
  if (button.dataset.rankMode || button.dataset.rankScope || button.dataset.rankAround) {
    if (button.dataset.rankMode) rankingMode = button.dataset.rankMode;
    if (button.dataset.rankScope) rankingScope = button.dataset.rankScope;
    rankingAround = button.dataset.rankAround === '1';
    go(state, { replace: true, scroll: false });
    return;
  }
  if (button.dataset.shopPack) {
    openShop(packs.find((item) => item.id === button.dataset.shopPack));
    return;
  }
  if (button.dataset.shopClose !== undefined) {
    back();
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
  if (route) {
    if (state !== route) {
      openedNotification = undefined;
      go(route);
    }
  } else if (step) advance(Number(step));
  else if (constellation !== undefined) {
    if (!pack().accessible) {
      openShop(pack());
      return;
    }
    constellationIndex = Number(constellation);
    go('E07');
  } else if (constellationStep) {
    constellationIndex += Number(constellationStep);
    go(state, { replace: true });
  } else if (quest) {
    const target = catalogue.find((item) => item.id === quest);
    if (!target || !readyQuest(target)) {
      const reason = document.getElementById(button.getAttribute('aria-controls'));
      if (reason) {
        reason.hidden = !reason.hidden;
        button.setAttribute('aria-expanded', String(!reason.hidden));
      }
      return;
    }
    filteredJourney = filtered === 'true';
    selectedQuest = target;
    if (histories.has(quest)) go('E14');
    else {
      resumeQuest = selectedQuest;
      go('E11');
    }
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
    go(filteredJourney ? 'E09' : 'E07', { replace: true, scroll: false, focus: '[data-filter]' });
  }
});
screen.addEventListener('pointerdown', (event) => {
  suppressClick = false;
  if (event.isPrimary && event.button === 0 && screen.classList.contains('is-adventure')) {
    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
});
screen.addEventListener('pointercancel', () => {
  swipeStart = undefined;
});
screen.addEventListener('pointerup', (event) => {
  if (swipeStart?.id !== event.pointerId) return;
  const { x, y } = swipeStart;
  swipeStart = undefined;
  const dx = event.clientX - x;
  if (Math.abs(dx) > 55 && Math.abs(dx) > 1.5 * Math.abs(event.clientY - y)) {
    suppressClick = advance(Math.sign(-dx));
  }
});
const select = document.querySelector('#scenario');
for (const [key, label] of Object.entries(names)) select.add(new Option(key + ' · ' + label, key));
select.addEventListener('change', () => go(select.value));
function restore(entry) {
  if (entry?.preview) {
    ({
      route: state,
      packIndex,
      rankingIndex,
      constellationIndex,
      filteredJourney,
      badgeView,
    } = entry);
    playRoute = entry.playRoute ?? (state === 'E20' ? 'E20' : 'E11');
    selectedQuest = catalogue.find((item) => item.id === entry.questId) ?? resumeQuest;
    openedNotification = notifications.find((item) => item.id === entry.notificationId);
    render();
    (overview.has(state)
      ? (screen.querySelector('[data-constellation="' + constellationIndex + '"]') ?? screen)
      : screen
    ).focus({ preventScroll: true });
    return;
  }
  const route = location.hash.slice(1).toUpperCase();
  go(routes.has(route) ? route : 'E04', { replace: true });
}
window.addEventListener('popstate', (event) => restore(event.state));
restore(history.state);
