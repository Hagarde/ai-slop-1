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

const tooltipDialog = document.querySelector('#tooltip-dialog');
const tooltipTitle = document.querySelector('#tooltip-title');
const tooltipDesc = document.querySelector('#tooltip-desc');
const closeTooltip = document.querySelector('#close-tooltip');
const confirmTooltipBtn = document.querySelector('#confirm-tooltip-btn');

const progressEl = document.querySelector('#progress');
const heartsListEl = document.querySelector('#hearts-list');
const gameoverDialog = document.querySelector('#gameover-dialog');
const retrySameBtn = document.querySelector('#retry-same-btn');
const newGridBtn = document.querySelector('#new-grid-btn');
const resetButton = document.querySelector('#reset-button');
const resetBtnLabel = document.querySelector('#reset-btn-label');

// Multijoueur Elements
const multiToggleBtn = document.querySelector('#multi-toggle-btn');
const multiplayerBar = document.querySelector('#multiplayer-bar');
const mpRoomCodeDisplay = document.querySelector('#mp-room-code-display');
const copyLinkBtn = document.querySelector('#copy-link-btn');
const leaveMpBtn = document.querySelector('#leave-mp-btn');
const playerHostPill = document.querySelector('#player-host-pill');
const playerGuestPill = document.querySelector('#player-guest-pill');
const turnTimerDisplay = document.querySelector('#turn-timer-display');

const roomDialog = document.querySelector('#room-dialog');
const closeRoom = document.querySelector('#close-room');
const roomOptionsView = document.querySelector('#room-options-view');
const roomCreatedView = document.querySelector('#room-created-view');
const createRoomBtn = document.querySelector('#create-room-btn');
const joinRoomBtn = document.querySelector('#join-room-btn');
const roomCodeInput = document.querySelector('#room-code-input');
const createdCodeVal = document.querySelector('#created-code-val');
const inviteLinkInput = document.querySelector('#invite-link-input');
const modalCopyLinkBtn = document.querySelector('#modal-copy-link-btn');
const mpStatusMsg = document.querySelector('#mp-status-msg');

const gridProposalDialog = document.querySelector('#grid-proposal-dialog');
const gridProposalDesc = document.querySelector('#grid-proposal-desc');
const acceptGridBtn = document.querySelector('#accept-grid-btn');
const declineGridBtn = document.querySelector('#decline-grid-btn');

const mpVictoryDialog = document.querySelector('#mp-victory-dialog');
const mpVictoryTitle = document.querySelector('#mp-victory-title');
const mpVictoryDesc = document.querySelector('#mp-victory-desc');
const mpRematchBtn = document.querySelector('#mp-rematch-btn');
const mpNewMatchBtn = document.querySelector('#mp-new-match-btn');

let countries = [];
let rows = [];
let columns = [];
let allCriteria = [];
let selectedCell = null;
let answers = Array(9).fill(null);
let lives = 3;

// State Multijoueur 1v1
let isMultiplayer = false;
let myRole = null; // 'host' (🟢 J1) ou 'guest' (🔵 J2)
let currentTurn = 'host';
let peer = null;
let conn = null;
let currentRoomCode = null;

// Minuteur 30s
let turnTimerInterval = null;
let turnTimeLeft = 30;

const winningLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));

const aliases = {
  USA: ['USA', 'US', 'Etats-Unis', 'United States'],
  GBR: ['UK', 'Royaume-Uni', 'United Kingdom', 'Angleterre', 'Grande-Bretagne'],
  ARE: ['UAE', 'EAU', 'Emirats', 'Emirats arabes unis'],
  COD: ['RDC', 'Congo Kinshasa', 'DRC'],
  COG: ['Congo Brazzaville'],
  CAF: ['RCA', 'Centrafrique'],
  NLD: ['Hollande', 'Pays-Bas'],
  CZE: ['Tchequie', 'Republique Tcheque'],
  KOR: ['Coree du Sud', 'South Korea'],
  PRK: ['Coree du Nord', 'North Korea'],
  KNA: ['Saint Kitts', 'Saint-Kitts-et-Nevis'],
  VCT: ['Saint Vincent', 'Saint-Vincent-et-les-Grenadines'],
  STP: ['Sao Tome', 'Sao Tome et Principe'],
};

function criterion(label, type, description, test) { return { label, type, description, test }; }

