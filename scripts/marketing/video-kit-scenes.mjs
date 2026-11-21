// #759 · Six vertical videos from REAL Lumen grids and REAL taps.
// Coordinates are 1-based [row, column] from the top-left corner, exactly as in
// docs/marketing/KIT_VIDEOS_LUMEN.md. The recorder refuses any Guardian that is
// not in the catalogue solution and any cross placed on a solution cell.
// `pre` Guardians are placed with real taps before the recording starts.
// Actions: guardian / cross (real taps), mark / unmark (temporary visual outline
// on cells, never a game state change). Times are seconds from the start.
export const CTA_URL = 'lumen.nopuna.fr/decouvrir.html';

export const SCENES = [
 {
  id: 'A1', questId: 'base-q001', duration: 18,
  pre: [[1, 2], [2, 5], [3, 3], [4, 1]],
  actions: [
   {at: 3, type: 'mark', cells: 'row:5'}, {at: 7, type: 'mark', cells: 'col:4'},
   {at: 10.2, type: 'unmark'}, {at: 10.6, type: 'guardian', cell: [5, 4]},
  ],
  subtitles: [
   {from: 0, to: 3, fr: 'Où placer le dernier Gardien ?', en: 'Where does the last Guardian go?'},
   {from: 3, to: 7, fr: 'Une seule ligne libre.', en: 'Only one free row.'},
   {from: 7, to: 10, fr: 'Une seule colonne libre.', en: 'Only one free column.'},
   {from: 10, to: 13, fr: 'Leur intersection est dans le bon territoire.', en: 'Their crossing sits in the right territory.'},
   {from: 13, to: 15, fr: 'Grille résolue ✦', en: 'Grid solved ✦'},
   {from: 15, to: 18, fr: 'Essaie Lumen · ' + CTA_URL, en: 'Try Lumen · ' + CTA_URL},
  ],
 },
 {
  id: 'A2', questId: 'base-q002', duration: 19,
  pre: [[1, 1], [2, 3], [3, 5], [5, 4]],
  actions: [
   {at: 0.5, type: 'mark', cells: 'row:4'},
   {at: 3, type: 'unmark'}, {at: 3.2, type: 'mark', cells: 'col:1,col:3,col:4,col:5'},
   {at: 7, type: 'unmark'}, {at: 7.2, type: 'mark', cells: 'row:4'},
   {at: 11, type: 'unmark'}, {at: 11.4, type: 'guardian', cell: [4, 2]},
  ],
  subtitles: [
   {from: 0, to: 3, fr: 'Un territoire attend son Gardien.', en: 'One territory still needs its Guardian.'},
   {from: 3, to: 7, fr: 'Les quatre autres colonnes sont prises.', en: 'The other four columns are taken.'},
   {from: 7, to: 11, fr: 'Quelle colonne reste libre ?', en: 'Which column is still free?'},
   {from: 11, to: 15, fr: 'La deuxième. Il ne touche aucun Gardien.', en: 'The second one. It touches no Guardian.'},
   {from: 15, to: 19, fr: 'À toi de jouer dans Lumen · ' + CTA_URL, en: 'Your turn in Lumen · ' + CTA_URL},
  ],
 },
 {
  id: 'B1', questId: 'base-q001', duration: 20,
  pre: [],
  actions: [
   {at: 3.2, type: 'mark', cells: '3:3'}, {at: 4.6, type: 'guardian', cell: [3, 3]}, {at: 6.5, type: 'unmark'},
   {at: 7.6, type: 'cross', cell: [3, 4]}, {at: 8.8, type: 'cross', cell: [4, 4]}, {at: 10, type: 'cross', cell: [5, 3]},
   {at: 12.4, type: 'mark', cells: '5:4'}, {at: 13.6, type: 'guardian', cell: [5, 4]}, {at: 15.5, type: 'unmark'},
  ],
  subtitles: [
   {from: 0, to: 3, fr: 'Une déduction en 20 secondes.', en: 'One deduction in 20 seconds.'},
   {from: 3, to: 7, fr: 'Ce territoire n’a qu’une case.', en: 'This territory has a single cell.'},
   {from: 7, to: 12, fr: 'Retire la ligne, la colonne et les cases qui touchent.', en: 'Rule out its row, its column and the touching cells.'},
   {from: 12, to: 16, fr: 'Dans ce territoire, il reste une seule case.', en: 'Only one cell is left in this territory.'},
   {from: 16, to: 20, fr: 'Essaie la suite dans Lumen · ' + CTA_URL, en: 'Solve the rest in Lumen · ' + CTA_URL},
  ],
 },
 {
  id: 'B2', questId: 'base-q002', duration: 21,
  pre: [],
  actions: [
   {at: 3.2, type: 'mark', cells: '1:1'}, {at: 4.4, type: 'guardian', cell: [1, 1]}, {at: 5.8, type: 'unmark'},
   {at: 6.4, type: 'cross', cell: [1, 2]}, {at: 7.1, type: 'cross', cell: [1, 3]}, {at: 7.8, type: 'cross', cell: [1, 4]},
   {at: 8.5, type: 'cross', cell: [1, 5]}, {at: 9.2, type: 'cross', cell: [2, 1]}, {at: 9.9, type: 'cross', cell: [2, 2]},
   {at: 11.4, type: 'mark', cells: '2:3'}, {at: 13, type: 'guardian', cell: [2, 3]}, {at: 15, type: 'unmark'},
  ],
  subtitles: [
   {from: 0, to: 3, fr: 'Une case suffit à débloquer la suite.', en: 'One cell is enough to unlock the rest.'},
   {from: 3, to: 6, fr: 'Ce territoire impose le coin.', en: 'This territory forces the corner.'},
   {from: 6, to: 11, fr: 'Même ligne et cases voisines interdites.', en: 'Same row and touching cells are ruled out.'},
   {from: 11, to: 17, fr: 'Il reste cette case.', en: 'This cell is the only one left.'},
   {from: 17, to: 21, fr: 'Résous la suite dans Lumen · ' + CTA_URL, en: 'Solve the rest in Lumen · ' + CTA_URL},
  ],
 },
 {
  id: 'C1', questId: 'planned-real-01-q10', duration: 24, viaSky: 'real-01',
  pre: [[1, 8], [2, 6], [3, 1], [4, 7], [5, 3], [6, 5], [7, 2]],
  actions: [{at: 8.4, type: 'mark', cells: '8:4'}, {at: 9.6, type: 'unmark'}, {at: 9.8, type: 'guardian', cell: [8, 4]}],
  subtitles: [
   {from: 0, to: 4, fr: 'Il manque une étoile au Grand Chariot.', en: 'The Big Dipper is missing one star.'},
   {from: 4, to: 9, fr: 'Dernière quête de la Grande Ourse.', en: 'Last quest of Ursa Major.'},
   {from: 9, to: 13, fr: 'Dernier Gardien.', en: 'Last Guardian.'},
   {from: 13, to: 20, fr: 'La Grande Ourse brille à nouveau.', en: 'Ursa Major shines again.'},
   {from: 20, to: 24, fr: 'Rallume le ciel dans Lumen · ' + CTA_URL, en: 'Relight the sky in Lumen · ' + CTA_URL},
  ],
 },
 {
  id: 'C2', questId: 'base-q007', duration: 22,
  pre: [[1, 1], [2, 3], [3, 6], [4, 4], [5, 2]],
  actions: [{at: 8.4, type: 'mark', cells: '6:5'}, {at: 9.6, type: 'unmark'}, {at: 9.8, type: 'guardian', cell: [6, 5]}],
  subtitles: [
   {from: 0, to: 4, fr: 'Après la Grande Ourse, place à Cassiopée.', en: 'After Ursa Major, here comes Cassiopeia.'},
   {from: 4, to: 9, fr: 'Une nouvelle grille, une première étoile.', en: 'A new grid, a first star.'},
   {from: 9, to: 13, fr: 'Dernier Gardien !', en: 'Last Guardian!'},
   {from: 13, to: 18, fr: 'La première étoile s’allume.', en: 'The first star lights up.'},
   {from: 18, to: 22, fr: 'Découvre ton ciel dans Lumen · ' + CTA_URL, en: 'Discover your sky in Lumen · ' + CTA_URL},
  ],
 },
];

