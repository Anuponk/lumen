// #1057 · Copy of the public mini-puzzle (FR/EN/ES). Kept apart from the app
// catalogues (src/ui/locales, ~540 KB) so the social landing stays light; same
// {name} placeholders and plural objects as src/ui/i18n.js.
export const MINI_LOCALES = Object.freeze({
  fr: {
    'mini.kicker': 'Mini-puzzle du jour',
    'mini.advent': 'Calendrier de l’Avent · case {door}',
    'mini.title': 'Placez le dernier Gardien',
    'mini.titleMany': {
      one: 'Placez le dernier Gardien',
      other: 'Placez les {count} derniers Gardiens',
    },
    'mini.rules': 'Un Gardien par ligne, par colonne et par territoire de couleur. Deux Gardiens ne se touchent jamais, même en diagonale.',
    'mini.howTo': 'Touchez une case : une croix pour l’écarter, puis un Gardien ✦, puis elle redevient vide.',
    'mini.remaining': {
      one: 'Encore {count} Gardien à placer',
      other: 'Encore {count} Gardiens à placer',
    },
    'mini.conflict': 'Deux Gardiens se gênent : même ligne, même colonne, même territoire ou cases voisines.',
    'mini.reset': 'Recommencer',
    'mini.winTitle': 'Constellation rallumée !',
    'mini.winText': 'Bravo, la grille est résolue. {constellation} brille de nouveau.',
    'mini.winGeneric': 'Bravo, la grille est résolue.',
    'mini.ctaDiscover': 'Découvrir LUMEN',
    'mini.ctaDiscoverNote': '100 quêtes gratuites, sans publicité',
    'mini.ctaInstall': 'Installer l’application',
    'mini.ctaOfficial': 'Relever le Défi du jour officiel',
    'mini.noAccount': 'Sans compte ni installation. Votre progression reste sur cet appareil.',
    'mini.locked': 'Cette case s’ouvre le {date}.',
    'mini.unavailable': 'Aucun mini-puzzle n’est prévu ce jour-là.',
    'mini.paused': 'Les mini-puzzles sont en pause. Revenez bientôt !',
    'mini.today': 'Mini-puzzle du jour',
    'mini.archive': 'Jours précédents',
    'mini.done': 'Résolu',
    'mini.share': 'Partager ce mini-puzzle',
    'mini.shareText': 'Saurez-vous placer le dernier Gardien ? Mini-puzzle LUMEN du {date}.',
    'mini.copied': 'Lien copié',
    'mini.cell': 'Ligne {row}, colonne {col}',
    'mini.cellGiven': 'Ligne {row}, colonne {col} : Gardien déjà placé',
    'mini.cellGuardian': 'Ligne {row}, colonne {col} : Gardien',
    'mini.cellCross': 'Ligne {row}, colonne {col} : écartée',
    'mini.timeZone': 'Date de Paris',
    'mini.calendarTitle': 'Le calendrier de l’Avent LUMEN',
    'mini.calendarIntro': 'Une case par jour, du 1er au 24 décembre : un mini-puzzle à résoudre en une minute.',
  },
  en: {
    'mini.kicker': 'Daily mini-puzzle',
    'mini.advent': 'Advent calendar · door {door}',
    'mini.title': 'Place the last Guardian',
    'mini.titleMany': {
      one: 'Place the last Guardian',
      other: 'Place the last {count} Guardians',
    },
    'mini.rules': 'One Guardian per row, per column and per coloured territory. Two Guardians never touch, not even diagonally.',
    'mini.howTo': 'Tap a cell: a cross to rule it out, then a Guardian ✦, then it is empty again.',
    'mini.remaining': {
      one: '{count} Guardian left to place',
      other: '{count} Guardians left to place',
    },
    'mini.conflict': 'Two Guardians clash: same row, same column, same territory or touching cells.',
    'mini.reset': 'Start again',
    'mini.winTitle': 'Constellation relit!',
    'mini.winText': 'Well done, the grid is solved. {constellation} shines again.',
    'mini.winGeneric': 'Well done, the grid is solved.',
    'mini.ctaDiscover': 'Discover LUMEN',
    'mini.ctaDiscoverNote': '100 free quests, no ads',
    'mini.ctaInstall': 'Install the app',
    'mini.ctaOfficial': 'Take the official Daily Challenge',
    'mini.noAccount': 'No account, no install. Your progress stays on this device.',
    'mini.locked': 'This door opens on {date}.',
    'mini.unavailable': 'No mini-puzzle is planned for that day.',
    'mini.paused': 'Mini-puzzles are on a break. Come back soon!',
    'mini.today': 'Today’s mini-puzzle',
    'mini.archive': 'Previous days',
    'mini.done': 'Solved',
    'mini.share': 'Share this mini-puzzle',
    'mini.shareText': 'Can you place the last Guardian? LUMEN mini-puzzle of {date}.',
    'mini.copied': 'Link copied',
    'mini.cell': 'Row {row}, column {col}',
    'mini.cellGiven': 'Row {row}, column {col}: Guardian already placed',
    'mini.cellGuardian': 'Row {row}, column {col}: Guardian',
    'mini.cellCross': 'Row {row}, column {col}: ruled out',
    'mini.timeZone': 'Paris date',
    'mini.calendarTitle': 'The LUMEN Advent calendar',
    'mini.calendarIntro': 'One door a day, from 1 to 24 December: a one-minute mini-puzzle.',
  },
  es: {
    'mini.kicker': 'Minipuzle del día',
    'mini.advent': 'Calendario de Adviento · casilla {door}',
    'mini.title': 'Coloca el último Guardián',
    'mini.titleMany': {
      one: 'Coloca el último Guardián',
      other: 'Coloca los {count} últimos Guardianes',
    },
    'mini.rules': 'Un Guardián por fila, por columna y por territorio de color. Dos Guardianes nunca se tocan, ni siquiera en diagonal.',
    'mini.howTo': 'Toca una casilla: una cruz para descartarla, luego un Guardián ✦ y después vuelve a quedar vacía.',
    'mini.remaining': {
      one: 'Queda {count} Guardián por colocar',
      other: 'Quedan {count} Guardianes por colocar',
    },
    'mini.conflict': 'Dos Guardianes chocan: misma fila, misma columna, mismo territorio o casillas vecinas.',
    'mini.reset': 'Empezar de nuevo',
    'mini.winTitle': '¡Constelación encendida!',
    'mini.winText': 'Muy bien, la cuadrícula está resuelta. {constellation} vuelve a brillar.',
    'mini.winGeneric': 'Muy bien, la cuadrícula está resuelta.',
    'mini.ctaDiscover': 'Descubrir LUMEN',
    'mini.ctaDiscoverNote': '100 misiones gratis y sin anuncios',
    'mini.ctaInstall': 'Instalar la aplicación',
    'mini.ctaOfficial': 'Aceptar el Desafío del día oficial',
    'mini.noAccount': 'Sin cuenta ni instalación. Tu progreso se queda en este dispositivo.',
    'mini.locked': 'Esta casilla se abre el {date}.',
    'mini.unavailable': 'No hay ningún minipuzle previsto ese día.',
    'mini.paused': 'Los minipuzles están en pausa. ¡Vuelve pronto!',
    'mini.today': 'Minipuzle del día',
    'mini.archive': 'Días anteriores',
    'mini.done': 'Resuelto',
    'mini.share': 'Compartir este minipuzle',
    'mini.shareText': '¿Sabrás colocar el último Guardián? Minipuzle LUMEN del {date}.',
    'mini.copied': 'Enlace copiado',
    'mini.cell': 'Fila {row}, columna {col}',
    'mini.cellGiven': 'Fila {row}, columna {col}: Guardián ya colocado',
    'mini.cellGuardian': 'Fila {row}, columna {col}: Guardián',
    'mini.cellCross': 'Fila {row}, columna {col}: descartada',
    'mini.timeZone': 'Fecha de París',
    'mini.calendarTitle': 'El calendario de Adviento LUMEN',
    'mini.calendarIntro': 'Una casilla al día, del 1 al 24 de diciembre: un minipuzle de un minuto.',
  },
});