function buildCriteria(data) {
  const hasLanguage = (language) => (country) => country.languages.some((value) => fold(value) === fold(language));
  const hasCurrencyCode = (code) => (country) => country.currencies.some((item) => item.code === code);
  const hasCurrencyName = (namePart) => (country) => country.currencies.some((item) => fold(item.name).includes(fold(namePart)));
  const hasColor = (hex) => (country) => (country.flagColors || []).includes(hex);

  return [
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
    criterion('Présence de sommets > 4 000 m', 'geography', 'Le territoire du pays comprend des sommets montagneux dépassant 4 000 mètres d’altitude (ex: France, Népal, Chili...).', (c) => c.peak4000 === true),
    criterion('Au moins 3 pays frontaliers', 'geography', 'Le pays partage ses frontières terrestres avec 3 voisins ou plus.', (c) => c.borders.length >= 3),
    criterion('Sans frontière terrestre', 'geography', 'Le pays est situé sur une ou plusieurs îles (0 frontière terrestre).', (c) => c.borders.length === 0),
    criterion('Superficie > 1 000 000 km²', 'economy', 'La superficie totale du pays dépasse 1 million de km² (ex: Canada, Chine, Algérie, Brésil...).', (c) => (c.area || 0) >= 1_000_000),
    criterion('Superficie < 50 000 km²', 'economy', 'La superficie totale du pays est inférieure à 50 000 km² (ex: Belgique, Suisse, Luxembourg...).', (c) => (c.area || 0) > 0 && (c.area || 0) < 50_000),
    criterion('Plus de 100M d’habitants', 'economy', 'La population du pays dépasse 100 millions d’habitants.', (c) => c.population >= 100_000_000),
    criterion('Entre 10M et 100M d’habitants', 'economy', 'La population est comprise entre 10 et 100 millions d’habitants.', (c) => c.population >= 10_000_000 && c.population < 100_000_000),
    criterion('Moins de 10M d’habitants', 'economy', 'La population du pays est inférieure à 10 millions d’habitants.', (c) => c.population > 0 && c.population < 10_000_000),
    criterion('Membre de l’OCDE', 'economy', 'Le pays fait partie des 38 États membres développés de l’OCDE (ex: France, Japon, Mexique, Allemagne...).', (c) => c.oecd === true),
    criterion('Non-membre de l’OCDE', 'economy', 'Le pays ne fait pas partie des 38 pays membres de l’OCDE.', (c) => c.oecd === false),
    criterion('Devise : Euro (€)', 'economy', 'Le pays utilise l’Euro (€) comme monnaie officielle.', hasCurrencyCode('EUR')),
    criterion('Devise : Dollar ($)', 'economy', 'Le pays utilise une monnaie appelée Dollar (USD, CAD, AUD, etc.).', hasCurrencyName('dollar')),
    criterion('Devise : Franc', 'economy', 'Le pays utilise une monnaie appelée Franc (CFA, CFP, CHF, etc.).', hasCurrencyName('franc')),
    criterion('Devise : Dinar', 'economy', 'Le pays utilise une monnaie appelée Dinar (Algérie, Koweït, Tunisie, etc.).', hasCurrencyName('dinar')),
    criterion('Devise : Roupie', 'economy', 'Le pays utilise une monnaie appelée Roupie (Inde, Pakistan, Maurice, etc.).', hasCurrencyName('rupee')),
    criterion('Au moins 2 langues officielles', 'language', 'Le pays possède 2 langues officielles ou nationales ou plus (ex: Canada, Suisse, Cameroun...).', (c) => c.languages.length >= 2),
    criterion('Capitale même initiale que le pays', 'language', 'Le nom de la capitale commence par la même lettre que le nom du pays (ex: Algérie ➔ Alger, Brésil ➔ Brasília, Mexique ➔ Mexico...).', (c) => c.capitalSameLetter === true),
    ...['English', 'French', 'Spanish', 'Arabic', 'Portuguese', 'Russian', 'Chinese'].map((language) => {
      const nameFr = { English:'l’anglais', French:'le français', Spanish:'l’espagnol', Arabic:'l’arabe', Portuguese:'le portugais', Russian:'le russe', Chinese:'le chinois' }[language];
      return criterion(`Langue : ${nameFr}`, 'language', `Une des langues officielles ou nationales du pays est ${nameFr}.`, hasLanguage(language));
    }),
    criterion('Symbole sur le drapeau', 'history', 'Le drapeau comporte un symbole particulier (étoile, croissant de lune, soleil ou armoiries).', (c) => c.symbolOnFlag === true),
    criterion('Drapeau à bandes verticales', 'history', 'Le motif principal du drapeau est composé de bandes verticales (ex: France, Italie, Mali...).', (c) => c.flagStripes === 'vertical'),
    criterion('Drapeau à bandes horizontales', 'history', 'Le motif principal du drapeau est composé de bandes horizontales (ex: Allemagne, Espagne, Pays-Bas...).', (c) => c.flagStripes === 'horizontal'),
    criterion('Drapeau avec au moins 4 couleurs', 'history', 'Le drapeau comporte 4 couleurs principales distinctes ou plus.', (c) => (c.flagColorCount || 0) >= 4),
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
  for (const [cell, item] of Object.entries(locked)) { 
    const country = item.country || item; 
    solution[cell] = country; 
    used.add(country.code); 
  }
  
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

function generateGrid(rowIndices = null, colIndices = null) {
  allCriteria = buildCriteria(countries);

  if (rowIndices && colIndices) {
    rows = rowIndices.map(i => allCriteria[i]);
    columns = colIndices.map(i => allCriteria[i]);
    return;
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const choices = shuffle(allCriteria).slice(0, 6);
    const testRows = choices.slice(0, 3);
    const testColumns = choices.slice(3);
    const lists = testRows.flatMap((row) => testColumns.map((column) => cellCandidates(row, column)));
    if (lists.some((list) => list.length < 2)) continue;
    if (solveGrid(lists)) { rows = testRows; columns = testColumns; return; }
  }
  throw new Error('Aucune grille solvable n’a pu être générée.');
}

function checkTicTacToeWin(playerRole) {
  for (const line of winningLines) {
    if (line.every((cellId) => answers[cellId] && answers[cellId].player === playerRole)) {
      return line;
    }
  }
  return null;
}

function clue(item, row = false) {
  return `
    <div class="clue ${item.type} ${row ? 'row' : ''}">
      <div class="clue-label-area">
        <span>${escapeHtml(item.label)}</span>
      </div>
      <button class="info-icon" data-label="${escapeHtml(item.label)}" data-desc="${escapeHtml(item.description)}" aria-label="Explication">ⓘ</button>
    </div>
  `;
}

function showTooltip(label, description) {
  tooltipTitle.textContent = label;
  tooltipDesc.textContent = description;
  tooltipDialog.showModal();
}

// Eléments Visuels 1v1 Prominents
const mpTurnBanner = document.querySelector('#mp-turn-banner');
const mpTurnText = document.querySelector('#mp-turn-text');
const boardCard = document.querySelector('#board-card');
const mpFeedCard = document.querySelector('#mp-feed-card');
const mpFeedMsg = document.querySelector('#mp-feed-msg');

function addGameFeed(msg) {
  if (mpFeedMsg) {
    mpFeedMsg.textContent = msg;
  }
}

function updateLivesUI() {
  if (isMultiplayer) {
    document.querySelector('#lives-box').classList.add('hidden');
  } else {
    document.querySelector('#lives-box').classList.remove('hidden');
    heartsListEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
  }
}

function startTurnTimer() {
  stopTurnTimer();
  turnTimeLeft = 30;
  updateTimerUI();

  if (!isMultiplayer) return;

  turnTimerInterval = setInterval(() => {
    turnTimeLeft -= 1;
    updateTimerUI();

    if (turnTimeLeft <= 0) {
      stopTurnTimer();
      if (currentTurn === myRole) {
        currentTurn = currentTurn === 'host' ? 'guest' : 'host';
        if (conn && conn.open) {
          conn.send({ type: 'TIMEOUT_PASS' });
        }
        const senderName = myRole === 'host' ? '🟢 Joueur 1 (Hôte)' : '🔵 Joueur 2 (Invité)';
        const msg = `⏱️ Temps écoulé (30s) pour ${senderName} ! Le tour passe à l'adversaire.`;
        feedback.textContent = msg;
        addGameFeed(msg);
        updateMultiplayerUI();
        renderBoard();
      }
    }
  }, 1000);
}

function stopTurnTimer() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
}

function updateTimerUI() {
  turnTimerDisplay.textContent = `⏱️ ${turnTimeLeft}s`;
  
  if (isMultiplayer && mpTurnText) {
    const isMyTurn = currentTurn === myRole;
    const activeRoleName = currentTurn === 'host' ? '🟢 Joueur 1' : '🔵 Joueur 2';
    
    if (isMyTurn) {
      mpTurnText.textContent = `🎲 C'EST À VOTRE TOUR DE JOUER ! (⏱️ ${turnTimeLeft}s)`;
    } else {
      mpTurnText.textContent = `⏳ TOUR DE L'ADVERSAIRE (${activeRoleName} - ⏱️ ${turnTimeLeft}s)`;
    }
  }

  if (turnTimeLeft <= 10) {
    turnTimerDisplay.classList.add('warning');
    if (mpTurnBanner) mpTurnBanner.classList.add('warning');
  } else {
    turnTimerDisplay.classList.remove('warning');
    if (mpTurnBanner) mpTurnBanner.classList.remove('warning');
  }
}

function updateMultiplayerUI() {
  if (!isMultiplayer) {
    multiplayerBar.classList.add('hidden');
    mpTurnBanner.classList.add('hidden');
    mpFeedCard.classList.add('hidden');
    boardCard.classList.remove('opponent-turn');
    resetBtnLabel.textContent = "Nouvelle grille";
    document.querySelector('#intro-desc-text').textContent = "Cliquez sur une case pour choisir le pays correspondant. Cliquez sur ⓘ pour voir les explications des critères.";
    if (modeSoloTab) modeSoloTab.classList.add('active');
    if (modeMultiTab) modeMultiTab.classList.remove('active');
    stopTurnTimer();
    return;
  }

  if (modeSoloTab) modeSoloTab.classList.remove('active');
  if (modeMultiTab) modeMultiTab.classList.add('active');
  
  multiplayerBar.classList.remove('hidden');
  mpTurnBanner.classList.remove('hidden');
  mpFeedCard.classList.remove('hidden');
  mpRoomCodeDisplay.textContent = `CODE : ${currentRoomCode}`;
  resetBtnLabel.textContent = "Proposer une nouvelle grille";
  
  playerHostPill.innerHTML = `<span class="player-dot host">🟢</span> Joueur 1 ${myRole === 'host' ? '<span class="you-tag">(Vous)</span>' : ''}`;
  playerGuestPill.innerHTML = `<span class="player-dot guest">🔵</span> Joueur 2 ${myRole === 'guest' ? '<span class="you-tag">(Vous)</span>' : ''}`;

  const isMyTurn = currentTurn === myRole;
  const activeRoleName = currentTurn === 'host' ? '🟢 Joueur 1' : '🔵 Joueur 2';
  
  if (currentTurn === 'host') {
    playerHostPill.classList.add('active-turn');
    playerGuestPill.classList.remove('active-turn');
  } else {
    playerGuestPill.classList.add('active-turn');
    playerHostPill.classList.remove('active-turn');
  }

  if (isMyTurn) {
    mpTurnBanner.className = 'mp-turn-banner my-turn';
    mpTurnText.textContent = `🎲 C'EST À VOTRE TOUR DE JOUER ! (⏱️ ${turnTimeLeft}s)`;
    boardCard.classList.remove('opponent-turn');
    feedback.textContent = `🎲 C'est À VOTRE TOUR ! Choisissez une case sur la grille.`;
  } else {
    mpTurnBanner.className = 'mp-turn-banner opponent-turn';
    mpTurnText.textContent = `⏳ TOUR DE L'ADVERSAIRE (${activeRoleName} - ⏱️ ${turnTimeLeft}s)`;
    boardCard.classList.add('opponent-turn');
    feedback.textContent = `⏳ En attente de l'adversaire (${activeRoleName})...`;
  }

  startTurnTimer();
}

function renderBoard() {
  const isSolutionMode = !isMultiplayer && lives <= 0;
  board.innerHTML = '<div class="corner"></div>' + columns.map((item) => clue(item)).join('');
  rows.forEach((row, rowIndex) => {
    board.insertAdjacentHTML('beforeend', clue(row, true));
    columns.forEach((column, columnIndex) => {
      const id = rowIndex * 3 + columnIndex;
      const cellData = answers[id];
      const isSelected = selectedCell === id;
      
      let content = `<span class="cell-number">${id + 1}</span>`;
      let claimClass = '';

      if (cellData) {
        const country = cellData.country || cellData;
        const player = cellData.player;

        if (player === 'host') claimClass = 'claimed-host';
        if (player === 'guest') claimClass = 'claimed-guest';

        const playerBadge = player ? `<span class="player-claim-badge">${player === 'host' ? '🟢 J1' : '🔵 J2'}</span>` : '';

        content += `
          <div class="answer-card">
            <img class="answer-flag-img" src="${country.flagUrl}" alt="Drapeau ${escapeHtml(country.name)}" />
            <span class="answer-name">${escapeHtml(country.name)}</span>
            ${playerBadge}
          </div>
        `;
      } else if (isSolutionMode) {
        content += `<span class="cell-empty-hint solutions">💡 Voir solutions</span>`;
      } else {
        content += `<span class="cell-empty-hint">🔍 Choisir</span>`;
      }
      
      board.insertAdjacentHTML('beforeend', `
        <button class="cell ${isSelected ? 'selected' : ''} ${cellData ? 'correct' : ''} ${isSolutionMode && !cellData ? 'solution-mode-cell' : ''} ${claimClass}" data-cell="${id}" role="gridcell" aria-label="Case ${id + 1}">
          ${content}
        </button>
      `);
    });
  });

  board.querySelectorAll('.info-icon').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showTooltip(btn.dataset.label, btn.dataset.desc);
    });
  });

  board.querySelectorAll('.cell').forEach((cell) => cell.addEventListener('click', () => {
    const id = Number(cell.dataset.cell);
    if (answers[id]) return;

    if (isMultiplayer) {
      if (currentTurn !== myRole) {
        feedback.textContent = `⏳ Ce n'est pas votre tour ! Attendez le coup de l'adversaire.`;
        return;
      }
    } else if (lives <= 0) {
      // MODE RÉVÉLATION SOLUTIONS (Défaite Solo)
      selectedCell = id;
      const rowIndex = Math.floor(id / 3);
      const columnIndex = id % 3;
      const row = rows[rowIndex];
      const column = columns[columnIndex];

      const validCandidates = cellCandidates(row, column);
      candidatesCountEl.textContent = `💡 ${validCandidates.length} solution${validCandidates.length > 1 ? 's' : ''} possible${validCandidates.length > 1 ? 's' : ''}`;
      cellTargetTag.textContent = `SOLUTIONS CASE ${id + 1}`;
      searchDialogTitle.textContent = `💡 Solutions valides pour la Case ${id + 1}`;
      searchDialogClues.innerHTML = `
        <strong>${escapeHtml(row.label)}</strong> 
        <span style="margin: 0 4px; opacity: 0.5;">×</span> 
        <strong>${escapeHtml(column.label)}</strong>
      `;

      search.value = '';
      search.style.display = 'none';
      renderCountriesForSolution(validCandidates);
      searchDialog.showModal();
      return;
    }

    // Mode normal de jeu
    search.style.display = '';
    selectedCell = id;
    const rowIndex = Math.floor(id / 3);
    const columnIndex = id % 3;
    const row = rows[rowIndex];
    const column = columns[columnIndex];

    const usedCodes = answers.filter(Boolean).map(a => (a.country ? a.country.code : a.code));
    const availableCandidates = cellCandidates(row, column).filter((c) => !usedCodes.includes(c.code));
    candidatesCountEl.textContent = `💡 ${availableCandidates.length} pays possible${availableCandidates.length > 1 ? 's' : ''}`;

    cellTargetTag.textContent = `CASE ${id + 1}`;
    searchDialogTitle.textContent = `Choisissez un pays pour la case ${id + 1}`;
    searchDialogClues.innerHTML = `
      <strong>${escapeHtml(row.label)}</strong> 
      <span style="margin: 0 4px; opacity: 0.5;">×</span> 
      <strong>${escapeHtml(column.label)}</strong>
    `;

    search.value = '';
    renderBoard();
    renderCountries();
    searchDialog.showModal();
    setTimeout(() => search.focus(), 50);
  }));
}

