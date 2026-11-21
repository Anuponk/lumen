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

// Quest 2 rehearses the real drag gesture, then releases the normal controls.
export function dragLearningStep(puzzle, state) {
  const target = [0, 0];
  if (state[0][0] !== 2) return {
    phase: 'place', target, territory: puzzle.reg[0][0], cells: [target], number: 1, dragLesson: true
  };
  const cells = state[0].slice(1).map((_, index) => [0, index + 1]);
  if (cells.some(([r, c]) => state[r][c] !== 1)) return {
    phase: 'drag', source: target, cells, number: 1, dragLesson: true
  };
  return { phase: 'complete', cells: [], number: 1 };
}

// #862: the territory numbers are a teaching aid of the quest-1 introduction.
// They appear only while that introduction is really on screen: an intro step
// of an active scripted lesson. A skipped tutorial (persisted flag) is not an
// active lesson, even though the in-memory intro cursor resets on reload; an
// explicit tutorial replay is. Gameplay, regions and constraints are unaffected.
export function territoryNumbersVisible({ introActive = false, scriptedActive = false } = {}) {
  return introActive === true && scriptedActive === true;
}
