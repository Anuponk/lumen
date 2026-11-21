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

const countFormatter = new Intl.NumberFormat(document.documentElement.lang);

function filterByName() {
  const query = normalizeName(input.value);
  let count = 0;

  for (const { card, name } of entries) {
    card.hidden = !name.includes(query);
    if (!card.hidden) count++;
  }

  status.textContent = count === 0 ? status.dataset.empty : count === 1 ? status.dataset.single :
    status.dataset.many.replace('%s', countFormatter.format(count));
}

input.addEventListener('input', filterByName);
filterByName();
search.hidden = false;