function renderCountriesForSolution(candidates) {
  if (!candidates || candidates.length === 0) {
    countriesEl.innerHTML = `<div class="empty-msg" style="text-align: center; padding: 20px; color: var(--ink-secondary);">Aucun pays dans la base ne satisfait ces deux critères simultanément.</div>`;
    return;
  }

  countriesEl.innerHTML = candidates.map((country) => `
    <div class="country-option-btn solution-item" style="cursor: default; background: var(--bg-app); border: 1px solid var(--border-medium); margin-bottom: 6px; padding: 8px 12px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px;">
      <img class="country-option-flag" src="${country.flagUrl}" alt="${escapeHtml(country.name)}" style="width: 32px; height: 22px; object-fit: cover; border-radius: 3px; flex-shrink: 0;" />
      <div style="display: flex; flex-direction: column; text-align: left;">
        <strong class="country-option-name" style="font-size: 14px; color: var(--ink-primary);">${escapeHtml(country.name)}</strong>
        <small style="font-size: 11.5px; color: var(--ink-secondary);">Capitale : ${escapeHtml(country.capital || 'N/A')} • ${(country.population || 0).toLocaleString('fr-FR')} hab.</small>
      </div>
    </div>
  `).join('');
}

function renderCountries() {
  const query = fold(search.value.trim());
  const usedCodes = new Set(answers.filter(Boolean).map((a) => (a.country ? a.country.code : a.code)));
  
  let matches = countries.map((country) => {
    const nameFr = fold(country.name);
    const nameEn = fold(country.nameEnglish);
    const extraAliases = (aliases[country.code] || []).map(fold);
    const isUsed = usedCodes.has(country.code);

    let matchScore = -1;
    if (!query) {
      matchScore = 0;
    } else if (nameFr.startsWith(query) || extraAliases.some(a => a.startsWith(query))) {
      matchScore = 3;
    } else if (nameEn.startsWith(query)) {
      matchScore = 2;
    } else if (nameFr.includes(query) || nameEn.includes(query) || extraAliases.some(a => a.includes(query))) {
      matchScore = 1;
    }

    return { country, matchScore, isUsed };
  }).filter((item) => item.matchScore >= 0);

  matches.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.isUsed !== b.isUsed) return a.isUsed ? 1 : -1;
    return a.country.name.localeCompare(b.country.name, 'fr');
  });

  const sliced = matches.slice(0, 24);

  if (sliced.length === 0) {
    countriesEl.innerHTML = '<p style="font-size: 13px; color: var(--ink-muted); padding: 8px 0;">Aucun pays trouvé.</p>';
    return;
  }

  countriesEl.innerHTML = sliced.map(({ country, isUsed }) => `
    <button class="country-option-btn ${isUsed ? 'used' : ''}" data-code="${country.code}" ${isUsed ? 'disabled' : ''} role="option">
      <span class="country-option-name">${escapeHtml(country.name)} ${isUsed ? '<small class="used-badge">(Déjà placé)</small>' : ''}</span>
    </button>
  `).join('');

  countriesEl.querySelectorAll('.country-option-btn:not(.used)').forEach((button) => {
    button.addEventListener('click', () => choose(button.dataset.code));
  });
}

