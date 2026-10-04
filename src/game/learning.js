// The coach reads the real board. It never places a Guardian or an exclusion.
export function exclusionGroups(puzzle, state, [row, col]) {
  const size = state.length;
  const groups = { row: [], column: [], neighbors: [], territory: [] };
  const seen = new Set([`${row},${col}`]);
  const add = (group, r, c) => {
    const key = `${r},${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (state[r][c] === 0) groups[group].push([r, c]);
  };
  for (let c = 0; c < size; c++) add('row', row, c);
  for (let r = 0; r < size; r++) add('column', r, col);
  for (let r = Math.max(0, row - 1); r <= Math.min(size - 1, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(size - 1, col + 1); c++) add('neighbors', r, c);
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (puzzle.reg[r][c] === puzzle.reg[row][col]) add('territory', r, c);
    }
  }
  return groups;
}

export function learningStep(puzzle, state) {
  const order = puzzle.learnOrder;
  if (!order || state.flat().filter(value => value === 2).length === state.length) {
    return { phase: 'complete', cells: [], number: state.length };
  }
  for (let index = 0; index < order.length; index++) {
    const target = order[index];
    const number = index + 1;
    if (state[target[0]][target[1]] !== 2) {
      return { phase: 'place', target, territory: puzzle.reg[target[0]][target[1]], cells: [target], number };
    }
    const groups = exclusionGroups(puzzle, state, target);
    if (index === 0) {
      for (const phase of ['row', 'column', 'neighbors', 'territory']) {
        if (groups[phase].length) return { phase, source: target, cells: groups[phase], number };
      }
    } else if (index === 1) {
      // Reserve the two adjacent bottom-left cells for the real drag gesture.
      const strip = [[4, 0], [4, 1]];
      const cells = Object.values(groups).flat().filter(([r, c]) => !strip.some(([y, x]) => r === y && c === x));
      if (cells.length) return { phase: 'reuse', source: target, cells, number };
      const remaining = strip.filter(([r, c]) => state[r][c] === 0);
      if (remaining.length) return { phase: 'drag', source: target, cells: remaining, number };
    } else {
      const cells = Object.values(groups).flat();
      if (cells.length) return { phase: 'practice', source: target, cells, number };
    }
  }
  return { phase: 'complete', cells: [], number: state.length };
}

export function learningAllows(step, row, col) {
  return step.cells.some(([r, c]) => r === row && c === col);
}

export function learningCopy(step, state, coarse = false) {
  if (step.phase === 'place') {
    const marked = state[step.target[0]][step.target[1]] === 1;
    if (step.number === 1) return {
      title: marked ? 'Encore une fois…' : 'Un territoire, un Gardien',
      copy: marked ? 'La croix écarte une case. Touche-la encore pour y poser ton premier Gardien.' : 'Chaque territoire doit contenir un Gardien. Celui du centre n’a qu’une case : touche-la deux fois. La première pose une croix, la seconde un Gardien.'
    };
    return {
      title: marked ? 'Pose son Gardien' : step.number === 2 ? 'À toi de déduire' : 'Observe ce territoire',
      copy: marked ? 'Encore un toucher pour passer de la croix au Gardien.' : step.number === 2 ? 'Regarde ce territoire : toutes ses cases sauf une sont impossibles. Où doit aller son Gardien ?' : step.number === 3 ? 'Une seule case reste possible dans ce territoire. À toi de la trouver et de poser son Gardien.' : 'Quel emplacement reste possible dans ce territoire ? Applique ce que tu viens d’apprendre.'
    };
  }
  const text = {
    row: ['Un seul Gardien par ligne', 'La croix signifie « impossible ». Touche une fois chacune des autres cases de cette ligne pour les écarter.'],
    column: ['Même règle pour la colonne', 'Un seul Gardien par colonne. Écarte ses autres cases, une par une.'],
    neighbors: ['Même en diagonale', 'Deux Gardiens ne peuvent pas se toucher. Écarte les cases voisines encore libres, diagonales comprises.'],
    territory: ['Ce territoire a son Gardien', 'Écarte les autres cases de ce territoire.'],
    reuse: ['Bien déduit ! À toi de réutiliser les règles', 'Ce deuxième Gardien élimine de nouvelles cases : ligne, colonne, voisins et territoire. Marque les cases éclairées.'],
    drag: ['Va plus vite avec le glissé', (coarse ? 'Maintiens le doigt et glisse' : 'Maintiens le clic et glisse') + ' sur les deux cases éclairées. C’est le même geste dans toutes les quêtes. Tu peux aussi les toucher une par une.'],
    practice: ['À toi de poursuivre', 'Écarte les cases devenues impossibles grâce à ce Gardien, puis cherche la prochaine déduction.']
  }[step.phase];
  return text ? { title: text[0], copy: text[1] } : { title: '', copy: '' };
}
