const board = document.querySelector('#board');
const countriesEl = document.querySelector('#countries');
const feedback = document.querySelector('#feedback');
const search = document.querySelector('#country-search');
const searchDialog = document.querySelector('#search-dialog');
const searchDialogTitle = document.querySelector('#search-dialog-title');
const searchDialogClues = document.querySelector('#search-dialog-clues');
const cellTargetTag = document.querySelector('#cell-target-tag');
const candidatesCountEl = document.querySelector('#candidates-count');
const closeSearch = document.querySelector('#close-search');
const progressEl = document.querySelector('#progress');
const heartsListEl = document.querySelector('#hearts-list');

const gameoverDialog = document.querySelector('#gameover-dialog');
const retrySameBtn = document.querySelector('#retry-same-btn');
const newGridBtn = document.querySelector('#new-grid-btn');

let countries = [];
let rows = [];
let columns = [];
let selectedCell = null;
let answers = Array(9).fill(null);
let lives = 3;

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));

function criterion(label, type, description, test) { return { label, type, description, test }; }

function buildCriteria(data) {
  const hasLanguage = (language) => (country) => country.languages.some((value) => fold(value) === fold(language));
  const hasColor = (hex) => (country) => (country.flagColors || []).includes(hex);

  return [
    // Géographie
    criterion('Dans l’hémisphère Nord', 'geography', 'Le territoire du pays se situe dans l’hémisphère Nord (latitude >= 0).', (c) => c.hemisphere === 'Nord'),
    criterion('Dans l’hémisphère Sud', 'geography', 'Le territoire du pays se situe dans l’hémisphère Sud (latitude < 0).', (c) => c.hemisphere === 'Sud'),
    criterion('En Afrique', 'geography', 'Le pays se situe sur le continent africain.', (c) => c.region === 'Africa'),
    criterion('En Europe', 'geography', 'Le pays se situe en Europe.', (c) => c.region === 'Europe'),
    criterion('En Asie', 'geography', 'Le pays se situe en Asie.', (c) => c.region === 'Asia'),
    criterion('En Amérique', 'geography', 'Le pays se situe sur le continent américain.', (c) => c.region === 'Americas'),
    criterion('En Océanie', 'geography', 'Le pays se situe en Océanie.', (c) => c.region === 'Oceania'),
    criterion('Pays enclavé (sans mer)', 'geography', 'Le pays n’a aucun accès direct à la mer ou à un océan.', (c) => c.landlocked === true),
    criterion('Possède un accès à la mer', 'geography', 'Le pays possède une côte ou un accès maritime direct.', (c) => c.landlocked === false),
    criterion('Traversé par l’Équateur', 'geography', 'La ligne imaginaire de l’Équateur traverse le territoire du pays.', (c) => c.equator === true),
    criterion('Au moins 3 pays frontaliers', 'geography', 'Le pays partage ses frontières terrestres avec 3 voisins ou plus.', (c) => c.borders.length >= 3),
    criterion('Sans frontière terrestre', 'geography', 'Le pays est situé sur une ou plusieurs îles (0 frontière terrestre).', (c) => c.borders.length === 0),

    // Superficie & Démographie
    criterion('Superficie > 1 000 000 km²', 'economy', 'La superficie totale du pays dépasse 1 million de km² (ex: Canada, Chine, Algérie, Brésil...).', (c) => (c.area || 0) >= 1_000_000),
    criterion('Superficie < 50 000 km²', 'economy', 'La superficie totale du pays est inférieure à 50 000 km² (ex: Belgique, Suisse, Luxembourg...).', (c) => (c.area || 0) > 0 && (c.area || 0) < 50_000),
    criterion('Plus de 100M d’habitants', 'economy', 'La population du pays dépasse 100 millions d’habitants.', (c) => c.population >= 100_000_000),
    criterion('Entre 10M et 100M d’habitants', 'economy', 'La population est comprise entre 10 et 100 millions d’habitants.', (c) => c.population >= 10_000_000 && c.population < 100_000_000),
    criterion('Moins de 10M d’habitants', 'economy', 'La population du pays est inférieure à 10 millions d’habitants.', (c) => c.population > 0 && c.population < 10_000_000),

    // Langues & Monnaies
    ...['English', 'French', 'Spanish', 'Arabic', 'Portuguese', 'Russian', 'Chinese'].map((language) => {
      const nameFr = { English:'l’anglais', French:'le français', Spanish:'l’espagnol', Arabic:'l’arabe', Portuguese:'le portugais', Russian:'le russe', Chinese:'le chinois' }[language];
      return criterion(`Langue : ${nameFr}`, 'language', `Une des langues officielles ou nationales du pays est ${nameFr}.`, hasLanguage(language));
    }),
    ...['USD', 'EUR', 'XOF'].map((currency) => criterion(`Devise : ${currency}`, 'economy', `Le pays utilise la devise ${currency}.`, (c) => c.currencies.some((item) => item.code === currency))),

    // Drapeau & Nom
    criterion('Drapeau avec du rouge', 'history', 'Le drapeau officiel comporte de la couleur rouge.', hasColor('#d21034')),
    criterion('Drapeau avec du bleu', 'history', 'Le drapeau officiel comporte de la couleur bleue.', hasColor('#005eb8')),
    criterion('Drapeau avec du vert', 'history', 'Le drapeau officiel comporte de la couleur verte.', hasColor('#007a3d')),
    criterion('Drapeau avec du jaune / or', 'history', 'Le drapeau officiel comporte de la couleur jaune ou or.', hasColor('#ffd100')),
    criterion('Drapeau avec du noir', 'history', 'Le drapeau officiel comporte de la couleur noire.', hasColor('#000000')),
    criterion('Nom en 5 lettres ou moins', 'history', 'Le nom du pays en français comporte 5 lettres ou moins (ex: Cuba, Mali, Pérou, Inde...).', (c) => c.name.length <= 5),
    criterion('Nom se terminant par -ia ou -ie', 'history', 'Le nom courant du pays en français se termine par les lettres "ia" ou "ie" (ex: Algérie, Italie, Australie...).', (c) => /i[ae]$/i.test(c.name)),
  ].filter((item) => data.filter(item.test).length >= 5);
}

