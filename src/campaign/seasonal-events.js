// Presentation only. Shared verbatim by the game, Studio, Node exports and Edge.
// Civil dates are inclusive/exclusive in the configured timezone. No game IDs,
// attempts, player state or network access belong in this catalogue.
export const SEASONAL_EVENTS = Object.freeze([
  Object.freeze({
    id: 'advent-2026', enabled: true,
    start: '2026-12-01', end: '2026-12-25', timeZone: 'Europe/Paris',
    labels: {
      fr: { title: "Défi de l’Avent", celebration: 'Une nouvelle étoile pour les fêtes !', day: 'Jour {day}/24', preview: 'Démonstration' },
      en: { title: 'Advent Challenge', celebration: 'A new star for the holidays!', day: 'Day {day}/24', preview: 'Demonstration' },
      es: { title: 'Reto de Adviento', celebration: '¡Una nueva estrella para las fiestas!', day: 'Día {day}/24', preview: 'Demostración' },
    },
    skin: { id: 'winter-stars', accent: '#e8cd8d', decoration: '✧', background: '#163c3a' },
    marketing: { campaign: 'avent_2026', hashtags: '#Lumen #DefiDeLAvent #JeuDeLogique #Puzzle' },
  }),
]);

export function validDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
export function civilDay(instant = new Date(), timeZone = 'Europe/Paris') {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}
export function eventForDay(day, events = SEASONAL_EVENTS) {
  if (!validDay(day)) return null;
  return events.find(event => event.enabled && day >= event.start && day < event.end) ?? null;
}
export function activeEvent(instant = new Date(), events = SEASONAL_EVENTS) {
  return events.find(event => event.enabled && eventForDay(civilDay(instant, event.timeZone), [event])) ?? null;
}
export function eventLabels(event, locale = 'fr') {
  return event?.labels[locale.split('-')[0]] ?? event?.labels.fr ?? null;
}
export const DAILY_NAMES = Object.freeze({ fr: 'Défi du jour', en: 'Daily Challenge', es: 'Reto del día' });
export function dailyPresentation(day, locale = 'fr') {
  const event = eventForDay(day), labels = eventLabels(event, locale);
  const index = event ? Math.round((Date.parse(day) - Date.parse(event.start)) / 864e5) + 1 : null;
  return { event, title: labels?.title ?? DAILY_NAMES[locale] ?? DAILY_NAMES.fr,
    celebration: labels?.celebration ?? '', previewLabel: labels?.preview??'', dayLabel: labels?.day.replace('{day}', index) ?? '',
    campaign: event?.marketing.campaign ?? 'daily_' + day,
    hashtags: event?.marketing.hashtags ?? '#Lumen #DefiDuJour #JeuDeLogique #Puzzle' };
}

// Restrict replacements to current daily surfaces, never campaign or historical
// weekly copy. Rules, score and date parameters still come from their owners.
export function seasonalMessageKey(key) {
  return /^(daily\.(title|chip|chipOpenLabel|chipDoneLabel|pushSchedule|boards|complete)|social\.(daily|dailyRankings|openDaily|rankingsHint)|board\.(dailyRollover|abandonDailyCopy|abandonConfirmDaily))$/.test(key);
}
export function seasonalCopy(text, key, day, locale = 'fr') {
  if (!seasonalMessageKey(key)) return text;
  const presentation = dailyPresentation(day, locale);
  if (!presentation.event) return text;
  // Keep the heading to the event name. A success glyph changes fallback-font
  // line metrics on some devices; the result note already confirms completion.
  // The celebration remains available separately without increasing card height.
  if(key==='daily.complete')return presentation.title;
  const result=text.replace(/Défi du jour|défi du jour|Daily [Cc]hallenge|daily challenge|Reto del día|reto del día|Desafío del día/g, presentation.title);
  return result;
}
