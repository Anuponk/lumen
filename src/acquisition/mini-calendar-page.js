// #1057 · /mini/ : today's mini-puzzle, the LUMEN Advent calendar (1–24 December)
// and the previous days. Doors open on the Paris date; future doors stay closed.
import { adventDoor, openDays, parisDay } from './mini-puzzle.js';
import { miniLocale, miniTranslator } from './locales.js';

const DONE_KEY = 'lumenMiniDoneV1';

export function calendarView(calendar, today, done = new Set()) {
  const open = new Set(openDays(calendar, today));
  const days = calendar.days || [];
  const advent = days
    .filter((e) => adventDoor(e.day))
    .map((e) => ({ day: e.day, door: adventDoor(e.day), open: open.has(e.day), done: done.has(e.day) }));
  const previous = days
    .filter((e) => open.has(e.day) && e.day < today && !adventDoor(e.day))
    .map((e) => e.day)
    .reverse()
    .slice(0, 30);
  return { today: open.has(today) ? today : null, advent, previous };
}

export function mountMiniCalendar(root, { calendar, win = globalThis.window, now = () => new Date() } = {}) {
  const doc = root.ownerDocument;
  let storage = null;
  try {
    storage = win.localStorage;
  } catch {}
  const locale = miniLocale({ storage, navigator: win.navigator, search: win.location?.search || '' });
  const t = miniTranslator(locale);
  doc.documentElement.lang = locale;
  let done = new Set();
  try {
    done = new Set(JSON.parse(storage?.getItem(DONE_KEY) || '[]'));
  } catch {}
  const today = parisDay(now());
  const view = calendarView(calendar, today, done);
  const fmt = (day) => {
    const [y, m, d] = day.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y, m - 1, d)),
    );
  };
  const set = (id, value) => {
    const node = doc.getElementById(id);
    if (node) node.textContent = value;
  };
  set('mini-calendar-title', t('mini.calendarTitle'));
  set('mini-calendar-intro', t('mini.calendarIntro'));
  set('mini-archive-title', t('mini.archive'));
  const todayLink = doc.getElementById('mini-today');
  if (!calendar.enabled) {
    todayLink.removeAttribute('href');
    todayLink.textContent = t('mini.paused');
  } else if (view.today) {
    todayLink.href = '/mini/' + view.today + '.html' + (win.location?.search || '');
    todayLink.textContent = t('mini.today');
  } else {
    todayLink.removeAttribute('href');
    todayLink.textContent = t('mini.unavailable');
  }
  const doors = doc.getElementById('mini-doors');
  doors.replaceChildren();
  for (const door of view.advent) {
    const item = doc.createElement(door.open ? 'a' : 'span');
    item.className = 'mini-door' + (door.open ? ' open' : '') + (door.done ? ' done' : '');
    item.textContent = String(door.door);
    if (door.open) {
      item.href = '/mini/' + door.day + '.html';
      item.setAttribute('aria-label', fmt(door.day) + (door.done ? ' · ' + t('mini.done') : ''));
    } else {
      item.setAttribute('aria-label', t('mini.locked', { date: fmt(door.day) }));
      item.title = t('mini.locked', { date: fmt(door.day) });
    }
    doors.append(item);
  }
  const list = doc.getElementById('mini-previous');
  list.replaceChildren();
  for (const day of view.previous) {
    const li = doc.createElement('li');
    const a = doc.createElement('a');
    a.href = '/mini/' + day + '.html';
    a.textContent = fmt(day) + (done.has(day) ? ' · ' + t('mini.done') : '');
    li.append(a);
    list.append(li);
  }
  doc.getElementById('mini-archive').hidden = !view.previous.length;
  return { locale, view };
}

if (globalThis.document?.getElementById('mini-calendar-data') && !globalThis.__LUMEN_MINI_TEST__) {
  const calendar = JSON.parse(document.getElementById('mini-calendar-data').textContent);
  mountMiniCalendar(document.getElementById('mini-calendar'), { calendar });
}