function choose(code) {
  const country = countries.find((item) => item.code === code);
  if (selectedCell === null || !country) return;

  const row = rows[Math.floor(selectedCell / 3)];
  const column = columns[selectedCell % 3];
  const isMatchRow = row.test(country);
  const isMatchCol = column.test(country);
  const isMatch = isMatchRow && isMatchCol;

  // --- LOGS DÉBOGAGE STRUCTURÉS CONSOLE (F12) ---
  console.group(`🔍 [CountryDoku Debug] Evaluation : ${country.name} (${country.code})`);
  console.log(`📍 Case N°${selectedCell + 1} (Ligne: "${row.label}" × Colonne: "${column.label}")`);
  console.log('📌 Fiche Données du Pays :', {
    nom: country.name,
    nomAnglais: country.nameEnglish,
    code: country.code,
    region: country.region,
    hemisphere: country.hemisphere,
    superficie: `${(country.area || 0).toLocaleString('fr-FR')} km²`,
    population: `${(country.population || 0).toLocaleString('fr-FR')} hab.`,
    frontieresCount: country.borders.length,
    frontieres: country.borders.map(b => b.name || b.code),
    equateur: country.equator,
    oecd: country.oecd,
    sommets4000m: country.peak4000,
    langues: country.languages,
    capitale: country.capital,
    capitaleMemeInitiale: country.capitalSameLetter,
    drapeauCouleurs: country.flagColors,
    drapeauMotif: country.flagStripes || 'aucun',
    drapeauSymbole: country.symbolOnFlag
  });
  console.log(`🧪 Test Ligne ("${row.label}") :`, isMatchRow ? '✅ VALIDE' : '❌ ÉCHEC');
  console.log(`🧪 Test Colonne ("${column.label}") :`, isMatchCol ? '✅ VALIDE' : '❌ ÉCHEC');
  console.log(`🏁 RÉSULTAT FINAL :`, isMatch ? '✅ ACCEPTÉ' : '❌ REJETÉ');
  console.groupEnd();

  const targetCellId = selectedCell;
  const targetCellEl = board.querySelector(`.cell[data-cell="${targetCellId}"]`);

  searchDialog.close();

  if (!isMatch) {
    if (isMultiplayer) {
      currentTurn = currentTurn === 'host' ? 'guest' : 'host';
      if (conn && conn.open) {
        conn.send({ type: 'WRONG_MOVE', cellId: targetCellId, countryCode: code });
      }
      const msg = `❌ Erreur : ${country.name} est incorrect ! Le tour passe à l'adversaire.`;
      feedback.textContent = msg;
      addGameFeed(msg);
      selectedCell = null;
      updateMultiplayerUI();
      renderBoard();
      return;
    }

    lives -= 1;
    updateLivesUI();
    if (targetCellEl) {
      targetCellEl.classList.add('wrong');
      setTimeout(() => targetCellEl.classList.remove('wrong'), 450);
    }
    if (lives <= 0) {
      feedback.textContent = `💔 Défaite ! Vos 3 vies sont épuisées. Cliquez sur une case vide pour révéler les solutions valides ou démarrer une nouvelle grille.`;
      selectedCell = null;
      if (resetButton) resetButton.classList.add('highlight-btn');
      if (resetBtnLabel) resetBtnLabel.textContent = "✨ Démarrer une nouvelle grille";
      renderBoard();
      return;
    }
    feedback.textContent = `❌ ${country.name} est incorrect (-1 vie). Plus que ${lives} vie${lives > 1 ? 's' : ''} !`;
    selectedCell = null;
    renderBoard();
    return;
  }

  // Coup Valide !
  if (isMultiplayer) {
    answers[selectedCell] = { country, player: myRole };
    if (conn && conn.open) {
      conn.send({ type: 'MAKE_MOVE', cellId: selectedCell, countryCode: code, player: myRole });
    }

    const playerTag = myRole === 'host' ? '🟢 Joueur 1 (Hôte)' : '🔵 Joueur 2 (Invité)';
    const winLine = checkTicTacToeWin(myRole);
    if (winLine) {
      stopTurnTimer();
      mpVictoryTitle.textContent = `Victoire du ${playerTag} ! 🎉`;
      mpVictoryDesc.textContent = `Vous avez aligné 3 cases et remporté ce match de Tic-Tac-Toe !`;
      addGameFeed(`🎉 Victoire ! Vous avez aligné 3 cases et remporté ce match !`);
      mpVictoryDialog.showModal();
    } else {
      currentTurn = currentTurn === 'host' ? 'guest' : 'host';
      addGameFeed(`✅ Vous (${playerTag}) avez placé ${country.name} (Case ${selectedCell + 1}) ! Tour à l'adversaire.`);
      updateMultiplayerUI();
    }
  } else {
    answers[selectedCell] = { country };
    const count = answers.filter(Boolean).length;
    progressEl.textContent = count;
    feedback.textContent = count === 9 ? '🎉 Bravo ! Grille entièrement complétée !' : `✅ Bonne réponse (${country.name}) ! Continuez.`;
  }

  selectedCell = null;
  renderBoard();
}

// ============================================================
// LOGIQUE WEBRTC MULTIJOUEUR 1V1 (PeerJS)
// ============================================================
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function copyInviteLink() {
  const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      if (copyLinkBtn) copyLinkBtn.textContent = '✓ Lien copié !';
      if (modalCopyLinkBtn) modalCopyLinkBtn.textContent = "✓ Lien d'invitation copié !";
      setTimeout(() => { 
        if (copyLinkBtn) copyLinkBtn.textContent = '📋 Copier le lien'; 
        if (modalCopyLinkBtn) modalCopyLinkBtn.textContent = "📋 Copier le lien d'invitation";
      }, 2500);
    }).catch(() => {
      fallbackCopyLink(url);
    });
  } else {
    fallbackCopyLink(url);
  }
}

function fallbackCopyLink(text) {
  try {
    const input = inviteLinkInput || document.createElement('input');
    input.value = text;
    if (!inviteLinkInput) document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, 99999);
    document.execCommand('copy');
    if (!inviteLinkInput) document.body.removeChild(input);
    if (copyLinkBtn) copyLinkBtn.textContent = '✓ Lien copié !';
    if (modalCopyLinkBtn) modalCopyLinkBtn.textContent = "✓ Lien d'invitation copié !";
    setTimeout(() => { 
      if (copyLinkBtn) copyLinkBtn.textContent = '📋 Copier le lien'; 
      if (modalCopyLinkBtn) modalCopyLinkBtn.textContent = "📋 Copier le lien d'invitation";
    }, 2500);
  } catch (e) {
    console.warn('📋 Copie manuelle requise :', text);
  }
}

const mpStatusDot = document.querySelector('#mp-status-dot');

function updateStatus(msg, state = 'info') {
  if (mpStatusMsg) mpStatusMsg.textContent = msg;
  if (mpStatusDot) {
    switch (state) {
      case 'connecting': mpStatusDot.textContent = '🔄'; break;
      case 'success': mpStatusDot.textContent = '🟢'; break;
      case 'error': mpStatusDot.textContent = '❌'; break;
      default: mpStatusDot.textContent = '🟡'; break;
    }
  }
}

// Fermeture forcée et sécurisée du modal roomDialog
function closeRoomDialogSafely(reason = '') {
  console.log(`🚪 [WebRTC] Fermeture de #room-dialog (Raison: "${reason}"). État dialog.open =`, roomDialog.open);
  try {
    if (roomDialog.open) {
      roomDialog.close();
    }
  } catch (err) {
    console.warn('⚠️ [WebRTC] Exception sur roomDialog.close() :', err);
  }
  roomDialog.removeAttribute('open');
  roomDialog.style.display = 'none';
  setTimeout(() => {
    roomDialog.style.display = '';
  }, 100);
}

// ─── TURN servers diagnostics helper ───────────────────────────────────────
function logIceServers(servers) {
  console.log(`\n📋 [ICE Config] ${servers.length} serveurs ICE configurés :`);
  servers.forEach((s, i) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    urls.forEach(url => {
      const proto = url.startsWith('turns:') ? '🔒 TURN/TLS' :
                    url.startsWith('turn:') ? '🔄 TURN' : '🌐 STUN';
      console.log(`   ${i+1}. ${proto} — ${url}`);
    });
  });
}

// ─── Serveurs STUN de base (toujours disponibles) ───────────────────────────
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
];

// ─── Metered.ca TURN API (20 Go/mois gratuit) ──────────────────────────────
// ⚠️ Remplacez par vos propres credentials depuis https://dashboard.metered.ca
const METERED_APP_NAME = 'countrydoku';  // Nom de votre app Metered
const METERED_API_KEY  = 'aa340d9ab8937dc2645bfb6845b86c60c969';