function shuffle(items) { return [...items].sort(() => Math.random() - 0.5); }
function cellCandidates(row, column) { return countries.filter((country) => row.test(country) && column.test(country)); }

function solveGrid(candidateLists, locked = {}) {
  const order = [...candidateLists.keys()].sort((a, b) => candidateLists[a].length - candidateLists[b].length);
  const solution = Array(9).fill(null);
  const used = new Set();
  for (const [cell, country] of Object.entries(locked)) { solution[cell] = country; used.add(country.code); }
  
  function visit(position) {
    if (position === order.length) return true;
    const cell = order[position];
    if (solution[cell]) return visit(position + 1);
    for (const country of candidateLists[cell]) {
      if (used.has(country.code)) continue;
      solution[cell] = country; used.add(country.code);
      if (visit(position + 1)) return true;
      solution[cell] = null; used.delete(country.code);
    }
    return false;
  }
  return visit(0) ? solution : null;
}

function generateGrid() {
  const criteria = buildCriteria(countries);
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const choices = shuffle(criteria).slice(0, 6);
    const testRows = choices.slice(0, 3);
    const testColumns = choices.slice(3);
    const lists = testRows.flatMap((row) => testColumns.map((column) => cellCandidates(row, column)));
    if (lists.some((list) => list.length < 2)) continue;
    if (solveGrid(lists)) { rows = testRows; columns = testColumns; return; }
  }
  throw new Error('Aucune grille solvable n’a pu être générée.');
}

function clue(item, row = false) {
  return `
    <div class="clue ${item.type} ${row ? 'row' : ''}">
      <div class="clue-label-area">
        <span class="dot ${item.type}"></span>
        <span>${escapeHtml(item.label)}</span>
      </div>
      <span class="info-icon" title="${escapeHtml(item.description)}">ⓘ</span>
    </div>
  `;
}

function updateLivesUI() {
  heartsListEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
}

function renderBoard() {
  board.innerHTML = '<div class="corner"></div>' + columns.map((item) => clue(item)).join('');
  rows.forEach((row, rowIndex) => {
    board.insertAdjacentHTML('beforeend', clue(row, true));
    columns.forEach((column, columnIndex) => {
      const id = rowIndex * 3 + columnIndex;
      const answer = answers[id];
      const isSelected = selectedCell === id;
      
      let content = `<span class="cell-number">${id + 1}</span>`;
      if (answer) {
        content += `
          <div class="answer-card">
            <img class="answer-flag-img" src="${answer.flagUrl}" alt="Drapeau ${escapeHtml(answer.name)}" />
            <span class="answer-name">${escapeHtml(answer.name)}</span>
            <span class="answer-status">✓ Valide</span>
          </div>
        `;
      } else {
        content += `<span class="cell-empty-hint">🔍 Choisir</span>`;
      }
      
      board.insertAdjacentHTML('beforeend', `
        <button class="cell ${isSelected ? 'selected' : ''} ${answer ? 'correct' : ''}" data-cell="${id}" role="gridcell" aria-label="Case ${id + 1}">
          ${content}
        </button>
      `);
    });
  });

  board.querySelectorAll('.cell').forEach((cell) => cell.addEventListener('click', () => {
    const id = Number(cell.dataset.cell);
    if (answers[id] || lives <= 0) return;

    selectedCell = id;
    const rowIndex = Math.floor(id / 3);
    const columnIndex = id % 3;
    const row = rows[rowIndex];
    const column = columns[columnIndex];

    const availableCandidates = cellCandidates(row, column).filter((c) => !answers.filter(Boolean).map(a=>a.code).includes(c.code));
    candidatesCountEl.textContent = `💡 ${availableCandidates.length} pays possible${availableCandidates.length > 1 ? 's' : ''}`;

    cellTargetTag.textContent = `CASE ${id + 1}`;
    searchDialogTitle.textContent = `Choisir un pays pour la case ${id + 1}`;
    searchDialogClues.innerHTML = `
      <span class="dot ${row.type}"></span> <strong>${escapeHtml(row.label)}</strong> 
      <span style="margin: 0 4px; opacity: 0.5;">×</span> 
      <span class="dot ${column.type}"></span> <strong>${escapeHtml(column.label)}</strong>
    `;

    search.value = '';
    renderBoard();
    renderCountries();
    searchDialog.showModal();
    setTimeout(() => search.focus(), 50);
  }));
}

