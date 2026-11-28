import { createAttemptEngine, ATTEMPT_STATES } from '../../src/game/attempt-engine.js';

const territoryColors = [
  '#46c7e8',
  '#6d8fe8',
  '#8b70d7',
  '#49b49b',
  '#d38a54',
  '#b55f86',
  '#67a6bf',
  '#7e9c69',
  '#a8875b',
];
const formatTime = (seconds) =>
  Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
const emptyBoard = (size) => Array.from({ length: size }, () => Array(size).fill(0));

export function createPlayPreview({ screen, t, go, back, onVictory }) {
  const sessions = new Map();
  let current;
  let timer;

  function leave() {
    clearInterval(timer);
    current?.engine.pause();
  }

  function sessionFor(quest, daily, prefilled) {
    const key = (daily ? 'daily:' : '') + quest.id;
    const previous = sessions.get(key);
    if (previous && previous.engine.snapshot().state !== ATTEMPT_STATES.ABANDONED) return previous;
    let offset = 0;
    const engine = createAttemptEngine({ storage: {}, perfNow: () => performance.now() + offset });
    const board = emptyBoard(quest.size);
    if (prefilled) {
      for (const row of [0, 3, 5]) board[row][quest.sol[row]] = 2;
      const column = quest.sol[0];
      for (let cell = 0; cell < quest.size; cell++) if (cell !== column) board[0][cell] = 1;
      for (const row of [1, 2, 4]) if (quest.sol[row] !== column) board[row][column] = 1;
    }
    engine.create({ questId: quest.id, board, qualifying: !daily });
    if (prefilled) {
      engine.start();
      offset = 32_000;
    }
    const session = { engine, undo: [], guided: !daily && quest.ordinal <= 5 };
    sessions.set(key, session);
    return session;
  }

  function show({ quest, daily, panel, prefilled, label, subtitle }) {
    leave();
    current = sessionFor(quest, daily, prefilled);
    const { engine, undo } = current;
    let board = engine.snapshot().board;
    if (panel) engine.pause();
    else if (engine.snapshot().state === ATTEMPT_STATES.PAUSED) engine.resume();

    screen.innerHTML = `
      <section class="play-preview">
        <header class="play-header">
          <button type="button" class="play-back" aria-label="Retour">‹</button>
          <div class="play-heading"><p></p><h1></h1></div>
          <button type="button" class="play-pause" data-go="E13">${t('board.pause')}</button>
        </header>
        <div class="play-stats">
          <span class="play-difficulty"></span>
          <span class="play-clock"><small>Chrono officiel</small><strong></strong></span>
          <span class="play-count"><small>Gardiens</small><strong></strong></span>
        </div>
        <div class="play-settings">
          <label class="play-guided"><input type="checkbox"> Contrôle guidé <small>+5 s / intervention</small></label>
          <button type="button" class="play-help" data-go="E12">Règles</button>
        </div>
        <div class="preview-board" role="group" aria-label="Grille de résolution"></div>
        <div class="play-tools" role="group" aria-label="Commandes de résolution">
          <button type="button" data-play="undo">Annuler</button>
          <button type="button" data-play="erase">Effacer</button>
          <button type="button" data-play="verify">Vérifier <small>+5 s</small></button>
          <button type="button" data-play="hint">Indice <small>+15 s</small></button>
        </div>
        <p id="play-feedback" class="play-feedback" role="status"></p>
        <dialog class="play-dialog" aria-labelledby="play-dialog-title"></dialog>
      </section>`;
    const area = screen.querySelector('.play-preview');
    const get = (selector) => area.querySelector(selector);
    get('.play-heading h1').textContent = label;
    get('.play-heading p').textContent = subtitle;
    get('.play-difficulty').textContent =
      quest.size +
      ' × ' +
      quest.size +
      (quest.difficulty?.label ? ' · ' + quest.difficulty.label : '');
    get('.play-back').addEventListener('click', back);
    const guided = get('.play-guided input');
    guided.checked = current.guided;
    guided.disabled = !daily && quest.ordinal <= 5;
    guided.addEventListener('change', () => {
      current.guided = guided.checked;
    });

    const grid = get('.preview-board');
    grid.style.gridTemplateColumns = 'repeat(' + quest.size + ', minmax(0, 1fr))';
    const cells = quest.reg.map((row, r) =>
      row.map((territory, c) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'play-cell';
        cell.style.setProperty('--territory', territoryColors[territory % territoryColors.length]);
        for (const [edge, y, x] of [
          ['top', r - 1, c],
          ['right', r, c + 1],
          ['bottom', r + 1, c],
          ['left', r, c - 1],
        ]) {
          const interior = quest.reg[y]?.[x] === territory;
          cell.style.setProperty('--edge-' + edge, interior ? '1px' : '2px');
          cell.style.setProperty(
            '--line-' + edge,
            interior ? 'var(--internal-line)' : 'var(--territory-line)',
          );
        }
        cell.addEventListener('click', () => {
          if (engine.snapshot().state === ATTEMPT_STATES.READY) engine.start();
          undo.push(board.map((line) => [...line]));
          board[r][c] = (board[r][c] + 1) % 3;
          engine.updateBoard(board);
          const conflict =
            board[r][c] === 2 &&
            current.guided &&
            board.some((line, y) =>
              line.some(
                (value, x) =>
                  value === 2 &&
                  (y !== r || x !== c) &&
                  (y === r ||
                    x === c ||
                    quest.reg[y][x] === territory ||
                    (Math.abs(y - r) <= 1 && Math.abs(x - c) <= 1)),
              ),
            );
          if (conflict) assist('guided', 'Deux Gardiens sont en conflit · +5 s');
          else feedback();
          paint();
          if (
            guardians() === quest.size &&
            quest.sol.every((column, row) => board[row][column] === 2)
          ) {
            const { assistanceUsed, mistakeCommitted } = engine.snapshot();
            const seconds = engine.officialSeconds();
            engine.complete();
            if (!daily) onVictory?.(quest, { seconds, assistanceUsed, mistakeCommitted });
            go(daily ? 'E21' : 'E14');
          }
        });
        grid.append(cell);
        return cell;
      }),
    );

    function guardians() {
      return board.reduce((count, row) => count + row.filter((value) => value === 2).length, 0);
    }

    function updateClock() {
      get('.play-clock strong').textContent = formatTime(engine.officialSeconds());
    }

    function feedback(message) {
      const status = get('#play-feedback');
      status.classList.toggle('has-message', !!message);
      status.textContent =
        message ||
        (daily
          ? '1 seul essai et même grille pour tous.'
          : engine.snapshot().assistanceUsed
            ? t('board.masteryRetry')
            : t('board.masteryActive'));
    }

    function paint() {
      cells.forEach((row, r) =>
        row.forEach((cell, c) => {
          const value = board[r][c];
          cell.dataset.mark = String(value);
          cell.setAttribute(
            'aria-label',
            'Ligne ' +
              (r + 1) +
              ', colonne ' +
              (c + 1) +
              (value ? ' · ' + t(value === 1 ? 'board.excluded' : 'board.placed') : ' · Vide'),
          );
          if (value) {
            const mark = document.createElement('span');
            mark.className = value === 2 ? 'lumen-orb' : 'lumen-dim';
            mark.setAttribute('aria-hidden', 'true');
            cell.replaceChildren(mark);
          } else cell.replaceChildren();
        }),
      );
      get('.play-count strong').textContent = guardians() + '/' + quest.size;
      get('[data-play="undo"]').disabled = !undo.length;
      updateClock();
    }

    function assist(kind, message) {
      if (engine.snapshot().state === ATTEMPT_STATES.READY) engine.start();
      engine.markAssistance();
      engine.recordAssistanceUse(kind, (engine.snapshot().helpUses?.[kind] ?? 0) + 1);
      updateClock();
      feedback(message);
    }

    function showDialog(title, copy, actions, onClose) {
      const dialog = get('dialog');
      dialog.innerHTML =
        '<h2 id="play-dialog-title"></h2><p></p><div class="play-dialog-actions"></div>';
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('p').textContent = copy;
      for (const [index, [text, action]] of actions.entries()) {
        const button = document.createElement('button');
        button.textContent = text;
        if (index === 0) button.className = 'preview-primary';
        button.addEventListener('click', action);
        dialog.querySelector('.play-dialog-actions').append(button);
      }
      dialog.oncancel = (event) => {
        if (onClose) {
          event.preventDefault();
          onClose();
        }
      };
      if (!dialog.open) dialog.showModal();
      dialog.querySelector('button').focus();
    }

    const closeDialog = () => get('dialog').close();
    const askToErase = (confirm, cancel) =>
      showDialog(
        t('board.resetTitle'),
        t('board.resetCopy'),
        [
          [t('board.resetKeep'), cancel],
          [
            t('board.resetYes'),
            () => {
              board = emptyBoard(quest.size);
              undo.length = 0;
              engine.reset(board);
              paint();
              feedback();
              confirm();
            },
          ],
        ],
        cancel,
      );
    const showPause = () =>
      showDialog(
        t('board.paused'),
        t('board.pausedCopy'),
        [
          [t('board.resume'), back],
          ['Effacer les placements', () => askToErase(back, showPause)],
          [
            'Abandonner',
            () =>
              showDialog(
                t('board.abandonConfirm'),
                daily
                  ? t('board.abandonDailyCopy')
                  : 'Cette tentative prendra fin et tu reviendras à Mon ciel.',
                [
                  ['Continuer la tentative', showPause],
                  [
                    'Abandonner la tentative',
                    () => {
                      engine.abandon();
                      go(daily ? 'E19' : 'E04');
                    },
                  ],
                ],
                showPause,
              ),
          ],
        ],
        back,
      );
    get('[data-play="undo"]').addEventListener('click', () => {
      if (!undo.length) return;
      board = undo.pop();
      engine.updateBoard(board);
      paint();
      feedback();
    });
    get('[data-play="erase"]').addEventListener('click', () =>
      askToErase(closeDialog, closeDialog),
    );
    get('[data-play="verify"]').addEventListener('click', () => {
      const mistakes = board.reduce(
        (count, row, r) =>
          count +
          row.filter(
            (value, c) =>
              (value === 2 && quest.sol[r] !== c) || (value === 1 && quest.sol[r] === c),
          ).length,
        0,
      );
      assist(
        'verify',
        (mistakes ? t('board.checkErrors', { count: mistakes }) : 'Aucune erreur détectée.') +
          ' · +5 s',
      );
    });
    get('[data-play="hint"]').addEventListener('click', () =>
      assist(
        'hint',
        'Un seul Gardien par territoire. Repère un territoire où il reste peu de cases. · +15 s',
      ),
    );

    feedback();
    paint();
    timer = setInterval(updateClock, 200);
    if (panel === 'E13') showPause();
    else if (panel === 'E12') {
      showDialog(
        'Règles',
        'Un Gardien par ligne, par colonne et par territoire. Deux Gardiens ne se touchent pas, même en diagonale. Touche une case pour l’écarter, puis à nouveau pour y placer un Gardien.',
        [['Retour à la partie', back]],
        back,
      );
    }
  }

  // « Rejouer » starts a new attempt instead of reopening the completed one.
  function forget(quest) {
    sessions.delete(quest.id);
  }

  return { show, leave, forget };
}