let cachedTurnServers = null;
let turnFetchPromise = null;

async function fetchTurnCredentials() {
  // Cache : ne refetch que toutes les 10 minutes
  if (cachedTurnServers) return cachedTurnServers;
  // Déduplication : si un fetch est en cours, attendre
  if (turnFetchPromise) return turnFetchPromise;

  if (!METERED_API_KEY) {
    console.warn('⚠️ [TURN] Pas de clé API Metered.ca configurée → mode STUN-only.');
    console.warn('   Pour le multijoueur cross-réseau, configurez METERED_API_KEY dans app.js.');
    console.warn('   Inscription gratuite : https://dashboard.metered.ca/signup');
    return [];
  }

  turnFetchPromise = (async () => {
    try {
      console.log('🔑 [TURN] Récupération des credentials TURN via Metered.ca...');
      const url = `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const servers = await res.json();
      if (!Array.isArray(servers) || servers.length === 0) {
        throw new Error('Réponse vide ou invalide');
      }
      console.log(`✅ [TURN] ${servers.length} serveurs TURN obtenus depuis Metered.ca !`);
      cachedTurnServers = servers;
      // Expire le cache après 10 min
      setTimeout(() => { cachedTurnServers = null; }, 10 * 60 * 1000);
      return servers;
    } catch (err) {
      console.error(`❌ [TURN] Échec récupération credentials: ${err.message}`);
      console.error('   → Fallback : mode STUN-only (fonctionnel uniquement sur réseaux non-restrictifs).');
      return [];
    } finally {
      turnFetchPromise = null;
    }
  })();
  return turnFetchPromise;
}

async function buildPeerConfig() {
  const turnServers = await fetchTurnCredentials();
  const allServers = [...STUN_SERVERS, ...turnServers];
  logIceServers(allServers);
  return {
    debug: 2,
    config: {
      iceServers: allServers,
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    }
  };
}

// Compat : variable globale pour le diagnostic
let ICE_SERVERS = [...STUN_SERVERS];

async function initPeer(customCode = null, isCreating = false) {
  const code = customCode || generateRoomCode();
  currentRoomCode = code;
  const peerId = `cdoku-1v1-${code}`;

  console.log(`\n${'='.repeat(65)}`);
  console.log(`🌐 [WebRTC Host] initialisation — PeerID: "${peerId}" | Création: ${isCreating}`);
  console.log(`${'='.repeat(65)}`);
  updateStatus("⚙️ Récupération des serveurs TURN...", "connecting");
  setupBroadcastChannel(code);

  // Récupérer les credentials TURN avant de créer le Peer
  const peerConfig = await buildPeerConfig();
  ICE_SERVERS = peerConfig.config.iceServers; // pour le diagnostic

  updateStatus("⚙️ Connexion au serveur de signalisation (0.peerjs.com)...", "connecting");

  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }

  peer = new Peer(peerId, peerConfig);

  peer.on('open', (id) => {
    console.log(`✅ [WebRTC Host] Serveur de signalisation OK ! ID enregistré: "${id}"`);
    if (isCreating) {
      myRole = 'host';
      currentTurn = 'host';
      isMultiplayer = true;
      
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.pushState({}, '', newUrl);

      createdCodeVal.textContent = code;
      inviteLinkInput.value = newUrl;
      roomOptionsView.classList.add('hidden');
      roomCreatedView.classList.remove('hidden');
      updateStatus(`🟢 Salon prêt ! Code : ${code}. En attente de l'adversaire...`, "info");

      // Auto-copie sécurisée sans exception si la fenêtre n'est pas focusée
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(newUrl).then(() => {
          modalCopyLinkBtn.textContent = "✓ Lien d'invitation copié !";
          setTimeout(() => { modalCopyLinkBtn.textContent = "📋 Copier le lien d'invitation"; }, 3000);
        }).catch(() => {
          console.log('📋 Document non-focusé. Cliquez sur le bouton pour copier le lien.');
        });
      }
    }
  });

  peer.on('connection', (connection) => {
    console.log(`\n🤝 [WebRTC Host] Connexion entrante du Joueur 2 (Peer distant: "${connection.peer}")`);
    conn = connection;
    setupConnectionListeners();
    updateStatus("🤝 Joueur 2 détecté ! Négociation ICE/TURN en cours...", "connecting");
  });

  peer.on('disconnected', () => {
    console.warn('⚠️ [WebRTC Host] Déconnecté du serveur de signalisation 0.peerjs.com.');
    if (conn && conn.open) {
      console.log('💡 La partie P2P directe reste active même sans serveur de signalisation !');
    } else {
      updateStatus("🔄 Reconnexion au serveur de signalisation en cours...", "connecting");
    }
    try { peer.reconnect(); } catch (e) {}
  });

  peer.on('error', (err) => {
    console.error(`❌ [WebRTC Host Error] Type: "${err.type}" | Message:`, err.message || err);
    if (err.type === 'unavailable-id') {
      if (isCreating) {
        console.warn(`⚠️ Code ${code} déjà occupé. Génération d'un nouveau code...`);
        initPeer(null, true);
        return;
      } else {
        connectAsGuest(code);
        return;
      }
    }
    const msg = translatePeerError(err.type, code);
    updateStatus(msg, "error");
    feedback.textContent = msg;
  });
}

function translatePeerError(errType, code) {
  switch (errType) {
    case 'peer-unavailable':
      return `⚠️ Le salon (${code}) n'existe pas ou a été fermé par l'hôte. Vérifiez le code !`;
    case 'network':
    case 'disconnected':
      return `⚠️ Connexion au serveur de signalisation interrompue. Vérifiez votre accès réseau.`;
    case 'invalid-id':
      return `⚠️ Code de salon "${code}" invalide.`;
    case 'browser-incompatible':
      return `⚠️ Votre navigateur ne supporte pas le multijoueur WebRTC.`;
    default:
      return `⚠️ Impossible de joindre le salon (${errType}).`;
  }
}

let connectTimeout = null;

function clearGuestTimeout() {
  if (connectTimeout) {
    console.log('🧹 [WebRTC] Annulation du chrono de timeout (Connexion 1v1 active !)');
    clearTimeout(connectTimeout);
    connectTimeout = null;
  }
}