// Same resolution order as the app (manual choice stored as `lumen.locale`, then
// the browser), restricted to the three supported languages; French by default.
export function miniLocale({ storage, navigator, search = '' } = {}) {
  const pick = (value) => {
    const base = String(value || '').toLowerCase().split(/[-_]/)[0];
    return Object.hasOwn(MINI_LOCALES, base) ? base : null;
  };
  const fromQuery = pick(new URLSearchParams(search).get('lang'));
  if (fromQuery) return fromQuery;
  try {
    const stored = pick(storage?.getItem('lumen.locale'));
    if (stored) return stored;
  } catch {}
  for (const language of navigator?.languages || [navigator?.language]) {
    const found = pick(language);
    if (found) return found;
  }
  return 'fr';
}

export function miniTranslator(locale) {
  const code = Object.hasOwn(MINI_LOCALES, locale) ? locale : 'fr';
  const number = new Intl.NumberFormat(code);
  return (key, params = {}) => {
    const entry = MINI_LOCALES[code][key] ?? MINI_LOCALES.fr[key] ?? '';
    const pattern =
      typeof entry === 'string' ? entry : (entry[new Intl.PluralRules(code).select(params.count)] ?? entry.other);
    return pattern.replace(/\{(\w+)\}/g, (_, name) => {
      const value = params[name];
      return typeof value === 'number' ? number.format(value) : String(value ?? '');
    });
  };
}
