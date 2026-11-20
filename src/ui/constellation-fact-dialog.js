import { CONSTELLATION_FACTS, constellationFactForId } from '../campaign/constellation-facts.js';

const surface = new Intl.NumberFormat('fr-FR');

export function createConstellationFactDialog(document, map) {
  const dialog = document.createElement('dialog');
  dialog.className = 'constellation-fact';
  dialog.id = 'constellationFact';
  dialog.setAttribute('aria-labelledby', 'constellationFactTitle');
  dialog.innerHTML = `
    <header class="constellation-fact-heading">
      <h2 id="constellationFactTitle" aria-live="polite"></h2>
      <button type="button" autofocus>Fermer</button>
    </header>
    <section>
      <h3>Pourquoi ce nom ?</h3>
      <p data-fact-origin></p>
    </section>
    <section>
      <h3>Le savais-tu ?</h3>
      <p data-fact-anecdote></p>
    </section>
    <section>
      <h3>Dans le ciel</h3>
      <dl>
        <div><dt>Surface apparente</dt><dd data-fact-area></dd></div>
        <div><dt>Rang par surface</dt><dd data-fact-rank></dd></div>
      </dl>
      <p class="constellation-fact-note">Une constellation est une région du ciel vue depuis la Terre. Ses étoiles peuvent se trouver à des distances très différentes.</p>
    </section>
    <label>Explorer les constellations <select></select></label>
  `;

  const close = dialog.querySelector('button');
  const picker = dialog.querySelector('select');
  const title = dialog.querySelector('h2');
  const origin = dialog.querySelector('[data-fact-origin]');
  const anecdote = dialog.querySelector('[data-fact-anecdote]');
  const area = dialog.querySelector('[data-fact-area]');
  const rank = dialog.querySelector('[data-fact-rank]');
  let opener;

  for (const fact of [...CONSTELLATION_FACTS].sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
    const option = document.createElement('option');
    option.value = fact.id;
    option.textContent = fact.name;
    picker.append(option);
  }

  function render(fact) {
    title.textContent = fact.name;
    origin.textContent = fact.nameOrigin;
    anecdote.textContent = fact.funFact;
    area.textContent = `${surface.format(fact.areaSqDeg)} °²`;
    rank.textContent = `${fact.areaRank}${fact.areaRank === 1 ? 'er' : 'e'} sur ${CONSTELLATION_FACTS.length}`;
    picker.value = fact.id;
  }

  picker.addEventListener('change', () => render(constellationFactForId(picker.value)));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => {
    // Mon ciel handles these keys itself when there is no native modal.
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
      return;
    }
    if (event.key !== 'Tab') return;

    event.stopPropagation();
    const edge = event.shiftKey ? close : picker;
    if (document.activeElement !== edge) return;

    event.preventDefault();
    (event.shiftKey ? picker : close).focus();
  });

  dialog.addEventListener('close', () => {
    if (!map.hidden && opener) {
      const matchingButton = [...map.querySelectorAll('.constellation-fact-button')].find(
        (button) =>
          button.dataset.factId === opener.dataset.factId && button.getClientRects().length,
      );
      (matchingButton || map.querySelector('#closeMap'))?.focus({ preventScroll: true });
    }
    opener = null;
  });

  new MutationObserver(() => {
    if (map.hidden && dialog.open) dialog.close();
  }).observe(map, { attributes: true, attributeFilter: ['hidden'] });
  map.append(dialog);

  return function makeButton(entry) {
    const fact = constellationFactForId(entry.id);
    if (!fact) return null;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'constellation-fact-button';
    button.dataset.factId = fact.id;
    button.setAttribute('aria-label', `Découvrir ${fact.name}`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', dialog.id);
    button.textContent = 'ⓘ';
    button.addEventListener('click', () => {
      if (map.querySelector('#skyTour:not([hidden])') || dialog.open) return;

      opener = button;
      render(fact);
      dialog.showModal();
      close.focus({ preventScroll: true });
      dialog.scrollTop = 0;
    });
    return button;
  };
}