async function connectAsGuest(code) {
  currentRoomCode = code;
  myRole = 'guest';
  currentTurn = 'host';
  isMultiplayer = true;

  console.log(`\n${'='.repeat(65)}`);
  console.log(`🌐 [WebRTC Guest] connectAsGuest — Tentative rejointure salon: "${code}"`);
  console.log(`${'='.repeat(65)}`);
  updateStatus(`⚙️ Récupération des serveurs TURN...`, "connecting");
  if (!roomDialog.open) roomDialog.showModal();
  setupBroadcastChannel(code);

  // Récupérer les credentials TURN avant de créer le Peer
  const peerConfig = await buildPeerConfig();
  ICE_SERVERS = peerConfig.config.iceServers; // pour le diagnostic

  updateStatus(`⚙️ Connexion au serveur de signalisation...`, "connecting");

  if (peer) { try { peer.destroy(); } catch (e) {} }
  peer = new Peer(null, peerConfig);

  peer.on('open', (id) => {
    console.log(`✅ [WebRTC Guest] Serveur signalisation OK ! ID temporaire: "${id}"`);
    console.log(`🔗 Connexion vers le salon "cdoku-1v1-${code}"...`);
    updateStatus(`🤝 Recherche du salon ${code}...`, "connecting");
    conn = peer.connect(`cdoku-1v1-${code}`, { reliable: true });

    // Annonce immédiate via BroadcastChannel (pour onglets sur la même machine)
    if (roomChannel) {
      console.log('📻 [WebRTC Guest] Diffusions GUEST_JOINED via BroadcastChannel local.');
      roomChannel.postMessage({ type: 'GUEST_JOINED' });
    }

    // Timeout 25s avec décompte visuel pour laisser le temps aux serveurs TURN
    clearGuestTimeout();
    let elapsed = 0;
    const maxTimeoutMs = 25000;
    const countdownInterval = setInterval(() => {
      elapsed += 1000;
      if (!isMultiplayer || myRole === null || (conn && conn.open)) {
        clearInterval(countdownInterval);
        return;
      }
      const remainingSec = Math.round((maxTimeoutMs - elapsed) / 1000);
      if (remainingSec > 0) {
        updateStatus(`🔗 Négociation P2P/TURN en cours... (${remainingSec}s restantes)`, "connecting");
      }
    }, 1000);

    connectTimeout = setTimeout(() => {
      clearInterval(countdownInterval);
      if (conn && conn.open) return;
      if (!isMultiplayer || myRole === null) return;

      console.warn(`⚠️ [WebRTC Guest Timeout] 25s écoulées sans DataChannel WebRTC ouvert.`);
      console.warn(`ℹ️ Diagnostic : Pare-feu strict ou blocage UDP/TCP TURN entre les 2 réseaux.`);
      isMultiplayer = false;
      myRole = null;
      const msg = `⚠️ Impossible de joindre le salon ${code} (Délai de 25s dépassé). L'hôte est-il bien en ligne ?`;
      updateStatus(msg, "error");
      feedback.textContent = msg;
      roomOptionsView.classList.remove('hidden');
      roomCreatedView.classList.add('hidden');
      if (!roomDialog.open) roomDialog.showModal();
      window.history.pushState({}, '', window.location.pathname);
    }, maxTimeoutMs);

    setupConnectionListeners();
  });

  peer.on('disconnected', () => {
    console.warn('⚠️ [WebRTC Guest] Déconnecté du serveur de signalisation.');
    if (!conn || !conn.open) {
      updateStatus("🔄 Reconnexion au réseau...", "connecting");
    }
    try { peer.reconnect(); } catch (e) {}
  });

  peer.on('error', (err) => {
    console.error(`❌ [WebRTC Guest Error] Type: "${err.type}" | Message:`, err.message || err);
    clearGuestTimeout();
    isMultiplayer = false;
    myRole = null;
    const msg = translatePeerError(err.type, code);
    updateStatus(msg, "error");
    feedback.textContent = msg;
    roomOptionsView.classList.remove('hidden');
    roomCreatedView.classList.add('hidden');
    if (!roomDialog.open) roomDialog.showModal();
    window.history.pushState({}, '', window.location.pathname);
  });
}

let roomChannel = null;

function setupBroadcastChannel(code) {
  if (roomChannel) {
    try { roomChannel.close(); } catch (e) {}
    roomChannel = null;
  }
  if ('BroadcastChannel' in window) {
    console.log(`📻 [BroadcastChannel] Canal local "cdoku-room-${code}" ouvert.`);
    roomChannel = new BroadcastChannel(`cdoku-room-${code}`);
    roomChannel.onmessage = (event) => {
      console.log(`📻 [BroadcastChannel] Message local (Type: "${event.data ? event.data.type : '?'}") :`, event.data);
      handleIncomingData(event.data);
    };
  }
}

function safeSend(data) {
  let sent = false;
  // 1. BroadcastChannel (onglet local)
  if (roomChannel) {
    try {
      roomChannel.postMessage(data);
      console.log(`📻 [safeSend BC] "${data ? data.type : '?'}" diffusé localement.`);
      sent = true;
    } catch (err) { console.warn(`⚠️ BroadcastChannel exception :`, err); }
  }
  // 2. DataChannel WebRTC (reseaux distants)
  if (conn && conn.open) {
    try {
      conn.send(data);
      console.log(`📡 [safeSend WR] "${data ? data.type : '?'}" envoyé via WebRTC DataChannel.`);
      sent = true;
    } catch (err) { console.warn(`⚠️ WebRTC send exception :`, err); }
  } else if (conn && !conn.open) {
    console.warn(`⚠️ [safeSend] DataChannel non ouvert — message "${data ? data.type : '?'}" ignoré.`);
  }
  return sent;
}

let initGameRetryInterval = null;
let initGameSent = false;

function sendInitGameToGuest() {
  if (myRole !== 'host') return;
  if (initGameRetryInterval) { clearInterval(initGameRetryInterval); initGameRetryInterval = null; }
  initGameSent = false;

  const rowIndices = rows.map(r => allCriteria.indexOf(r));
  const colIndices = columns.map(c => allCriteria.indexOf(c));

  let attempts = 0;
  function attemptSend() {
    if (initGameSent) { clearInterval(initGameRetryInterval); initGameRetryInterval = null; return; }
    attempts++;
    const ok = safeSend({ type: 'INIT_GAME', rowIndices, colIndices });
    console.log(`📤 [Host] INIT_GAME tentative N°${attempts} — conn.open: ${conn ? conn.open : false}, succès: ${ok}`);
    updateStatus("🟢 Grille transmise ! En attente de la confirmation de l'Invité...", "connecting");
    if (attempts >= 20) {
      clearInterval(initGameRetryInterval);
      initGameRetryInterval = null;
      updateStatus("⚠️ L'Invité ne répond pas aux messages. Vérifiez sa connexion.", "error");
    }
  }

  attemptSend();
  initGameRetryInterval = setInterval(attemptSend, 600);
}

function handleIncomingData(data) {
  if (!data || !data.type) return;
  console.log(`📩 [1v1] Message reçu (Type: "${data.type}", Mon rôle: "${myRole}") :`, data);

  // GUEST → HOST : l'invité annonce qu'il a ouvert son canal
  if (data.type === 'GUEST_JOINED') {
    if (myRole !== 'host') return;
    console.log('🙋 [Host] GUEST_JOINED reçu ! Envoi de la grille à l\'invité...');
    sendInitGameToGuest();
    return;
  }

  // GUEST → HOST : l'invité a rendu la grille et est prêt
  if (data.type === 'GUEST_READY') {
    if (myRole !== 'host') return;
    console.log('✅ [Host] GUEST_READY reçu — synchronisation réussie !');
    initGameSent = true;
    if (initGameRetryInterval) { clearInterval(initGameRetryInterval); initGameRetryInterval = null; }
    clearGuestTimeout();
    closeRoomDialogSafely('GUEST_READY reçu');
    resetGame(false);
    updateMultiplayerUI();
    addGameFeed("🎮 Joueur 2 connecté avec succès ! Le match 1v1 commence.");
    return;
  }

  // HOST → GUEST : l'hôte transmet la grille
  if (data.type === 'INIT_GAME') {
    if (myRole !== 'guest') return;
    console.log(`🎮 [Guest] INIT_GAME reçu ! Génération du plateau et confirmation GUEST_READY...`);
    clearGuestTimeout();
    generateGrid(data.rowIndices, data.colIndices);
    resetGame(false);
    updateMultiplayerUI();
    closeRoomDialogSafely('INIT_GAME reçu');
    safeSend({ type: 'GUEST_READY' });
    addGameFeed("🎮 Salon rejoint ! Le match 1v1 commence. Joueur 1 a la main !");
    return;
  }

  if (data.type === 'MAKE_MOVE') {
    const country = countries.find(c => c.code === data.countryCode);
    answers[data.cellId] = { country, player: data.player };
    const playerTag = data.player === 'host' ? '🟢 Joueur 1 (Hôte)' : '🔵 Joueur 2 (Invité)';
    
    const winLine = checkTicTacToeWin(data.player);
    if (winLine) {
      stopTurnTimer();
      mpVictoryTitle.textContent = `Défaite / Partie terminée !`;
      mpVictoryDesc.textContent = `${playerTag} a aligné 3 cases et remporte ce match !`;
      addGameFeed(`🎉 ${playerTag} a aligné 3 cases et remporte le match de Tic-Tac-Toe !`);
      mpVictoryDialog.showModal();
    } else {
      currentTurn = currentTurn === 'host' ? 'guest' : 'host';
      addGameFeed(`✅ ${playerTag} a placé ${country.name} (Case ${data.cellId + 1}). C'est à VOTRE tour !`);
      updateMultiplayerUI();
    }
    renderBoard();
  }

  if (data.type === 'WRONG_MOVE') {
    const prevRoleName = currentTurn === 'host' ? '🔵 Joueur 2' : '🟢 Joueur 1';
    currentTurn = currentTurn === 'host' ? 'guest' : 'host';
    addGameFeed(`❌ ${prevRoleName} s'est trompé. C'est à VOTRE tour de jouer !`);
    updateMultiplayerUI();
  }

  if (data.type === 'TIMEOUT_PASS') {
    currentTurn = currentTurn === 'host' ? 'guest' : 'host';
    const activeRoleName = currentTurn === 'host' ? '🟢 Joueur 1' : '🔵 Joueur 2';
    addGameFeed(`⏱️ Temps écoulé pour l'adversaire ! Le tour passe à ${activeRoleName}.`);
    updateMultiplayerUI();
  }

  if (data.type === 'PROPOSE_NEW_GRID') {
    const senderName = data.sender === 'host' ? 'Joueur 1 (Hôte)' : 'Joueur 2 (Invité)';
    gridProposalDesc.textContent = `Le ${senderName} propose de générer une nouvelle grille. Acceptez-vous ?`;
    gridProposalDialog.showModal();
  }

  if (data.type === 'ACCEPT_NEW_GRID') {
    gridProposalDialog.close();
    answers = Array(9).fill(null);
    currentTurn = 'host';
    if (myRole === 'host') {
      generateGrid();
      const rowIndices = rows.map(r => allCriteria.indexOf(r));
      const colIndices = columns.map(c => allCriteria.indexOf(c));
      safeSend({ type: 'INIT_GAME', rowIndices, colIndices });
    }
    renderBoard();
    updateMultiplayerUI();
  }

  if (data.type === 'DECLINE_NEW_GRID') {
    gridProposalDialog.close();
    feedback.textContent = `⚠️ L'adversaire a refusé la demande de nouvelle grille.`;
  }

  if (data.type === 'REMATCH') {
    answers = Array(9).fill(null);
    currentTurn = 'host';
    if (myRole === 'host') {
      const rowIndices = rows.map(r => allCriteria.indexOf(r));
      const colIndices = columns.map(c => allCriteria.indexOf(c));
      safeSend({ type: 'INIT_GAME', rowIndices, colIndices });
    }
    mpVictoryDialog.close();
    renderBoard();
    updateMultiplayerUI();
  }
}