const pad = n => String(n).padStart(2, '0');
const stamp = s => { const ms = Math.round(s * 1000); return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' + pad(Math.floor(ms / 1000) % 60) + ',' + String(ms % 1000).padStart(3, '0'); };
export function srt(scene, locale) {
 return scene.subtitles.map((s, i) => (i + 1) + '\n' + stamp(s.from) + ' --> ' + stamp(s.to) + '\n' + s[locale] + '\n').join('\n');
}

// Pure checks against the real catalogue solution (sol[row] = column, 0-based).
export function validateScene(scene, quest) {
 const errors = [], sol = quest?.sol;
 if (!Array.isArray(sol)) return ['unknown quest ' + scene.questId];
 const inSolution = ([r, c]) => sol[r - 1] === c - 1;
 for (const cell of scene.pre) if (!inSolution(cell)) errors.push(scene.id + ': pre Guardian ' + cell + ' is not in the solution');
 for (const a of scene.actions) {
  if (a.type === 'guardian' && !inSolution(a.cell)) errors.push(scene.id + ': Guardian ' + a.cell + ' is not in the solution');
  if (a.type === 'cross' && inSolution(a.cell)) errors.push(scene.id + ': cross ' + a.cell + ' hides a solution cell');
 }
 const guardians = scene.pre.length + scene.actions.filter(a => a.type === 'guardian').length;
 if (scene.id.startsWith('A') || scene.id.startsWith('C')) if (guardians !== sol.length) errors.push(scene.id + ': the final pose must complete the grid');
 for (const s of scene.subtitles) if (!(s.fr && s.en && s.to > s.from && s.to <= scene.duration)) errors.push(scene.id + ': bad subtitle ' + JSON.stringify(s));
 return errors;
}