function renderCountries() {
  const query = fold(search.value.trim());
  const used = new Set(answers.filter(Boolean).map((country) => country.code));
  const matches = countries
    .filter((country) => !used.has(country.code) && (!query || fold(`${country.name} ${country.nameEnglish}`).includes(query)))
    .slice(0, 24);

  if (matches.length === 0) {
    countriesEl.innerHTML = '<p style="font-size: 13px; color: var(--ink-muted); padding: 8px 0;">Aucun pays trouvé.</p>';
    return;
  }

  countriesEl.innerHTML = matches.map((country) => `
    <button class="country-option-btn" data-code="${country.code}" role="option">
      <img class="country-option-flag" src="${country.flagUrl}" alt="" />
      <span class="country-option-name">${escapeHtml(country.name)}</span>
    </button>
  `).join('');

  countriesEl.querySelectorAll('.country-option-btn').forEach((button) => {
    button.addEventListener('click', () => choose(button.dataset.code));
  });
}

function choose(code) {
  const country = countries.find((item) => item.code === code);
  if (selectedCell === null || !country) return;

  const row = rows[Math.floor(selectedCell / 3)];
  const column = columns[selectedCell % 3];
  const isMatch = row.test(country) && column.test(country);

  const locked = Object.fromEntries(answers.map((answer, index) => answer ? [index, answer] : null).filter(Boolean));
  locked[selectedCell] = country;
  const lists = rows.flatMap((line) => columns.map((columnItem) => cellCandidates(line, columnItem)));

  const targetCellId = selectedCell;
  const targetCellEl = board.querySelector(`.cell[data-cell="${targetCellId}"]`);

  searchDialog.close();

  if (!isMatch || !solveGrid(lists, locked)) {
    lives -= 1;
    updateLivesUI();
    
    if (targetCellEl) {
      targetCellEl.classList.add('wrong');
      setTimeout(() => targetCellEl.classList.remove('wrong'), 450);
    }
    
    if (lives <= 0) {
      feedback.textContent = `❌ ${country.name} est incorrect. Vous n'avez plus de vies !`;
      selectedCell = null;
      renderBoard();
      setTimeout(() => gameoverDialog.showModal(), 300);
      return;
    }

    feedback.textContent = `❌ ${country.name} est incorrect pour ce croisement (-1 vie). Plus que ${lives} vie${lives > 1 ? 's' : ''} !`;
    selectedCell = null;
    renderBoard();
    return;
  }

  answers[selectedCell] = country;
  selectedCell = null;

  const count = answers.filter(Boolean).length;
  progressEl.textContent = count;
  
  if (count === 9) {
    feedback.textContent = '🎉 Bravo ! Grille entièrement complétée !';
  } else {
    feedback.textContent = `✅ Bonne réponse (${country.name}) ! Continuez.`;
  }

  renderBoard();
}

function resetGame(newSeed = true) {
  answers = Array(9).fill(null);
  selectedCell = null;
  search.value = '';
  lives = 3;
  updateLivesUI();

  if (newSeed) {
    generateGrid();
  }
  
  progressEl.textContent = '0';
  feedback.textContent = 'Cliquez sur une case de la grille pour commencer.';
  renderBoard();
}

search.addEventListener('input', renderCountries);
closeSearch.addEventListener('click', () => {
  searchDialog.close();
  selectedCell = null;
  renderBoard();
});

document.querySelector('#reset-button').addEventListener('click', () => resetGame(true));
retrySameBtn.addEventListener('click', () => {
  gameoverDialog.close();
  resetGame(false);
});
newGridBtn.addEventListener('click', () => {
  gameoverDialog.close();
  resetGame(true);
});

const help = document.querySelector('#help-dialog');
document.querySelector('#help-button').addEventListener('click', () => help.showModal());
document.querySelector('#close-help').addEventListener('click', () => help.close());
document.querySelector('#start-button').addEventListener('click', () => help.close());

document.querySelector('#puzzle-date').textContent = `DÉFI DU ${new Intl.DateTimeFormat('fr-FR', { day:'numeric', month:'long' }).format(new Date()).toUpperCase()}`;

fetch('data/countries.json')
  .then((response) => response.json())
  .then((data) => {
    countries = data.countries;
    resetGame(true);
  })
  .catch(() => {
    feedback.textContent = 'Erreur lors du chargement des données.';
  });