function setupConnectionListeners() {
  console.log(`🛠️ [WebRTC] setupConnectionListeners — conn:`, conn);

  let channelOpenFired = false;
  function handleChannelOpen() {
    if (channelOpenFired) return;
    if (!conn) return;
    
    // Si PeerJS n'est pas encore prêt mais que le canal natif est ouvert, on le force pour débloquer safeSend
    if (!conn.open) {
      console.log('⚡ [WebRTC] Forçage de conn.open = true (contournement bug PeerJS)');
      conn.open = true;
    }

    channelOpenFired = true;
    console.log(`🟢 [WebRTC] DataChannel OUVERT ! (Rôle: "${myRole}", Peer distant: "${conn.peer}")`);
    clearGuestTimeout();

    if (myRole === 'host') {
      updateStatus("🟢 Canal P2P ouvert ! En attente du signal de l'Invité...", "connecting");
    } else {
      updateStatus("🟢 Canal P2P ouvert ! Annonce de présence à l'Hôte...", "connecting");
      safeSend({ type: 'GUEST_JOINED' });
    }
  }

  conn.on('open', handleChannelOpen);

  // Fallback natif très sûr (sans écraser le onopen de PeerJS)
  if (conn.dataChannel) {
    conn.dataChannel.addEventListener('open', handleChannelOpen);
    if (conn.dataChannel.readyState === 'open') {
      console.log('⚡ [WebRTC] RTCDataChannel natif déjà à l\'état open !');
      handleChannelOpen();
    }
  }
  if (conn.open) {
    console.log('⚡ [WebRTC] conn.open est déjà true !');
    handleChannelOpen();
  }

  // Poll 300ms fallback
  const openPoll = setInterval(() => {
    if (!conn || channelOpenFired) { clearInterval(openPoll); return; }
    if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
      console.log('🔄 [WebRTC Poll] DataChannel détecté comme ouvert !');
      clearInterval(openPoll);
      handleChannelOpen();
    }
  }, 300);
  setTimeout(() => clearInterval(openPoll), 25000);

  // ─── Diagnostic RTCPeerConnection — attaché à 50ms pour capturer tous les candidats ─
  let diagAttached = false;
  let candidateCount = 0;
  let relayCandidateCount = 0;

  function attachIceDiagnostic(pc) {
    if (diagAttached) return;
    diagAttached = true;
    logIceServers(ICE_SERVERS);
    console.log(`🔬 [ICE Diag] RTCPeerConnection attachée — état initial :`);
    console.log(`   iceConnectionState : ${pc.iceConnectionState}`);
    console.log(`   iceGatheringState  : ${pc.iceGatheringState}`);
    console.log(`   signalingState     : ${pc.signalingState}`);

    // ⚠️ IMPORTANT : addEventListener au lieu de pc.on* = ...
    // Assigner pc.onicecandidate = ... écraserait le handler interne de PeerJS
    // qui utilise les candidats ICE pour la signalisation → 0 candidats collectés.
    // addEventListener s'ajoute sans remplacer les handlers existants.

    if (pc.iceGatheringState === 'complete') {
      console.warn('⚠️ [ICE Diag] Collecte déjà terminée à l\'attachement — lecture via getStats.');
      pc.getStats().then(stats => {
        let found = 0;
        stats.forEach(report => {
          if (report.type === 'local-candidate') {
            found++;
            const tag = report.candidateType === 'relay' ? '🔄 TURN RELAIS' :
                        report.candidateType === 'srflx' ? '🌐 STUN PUBLIC' : '🏠 LOCAL';
            console.log(`🧧 [ICE Stats] ${tag} | ${(report.protocol||'?').toUpperCase()} | ${report.address || '?'}`);
            if (report.candidateType === 'relay') relayCandidateCount++;
          }
        });
        console.log(`   getStats: ${found} candidats locaux (dont ${relayCandidateCount} TURN relais)`);
        if (relayCandidateCount === 0) {
          console.error('❌ [ICE Stats] Aucun TURN relay — serveurs TURN injoignables depuis ce réseau.');
        }
      }).catch(() => {});
    }

    // Écouter les candidats sans remplacer PeerJS
    pc.addEventListener('icecandidate', (event) => {
      if (!event.candidate) {
        console.log(`🧧 [ICE] Collecte terminée — ${candidateCount} candidats (dont ${relayCandidateCount} TURN relais).`);
        if (relayCandidateCount === 0 && candidateCount > 0) {
          console.error('❌ [ICE] Aucun candidat TURN relay. Serveurs TURN bloqués depuis ce réseau.');
          console.error('   → Solution : utiliser un réseau mobile (4G/5G) ou hotspot.');
        }
        return;
      }
      candidateCount++;
      const c = event.candidate;
      const typeLabel = c.type === 'relay'   ? '🔄 TURN RELAIS'    :
                        c.type === 'srflx'   ? '🌐 STUN PUBLIC'    :
                        c.type === 'prflx'   ? '🔀 PEER-REFLEXIVE' : '🏠 LOCAL';
      if (c.type === 'relay') relayCandidateCount++;
      console.log(`🧧 [ICE #${candidateCount}] ${typeLabel} | ${(c.protocol||'?').toUpperCase()} | ${c.address || 'mDNS'}:${c.port}`);
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      const state = pc.iceConnectionState;
      const icons = { 'new':'⏳','checking':'🔍','connected':'✅','completed':'✅✅','failed':'❌','disconnected':'⚠️','closed':'🔒' };
      console.log(`🧧 [ICE State] → ${icons[state]||'?'} ${state}`);
      if (state === 'connected' || state === 'completed') {
        console.log(`✅ [ICE] P2P établi via ${relayCandidateCount > 0 ? 'TURN relay' : 'STUN/direct'} !`);
      } else if (state === 'failed') {
        console.error(`❌ [ICE Failed] ${candidateCount} candidats testés, ${relayCandidateCount} TURN relais.`);
        if (relayCandidateCount === 0) {
          console.error('   → Serveurs TURN injoignables : réseau trop restrictif (eduroam, CGNAT strict).');
        }
        const netMsg = relayCandidateCount === 0
          ? '❌ Réseau trop restrictif : serveurs TURN bloqués. Essayez sur 4G ou hotspot.'
          : '❌ Connexion P2P échouée. Essayez sur un autre réseau.';
        updateStatus(netMsg, 'error');
        try { pc.restartIce(); } catch (e) {}
      } else if (state === 'disconnected') {
        console.warn('⚠️ [ICE] Connexion temporairement perdue.');
      }
    });

    pc.addEventListener('icegatheringstatechange', () => {
      console.log(`🧧 [ICE Gather] → ${pc.iceGatheringState}`);
      if (pc.iceGatheringState === 'gathering') {
        updateStatus('📍 Collecte des candidats réseau (STUN/TURN)...', 'connecting');
      }
    });

    pc.addEventListener('signalingstatechange', () => console.log(`📡 [Signaling] → ${pc.signalingState}`));
    pc.addEventListener('connectionstatechange', () => console.log(`🔗 [Connection] → ${pc.connectionState}`));
  }

  // Poll à 50ms pour capturer les candidats dès le départ
  const diagInterval = setInterval(() => {
    if (!conn || diagAttached) { clearInterval(diagInterval); return; }
    if (conn.peerConnection) {
      clearInterval(diagInterval);
      attachIceDiagnostic(conn.peerConnection);
    }
  }, 50);
  setTimeout(() => clearInterval(diagInterval), 10000);

  conn.on('data', (data) => { handleIncomingData(data); });

  conn.on('close', () => {
    feedback.textContent = "⚠️ L'adversaire a quitté le salon.";
    isMultiplayer = false;
    stopTurnTimer();
    updateMultiplayerUI();
  });
}

