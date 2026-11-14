// #682: one shared victory celebration for every quest (first quests, advanced
// quests, replays, future adventures). Presentation only: nothing here validates
// a victory, a record, a rank or a reward. Callers pass already-confirmed facts.

// Central, tunable calibration. Levels are a product proposal, not fixed values.
export const CELEBRATION_CONFIG = Object.freeze({
  levels: Object.freeze({
    1: Object.freeze({ particles: 14, duration: 2600, palette: ['#68e7ff', '#5ea7ff', '#bfefff'] }),
    2: Object.freeze({
      particles: 26,
      duration: 3000,
      palette: ['#68e7ff', '#5ea7ff', '#8b7cff', '#67d8c2', '#d7f8ff', '#ffd36b'],
    }),
    3: Object.freeze({
      particles: 40,
      duration: 3400,
      palette: ['#e8eef6', '#b9c3d0', '#d58a52', '#f2b483', '#68e7ff', '#8b7cff'],
    }),
    4: Object.freeze({
      particles: 60,
      duration: 3800,
      halo: true,
      palette: ['#ffd36b', '#ffb347', '#ff8fb1', '#68e7ff', '#8b7cff', '#67d8c2', '#ffffff'],
    }),
  }),
  // Constellation/adventure completion adds a celestial accent, never a second rain.
  special: Object.freeze({ extraParticles: 12, palette: ['#d7f8ff', '#87bfff', '#fff3c4'] }),
  smallScreenFactor: 0.7,
});

export const REWARD_SLOTS = Object.freeze([
  Object.freeze({ key: 'star', icon: '✦', label: 'Étoile' }),
  Object.freeze({ key: 'autonomy', icon: '🧠', label: 'Autonomie' }),
  Object.freeze({ key: 'speed', icon: '⚡', label: 'Rapidité' }),
  Object.freeze({ key: 'noError', icon: '✓', label: 'Sans erreur' }),
  Object.freeze({ key: 'mastery', icon: '✧', label: 'Maîtrise' }),
]);

// Five stable slots, always in the same order. "new" = earned by this run,
// "owned" = already earned earlier, "missing" = not earned (dimmed).
export function rewardSlots({ stars = 0, badges = {}, qualifying = false, prior = {} } = {}) {
  return REWARD_SLOTS.map((slot) => {
    if (slot.key === 'star') {
      const count = Number.isInteger(stars) && stars > 0 ? stars : 0;
      return {
        ...slot,
        label: count ? '+' + count + ' étoile' + (count > 1 ? 's' : '') : slot.label,
        state: count ? 'new' : 'missing',
      };
    }
    const earned = !!badges?.[slot.key],
      before = !!prior?.[slot.key];
    // Same eligibility as the historical reward list: a prior badge stays owned,
    // a badge is "new" only when this qualifying run earned it.
    const state = before ? 'owned' : earned && qualifying ? 'new' : 'missing';
    return { ...slot, state };
  });
}

// Badges that deserve level 2: a newly earned Mastery, or two new badges at once.
export function remarkableRewards(slots) {
  const fresh = slots.filter((slot) => slot.key !== 'star' && slot.state === 'new');
  return fresh.some((slot) => slot.key === 'mastery') || fresh.length >= 2;
}

const ORDINAL = { 1: '1re', 2: '2e', 3: '3e' };
export function ordinal(place) {
  return ORDINAL[place] || place + 'e';
}

// `ranking` is the confirmed server board (null while loading/unavailable).
// Rank messages are emitted only for a confirmed personal position. A podium
// that includes virtual "Échos" never claims the lead of a real ranking.
export function rankSummary(ranking) {
  if (!ranking || ranking.state !== 'ready') return { rank: null, label: '', lead: '' };
  const personal = ranking.personal;
  if (!personal || !Number.isInteger(personal.position)) return { rank: null, label: '', lead: '' };
  const top = Array.isArray(ranking.top) ? ranking.top : [];
  const withEchoes = top.some((row) => row?.virtual);
  const rank = { position: personal.position, place: personal.place ?? personal.position, withEchoes, confirmed: true };
  if (personal.position <= 3) {
    const lead =
      personal.position === 1
        ? withEchoes
          ? ''
          : 'Tu prends la tête du classement !'
        : 'Bravo, tu montes sur le podium !';
    return { rank, label: ordinal(rank.place) + ' place !', lead };
  }
  return { rank, label: 'Classement : ' + ordinal(rank.place) + ' place', lead: '' };
}

export function celebrationLevel({
  newRecord = false,
  remarkableBadges = false,
  rank = null,
  constellationCompleted = false,
} = {}) {
  let level = 1;
  if (newRecord || remarkableBadges) level = 2;
  if (rank?.confirmed && rank.position >= 1 && rank.position <= 3) {
    const real = !rank.withEchoes;
    const rankLevel = rank.position === 1 ? (real ? 4 : 3) : real ? 3 : 2;
    level = Math.max(level, rankLevel);
  }
  return { level, special: constellationCompleted ? 'constellation' : null };
}

// One particle layer inside the victory surface. It never changes layout
// (absolute layer, pointer-events none) and never blocks interactions.
export function createCelebration(
  host,
  {
    document = globalThis.document,
    reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    smallScreen = () => !!globalThis.matchMedia?.('(max-width: 700px)').matches,
    config = CELEBRATION_CONFIG,
  } = {},
) {
  let layer = null,
    current = 0,
    special = null;
  function ensureLayer() {
    if (layer?.isConnected) return layer;
    layer = document.createElement('div');
    layer.className = 'victory-celebration-layer';
    layer.setAttribute('aria-hidden', 'true');
    host.prepend(layer);
    return layer;
  }
  function burst(level, withSpecial) {
    const settings = config.levels[level];
    if (!settings) return;
    const target = ensureLayer();
    target.dataset.level = String(level);
    target.classList.toggle('victory-halo', !!settings.halo);
    const factor = smallScreen() ? config.smallScreenFactor : 1;
    const palette = withSpecial ? [...settings.palette, ...config.special.palette] : settings.palette;
    const count = Math.round((settings.particles + (withSpecial ? config.special.extraParticles : 0)) * factor);
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('i');
      particle.className = 'victory-particle' + (i % 3 === 0 ? ' round' : '');
      particle.style.left = ((i * 37 + level * 11) % 101) + '%';
      particle.style.background = palette[i % palette.length];
      particle.style.setProperty('--dur', settings.duration / 1000 + (i % 9) * 0.14 + 's');
      particle.style.setProperty('--rot', ((i * 47) % 360) + 'deg');
      particle.style.animationDelay = (i % 13) * 0.04 + 's';
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
      fragment.append(particle);
    }
    target.append(fragment);
  }
  // Starts the celebration once per victory. Returns the effective level.
  function start({ level = 1, special: kind = null } = {}) {
    clear();
    current = level;
    special = kind;
    if (!reducedMotion()) burst(level, !!kind);
    return current;
  }
  // A late confirmed rank can only raise the intensity: one extra burst, no
  // restart, no layout change, never a downgrade.
  function amplify(level) {
    if (!(level > current)) return current;
    current = level;
    if (!reducedMotion()) burst(level, false);
    return current;
  }
  function clear() {
    layer?.remove();
    layer = null;
    current = 0;
    special = null;
  }
  return { start, amplify, clear, level: () => current, special: () => special };
}
