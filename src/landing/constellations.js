const search = document.getElementById('constellation-search');
const input = document.getElementById('constellation-name');
const status = document.getElementById('constellation-results');

function normalizeName(name) {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const entries = [...document.querySelectorAll('.constellation-entry')].map((card) => ({
  card,
  name: normalizeName(card.querySelector('h3').textContent),
}));

function filterByName() {
  const query = normalizeName(input.value);
  let count = 0;

  for (const { card, name } of entries) {
    card.hidden = !name.includes(query);
    if (!card.hidden) count++;
  }

  status.textContent = count === 0 ? 'Aucune constellation trouvée' : `${count} constellation${count === 1 ? '' : 's'}`;
}

input.addEventListener('input', filterByName);
filterByName();
search.hidden = false;