const modeSoloTab = document.querySelector('#mode-solo-tab');
const modeMultiTab = document.querySelector('#mode-multi-tab');

function openMultiplayerModal() {
  mpStatusMsg.textContent = '';
  roomOptionsView.classList.remove('hidden');
  roomCreatedView.classList.add('hidden');
  roomDialog.showModal();
}

multiToggleBtn.addEventListener('click', openMultiplayerModal);
if (modeMultiTab) modeMultiTab.addEventListener('click', openMultiplayerModal);
if (modeSoloTab) {
  modeSoloTab.addEventListener('click', () => {
    if (isMultiplayer) {
      handleRoomClose();
    } else {
      modeSoloTab.classList.add('active');
      modeMultiTab.classList.remove('active');
    }
  });
}

const confirmLeaveDialog = document.querySelector('#confirm-leave-dialog');
const cancelLeaveBtn = document.querySelector('#cancel-leave-btn');
const confirmLeaveBtn = document.querySelector('#confirm-leave-btn');

function handleRoomClose() {
  if (isMultiplayer) {
    if (confirmLeaveDialog) confirmLeaveDialog.showModal();
    return false;
  }
  if (roomDialog && roomDialog.open) roomDialog.close();
  return true;
}

function forceLeaveRoom() {
  if (confirmLeaveDialog) confirmLeaveDialog.close();
  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }
  if (roomChannel) {
    try { roomChannel.close(); } catch (e) {}
    roomChannel = null;
  }
  conn = null;
  isMultiplayer = false;
  myRole = null;
  currentRoomCode = null;
  window.history.pushState({}, '', window.location.pathname);
  resetGame(true);
  updateMultiplayerUI();
  if (roomDialog && roomDialog.open) roomDialog.close();
}

if (cancelLeaveBtn) cancelLeaveBtn.addEventListener('click', () => confirmLeaveDialog.close());
if (confirmLeaveBtn) confirmLeaveBtn.addEventListener('click', forceLeaveRoom);

const brandLogo = document.querySelector('#brand-logo');
if (brandLogo) {
  brandLogo.addEventListener('click', (e) => {
    e.preventDefault();
    if (isMultiplayer) {
      handleRoomClose();
    } else {
      window.history.pushState({}, '', window.location.pathname);
      resetGame(true);
    }
  });
}

closeRoom.addEventListener('click', handleRoomClose);
roomDialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  handleRoomClose();
});

createRoomBtn.addEventListener('click', () => {
  initPeer(null, true);
});

joinRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code) connectAsGuest(code);
});

copyLinkBtn.addEventListener('click', copyInviteLink);
modalCopyLinkBtn.addEventListener('click', copyInviteLink);

leaveMpBtn.addEventListener('click', () => {
  if (peer) peer.destroy();
  isMultiplayer = false;
  stopTurnTimer();
  window.history.pushState({}, '', window.location.pathname);
  resetGame(true);
  updateMultiplayerUI();
});

// Bouton Nouvelle Grille (Mutualisé en 1v1)
resetButton.addEventListener('click', () => {
  if (isMultiplayer) {
    if (conn && conn.open) {
      conn.send({ type: 'PROPOSE_NEW_GRID', sender: myRole });
      feedback.textContent = "⏳ Demande de nouvelle grille envoyée à l'adversaire...";
    }
  } else {
    resetGame(true);
  }
});

acceptGridBtn.addEventListener('click', () => {
  gridProposalDialog.close();
  if (conn && conn.open) {
    conn.send({ type: 'ACCEPT_NEW_GRID' });
  }
  answers = Array(9).fill(null);
  currentTurn = 'host';
  if (myRole === 'host') {
    generateGrid();
    const rowIndices = rows.map(r => allCriteria.indexOf(r));
    const colIndices = columns.map(c => allCriteria.indexOf(c));
    conn.send({ type: 'INIT_GAME', rowIndices, colIndices });
  }
  renderBoard();
  updateMultiplayerUI();
});

declineGridBtn.addEventListener('click', () => {
  gridProposalDialog.close();
  if (conn && conn.open) {
    conn.send({ type: 'DECLINE_NEW_GRID' });
  }
});

mpRematchBtn.addEventListener('click', () => {
  if (conn && conn.open) {
    conn.send({ type: 'REMATCH' });
  }
  answers = Array(9).fill(null);
  currentTurn = 'host';
  if (myRole === 'host') {
    const rowIndices = rows.map(r => allCriteria.indexOf(r));
    const colIndices = columns.map(c => allCriteria.indexOf(c));
    conn.send({ type: 'INIT_GAME', rowIndices, colIndices });
  }
  mpVictoryDialog.close();
  renderBoard();
  updateMultiplayerUI();
});

mpNewMatchBtn.addEventListener('click', () => {
  answers = Array(9).fill(null);
  currentTurn = 'host';
  if (myRole === 'host') {
    generateGrid();
    const rowIndices = rows.map(r => allCriteria.indexOf(r));
    const colIndices = columns.map(c => allCriteria.indexOf(c));
    if (conn && conn.open) {
      conn.send({ type: 'INIT_GAME', rowIndices, colIndices });
    }
  }
  mpVictoryDialog.close();
  renderBoard();
  updateMultiplayerUI();
});

function resetGame(newSeed = true) {
  answers = Array(9).fill(null);
  selectedCell = null;
  search.value = '';
  search.style.display = '';
  lives = 3;
  updateLivesUI();

  if (resetButton) resetButton.classList.remove('highlight-btn');
  if (resetBtnLabel) resetBtnLabel.textContent = isMultiplayer ? "Proposer une nouvelle grille" : "Nouvelle grille";

  if (newSeed) {
    generateGrid();
  }
  
  progressEl.textContent = '0';
  feedback.textContent = 'Cliquez sur une case de la grille pour commencer.';
  renderBoard();
}

search.addEventListener('input', renderCountries);
searchDialog.addEventListener('cancel', () => {
  selectedCell = null;
  renderBoard();
});
closeSearch.addEventListener('click', () => {
  searchDialog.close();
  selectedCell = null;
  renderBoard();
});

closeTooltip.addEventListener('click', () => tooltipDialog.close());
confirmTooltipBtn.addEventListener('click', () => tooltipDialog.close());

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

// Auto-détection de ?room=XYZ123 dans l'URL
fetch('data/countries.json')
  .then((response) => response.json())
  .then((data) => {
    countries = data.countries;
    allCriteria = buildCriteria(countries);

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    
    if (roomParam) {
      roomCodeInput.value = roomParam;
      connectAsGuest(roomParam.toUpperCase());
    } else {
      resetGame(true);
    }
  })
  .catch(() => {
    feedback.textContent = 'Erreur lors du chargement des données.';
  });
