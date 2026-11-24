// Player-facing presentation for the official daily run and weekly summary.
import {createTranslator} from './i18n.js';

const french = createTranslator().t;

export function escapeDaily(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
}

function dateForDay(day, locale, options) {
  const [year, month, date] = String(day).split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {...options,timeZone:'UTC'}).format(new Date(Date.UTC(year, month - 1, date, 12)));
}
export function formatDailyDate(day, locale = 'fr') {
  return dateForDay(day, locale, {weekday:'long',day:'numeric',month:'long'});
}
export function formatRemaining(ms, t = french) {
  const minutes = Math.floor(Math.max(0, Number(ms) || 0) / 60000);
  if (minutes < 1) return t('daily.lessMinute');
  const hours = Math.floor(minutes / 60);
  return hours ? t('daily.hoursMinutes',{hours,minutes:String(minutes % 60).padStart(2,'0')}) : t('daily.minutes',{count:minutes});
}
export function formatRank(rank, t = french) {
  return t('daily.ordinal',{count:rank},{type:'ordinal'});
}

const ERRORS = Object.freeze({
  account_required:'daily.errorAccount',
  nickname_required:'daily.errorNickname',
  daily_disabled:'daily.errorDisabled',
  daily_unavailable:'daily.errorUnavailable',
  cloud_unavailable:'daily.errorNetwork',
});
export function dailyErrorMessage(error, t = french) {
  const code = String(error?.message || error || '');
  return t(Object.hasOwn(ERRORS,code) ? ERRORS[code] : 'daily.errorDefault');
}

function bold(value) {
  return '<strong>' + escapeDaily(value) + '</strong>';
}

// Top three plus my position when outside the top. The rank and participant
// count still come entirely from the server. Nicknames are escaped as data.
export function renderDailyBoard(part, {scope='general',formatDuration=seconds=>seconds+' s',t=french} = {}) {
  const top = Array.isArray(part?.top) ? part.top : [], total = Number(part?.participants) || 0, me = part?.me;
  if (!total || !top.length) {
    return '<p class="daily-board-empty">' + escapeDaily(t(scope === 'friends' ? 'daily.friendsEmpty' : 'daily.generalEmpty')) + '</p>';
  }
  const row = ({rank,nickname,score,mine}) =>
    '<li class="daily-board-row' + (mine ? ' mine' : '') + '"><span class="daily-board-rank">' + escapeDaily(formatRank(rank,t)) +
    '</span><span class="daily-board-name">' + escapeDaily(mine ? t('daily.you',{name:nickname}) : nickname) +
    '</span><span class="daily-board-time">' + escapeDaily(formatDuration(score)) + '</span></li>';
  let html = '<ol class="daily-board-list">' + top.map(row).join('') + '</ol>';
  if (me && !top.some(row => row.mine)) {
    const time = formatDuration(me.score);
    const message = me.rank
      ? t('daily.yourRank',{rank:bold(formatRank(me.rank,t)),time:escapeDaily(time)})
      : escapeDaily(t('daily.yourTimeOptedOut',{time}));
    html += '<p class="daily-board-me">' + message + '</p>';
  }
  if (scope === 'friends' && total === 1 && top[0]?.mine) html += '<p class="daily-board-empty">' + escapeDaily(t('daily.friendsAlone')) + '</p>';
  return html + '<p class="daily-board-count">' + escapeDaily(t(scope === 'friends' ? 'daily.friendsCount' : 'daily.participantCount',{count:total})) + '</p>';
}

const DAY_LABELS = {
  completed:'daily.dayCompleted', abandoned:'daily.dayAbandoned', started:'daily.dayStarted',
  missed:'daily.dayMissed', future:'daily.dayFuture',
};
export function formatWeekRange(monday, sunday, {t=french,locale='fr'} = {}) {
  const shortDay = day => dateForDay(day,locale,{day:'numeric',month:'long'});
  return t('daily.weekRange',{start:shortDay(monday),end:shortDay(sunday)});
}

export function renderDailyWeek(summary, {formatDuration=seconds=>seconds+' s',t=french,locale='fr'} = {}) {
  const dayName = day => formatDailyDate(day,locale);
  const rank = value => formatRank(value,t);
  const cell = day => {
    const mark = day.state === 'completed' ? (day.podium ? '★' : '✓') : day.state === 'abandoned' ? '✕' : day.state === 'started' ? '…' : day.state === 'missed' ? '·' : '';
    const provisional = day.state === 'completed' && !day.final;
    const detail = [dayName(day.day),t(DAY_LABELS[day.state]),day.score !== null ? formatDuration(day.score) : null,
      day.generalRank ? t('daily.overallRank',{rank:rank(day.generalRank)}) : null, provisional ? t('daily.provisional') : null].filter(Boolean).join(' · ');
    return '<li class="daily-week-day ' + escapeDaily(day.state) + (day.podium ? ' podium' : '') + (provisional ? ' provisional' : '') +
      '" title="' + escapeDaily(detail) + '"><span class="daily-week-letter">' + escapeDaily(dateForDay(day.day,locale,{weekday:'narrow'})) +
      '</span><span class="daily-week-mark" aria-hidden="true">' + mark + '</span><span class="daily-sr">' + escapeDaily(detail) + '</span></li>';
  };
  const stat = (key,value) => '<div class="daily-week-stat"><dt>' + escapeDaily(t(key)) + '</dt><dd>' + value + '</dd></div>';
  const bestRank = best => {
    if (!best) return '—';
    const place = bold(rank(best.rank));
    return (best.total ? t('daily.rankOutOf',{rank:place,total:best.total}) : place) + ' · ' + escapeDaily(dayName(best.day));
  };
  const list = new Intl.ListFormat(locale);
  const highlights = summary.days.filter(day => day.podium || day.friendsWin).map(day => {
    const facts = [day.podium ? t('daily.highlightPodium',{rank:rank(day.generalRank)}) : null,day.friendsWin ? t('daily.highlightFriends') : null].filter(Boolean);
    const highlight = t('daily.highlight',{date:dayName(day.day),summary:list.format(facts)});
    return '<li>' + escapeDaily(day.final ? highlight : t('daily.highlightProvisional',{highlight})) + '</li>';
  });
  const empty = summary.participations ? '' : '<p class="daily-empty">' + escapeDaily(t(summary.openDays ? 'daily.weekEmpty' : 'daily.weekFuture')) + '</p>';
  return '<ol class="daily-week-days" aria-label="' + escapeDaily(t('daily.daysLabel')) + '">' + summary.days.map(cell).join('') + '</ol>' + empty
    + '<dl class="daily-week-stats">' + stat('daily.participations',bold(summary.participations+'/'+summary.days.length))
    + stat('daily.bestOverall',bestRank(summary.bestGeneral)) + stat('daily.bestFriends',bestRank(summary.bestFriends))
    + stat('daily.podiums',escapeDaily(summary.podiums)) + stat('daily.friendsWins',escapeDaily(summary.friendsWins))
    + stat('daily.bestTime',summary.bestTime ? bold(formatDuration(summary.bestTime.score))+' · '+escapeDaily(dayName(summary.bestTime.day)) : '—') + '</dl>'
    + (highlights.length ? '<ul class="daily-week-highlights">' + highlights.join('') + '</ul>' : '')
    + '<p class="daily-week-state">' + escapeDaily(t(summary.frozen ? 'daily.weekFrozen' : summary.provisional ? 'daily.weekProvisional' : 'daily.weekCurrent')) + '</p>';
}
