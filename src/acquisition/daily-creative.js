import {canonicalQuestAtGridRevision} from '../campaign/canonical-quests.js';
import {dailyPresentation} from '../campaign/seasonal-events.js';
import {TERRITORY_COLORS} from './mini-game.js';
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

export function composition(post, { schedule }) {
  const daily = schedule.days.find((e) => e.day === post.day);
  const quest = canonicalQuestAtGridRevision(daily.questId, daily.gridRevision);
  return {
    file: 'official-' + post.day + '.jpg',
    kicker: dailyPresentation(post.day).title + ' · ' + frDay(post.day),
    hook: 'Une grille, une seule tentative officielle',
    sub: 'Qui fera le meilleur temps aujourd’hui ?',
    cta: 'Relever le défi dans LUMEN',
    board: boardSvg(quest.reg, [], { frame: '#c9a24a' }),
    gold: !!dailyPresentation(post.day).event,
    decoration: dailyPresentation(post.day).event?.skin.decoration??'',
  };
}
