const board = document.querySelector('#board');
const countriesEl = document.querySelector('#countries');
const feedback = document.querySelector('#feedback');
const search = document.querySelector('#country-search');
const searchDialog = document.querySelector('#search-dialog');
const searchDialogTitle = document.querySelector('#search-dialog-title');
const searchDialogClues = document.querySelector('#search-dialog-clues');
const cellTargetTag = document.querySelector('#cell-target-tag');
const closeSearch = document.querySelector('#close-search');
const progressEl = document.querySelector('#progress');

let countries = [];
let rows = [];
let columns = [];
let selectedCell = null;
let answers = Array(9).fill(null);

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));

const isRed = (hex) => Number.parseInt(hex.slice(1, 3), 16) > 130 && Number.parseInt(hex.slice(1, 3), 16) > Number.parseInt(hex.slice(3, 5), 16) * 1.3;
const isBlue = (hex) => Number.parseInt(hex.slice(5, 7), 16) > 100 && Number.parseInt(hex.slice(5, 7), 16) > Number.parseInt(hex.slice(1, 3), 16) * 1.25;
const isGreen = (hex) => Number.parseInt(hex.slice(3, 5), 16) > 80 && Number.parseInt(hex.slice(3, 5), 16) > Number.parseInt(hex.slice(1, 3), 16) * 1.18;

function criterion(label, type, test) { return { label, type, test }; }

function buildCriteria(data) {
  const hasLanguage = (language) => (country) => country.languages.some((value) => fold(value) === fold(language));
  return [
    criterion('Dans l’hémisphère Nord', 'geography', (country) => country.hemisphere === 'Nord'),
    criterion('Dans l’hémisphère Sud', 'geography', (country) => country.hemisphere === 'Sud'),
    ...['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'].map((region) => criterion(`En ${({ Africa:'Afrique', Americas:'Amériques', Asia:'Asie', Europe:'Europe', Oceania:'Océanie' })[region]}`, 'geography', (country) => country.region === region)),
    ...['English', 'French', 'Spanish', 'Arabic', 'Portuguese', 'Russian', 'Chinese'].map((language) => criterion(`Langue : ${({ English:'anglais', French:'français', Spanish:'espagnol', Arabic:'arabe', Portuguese:'portugais', Russian:'russe', Chinese:'chinois' })[language]}`, 'language', hasLanguage(language))),
    criterion('Drapeau avec du rouge', 'history', (country) => country.flagColors.some(isRed)),
    criterion('Drapeau avec du bleu', 'history', (country) => country.flagColors.some(isBlue)),
    criterion('Drapeau avec du vert', 'history', (country) => country.flagColors.some(isGreen)),
    criterion('Plus de 100M d’habitants', 'economy', (country) => country.population >= 100_000_000),
    criterion('Entre 10M et 100M d’habitants', 'economy', (country) => country.population >= 10_000_000 && country.population < 100_000_000),
    criterion('Moins de 10M d’habitants', 'economy', (country) => country.population > 0 && country.population < 10_000_000),
    ...['USD', 'EUR', 'XOF'].map((currency) => criterion(`Devise : ${currency}`, 'economy', (country) => country.currencies.some((item) => item.code === currency))),
    criterion('Au moins 3 pays frontaliers', 'geography', (country) => country.borders.length >= 3),
    criterion('Sans frontière terrestre', 'geography', (country) => country.borders.length === 0),
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
  return `<div class="clue ${item.type} ${row ? 'row' : ''}"><span class="dot ${item.type}"></span>${escapeHtml(item.label)}</div>`;
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
    if (answers[id]) return;

    selectedCell = id;
    const rowIndex = Math.floor(id / 3);
    const columnIndex = id % 3;
    const row = rows[rowIndex];
    const column = columns[columnIndex];

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
    feedback.textContent = `❌ ${country.name} ne convient pas pour ce croisement ou bloquerait la grille. Réessayez !`;
    if (targetCellEl) {
      targetCellEl.classList.add('wrong');
      setTimeout(() => targetCellEl.classList.remove('wrong'), 450);
    }
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

function resetGame() {
  answers = Array(9).fill(null);
  selectedCell = null;
  search.value = '';
  generateGrid();
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

document.querySelector('#reset-button').addEventListener('click', resetGame);

const help = document.querySelector('#help-dialog');
document.querySelector('#help-button').addEventListener('click', () => help.showModal());
document.querySelector('#close-help').addEventListener('click', () => help.close());
document.querySelector('#start-button').addEventListener('click', () => help.close());

document.querySelector('#puzzle-date').textContent = `DÉFI DU ${new Intl.DateTimeFormat('fr-FR', { day:'numeric', month:'long' }).format(new Date()).toUpperCase()}`;

fetch('data/countries.json')
  .then((response) => response.json())
  .then((data) => {
    countries = data.countries;
    resetGame();
  })
  .catch(() => {
    feedback.textContent = 'Erreur lors du chargement des données.';
  });
