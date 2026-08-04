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

// Multijoueur Elements
const multiToggleBtn = document.querySelector('#multi-toggle-btn');
const multiplayerBar = document.querySelector('#multiplayer-bar');
const mpRoomCodeDisplay = document.querySelector('#mp-room-code-display');
const copyLinkBtn = document.querySelector('#copy-link-btn');
const leaveMpBtn = document.querySelector('#leave-mp-btn');
const playerHostPill = document.querySelector('#player-host-pill');
const playerGuestPill = document.querySelector('#player-guest-pill');

const roomDialog = document.querySelector('#room-dialog');
const closeRoom = document.querySelector('#close-room');
const createRoomBtn = document.querySelector('#create-room-btn');
const joinRoomBtn = document.querySelector('#join-room-btn');
const roomCodeInput = document.querySelector('#room-code-input');
const mpStatusMsg = document.querySelector('#mp-status-msg');

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

const winningLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
  [0, 4, 8], [2, 4, 6]             // Diagonales
];

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));

// Acronymes et synonymes courants
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
      return line; // Retourne la ligne gagnante
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

function updateLivesUI() {
  if (isMultiplayer) {
    document.querySelector('#lives-box').classList.add('hidden');
  } else {
    document.querySelector('#lives-box').classList.remove('hidden');
    heartsListEl.textContent = '❤️'.repeat(lives) + '🖤'.repeat(3 - lives);
  }
}

function updateMultiplayerUI() {
  if (!isMultiplayer) {
    multiplayerBar.classList.add('hidden');
    document.querySelector('#intro-desc-text').textContent = "Cliquez sur une case pour choisir le pays correspondant. Cliquez sur ⓘ pour voir les explications des critères.";
    return;
  }

  multiplayerBar.classList.remove('hidden');
  mpRoomCodeDisplay.textContent = `Salon : ${currentRoomCode}`;
  
  if (currentTurn === 'host') {
    playerHostPill.classList.add('active-turn');
    playerGuestPill.classList.remove('active-turn');
  } else {
    playerGuestPill.classList.add('active-turn');
    playerHostPill.classList.remove('active-turn');
  }

  const isMyTurn = currentTurn === myRole;
  const roleText = myRole === 'host' ? '🟢 Joueur 1 (Hôte)' : '🔵 Joueur 2 (Invité)';
  
  if (isMyTurn) {
    feedback.textContent = `🎲 C'est À VOTRE TOUR (${roleText}) ! Choisissez une case.`;
  } else {
    feedback.textContent = `⏳ En attente de l'adversaire (${currentTurn === 'host' ? '🟢 Joueur 1' : '🔵 Joueur 2'})...`;
  }
}

function renderBoard() {
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
      } else {
        content += `<span class="cell-empty-hint">🔍 Choisir</span>`;
      }
      
      board.insertAdjacentHTML('beforeend', `
        <button class="cell ${isSelected ? 'selected' : ''} ${cellData ? 'correct' : ''} ${claimClass}" data-cell="${id}" role="gridcell" aria-label="Case ${id + 1}">
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
      return;
    }

    selectedCell = id;
    const rowIndex = Math.floor(id / 3);
    const columnIndex = id % 3;
    const row = rows[rowIndex];
    const column = columns[columnIndex];

    const usedCodes = answers.filter(Boolean).map(a => (a.country ? a.country.code : a.code));
    const availableCandidates = cellCandidates(row, column).filter((c) => !usedCodes.includes(c.code));
    candidatesCountEl.textContent = `💡 ${availableCandidates.length} pays possible${availableCandidates.length > 1 ? 's' : ''}`;

    cellTargetTag.textContent = `CASE ${id + 1}`;
    searchDialogTitle.textContent = `Choisir un pays pour la case ${id + 1}`;
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
      <img class="country-option-flag" src="${country.flagUrl}" alt="" />
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
  const isMatch = row.test(country) && column.test(country);

  const locked = Object.fromEntries(answers.map((answer, index) => answer ? [index, answer.country || answer] : null).filter(Boolean));
  locked[selectedCell] = country;
  const lists = rows.flatMap((line) => columns.map((columnItem) => cellCandidates(line, columnItem)));

  const targetCellId = selectedCell;
  const targetCellEl = board.querySelector(`.cell[data-cell="${targetCellId}"]`);

  searchDialog.close();

  if (!isMatch || !solveGrid(lists, locked)) {
    if (isMultiplayer) {
      // En 1v1 : mauvais choix ➔ passe le tour à l'adversaire !
      currentTurn = currentTurn === 'host' ? 'guest' : 'host';
      if (conn && conn.open) {
        conn.send({ type: 'WRONG_MOVE', cellId: targetCellId, countryCode: code });
      }
      feedback.textContent = `❌ ${country.name} est incorrect ! Le tour passe à l'adversaire.`;
      selectedCell = null;
      updateMultiplayerUI();
      renderBoard();
      return;
    }

    // Mode Solo : -1 vie
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

    const winLine = checkTicTacToeWin(myRole);
    if (winLine) {
      const winnerName = myRole === 'host' ? '🟢 Joueur 1' : '🔵 Joueur 2';
      mpVictoryTitle.textContent = `Victoire du ${winnerName} ! 🎉`;
      mpVictoryDesc.textContent = `Vous avez aligné 3 cases et remporté ce match de Tic-Tac-Toe !`;
      mpVictoryDialog.showModal();
    } else {
      currentTurn = currentTurn === 'host' ? 'guest' : 'host';
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

function initPeer(customCode = null, isCreating = false) {
  const code = customCode || generateRoomCode();
  currentRoomCode = code;
  const peerId = `cdoku-1v1-${code}`;

  mpStatusMsg.textContent = "Initialisation de la connexion WebRTC...";

  if (peer) peer.destroy();
  peer = new Peer(peerId, { debug: 1 });

  peer.on('open', (id) => {
    if (isCreating) {
      myRole = 'host';
      currentTurn = 'host';
      isMultiplayer = true;
      mpStatusMsg.textContent = `Salon créé (${code}) ! En attente du Joueur 2...`;
      
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.pushState({}, '', newUrl);
    }
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnectionListeners();
    mpStatusMsg.textContent = "Joueur 2 connecté ! Lancement...";
    
    // Envoyer la grille actuelle au Joueur 2
    setTimeout(() => {
      const rowIndices = rows.map(r => allCriteria.indexOf(r));
      const colIndices = columns.map(c => allCriteria.indexOf(c));
      conn.send({ type: 'INIT_GAME', rowIndices, colIndices });
      roomDialog.close();
      resetGame(false);
      updateMultiplayerUI();
    }, 500);
  });

  peer.on('error', (err) => {
    if (err.type === 'unavailable-id' && !isCreating) {
      // Tenter de se connecter en tant que Guest au Peer existant
      connectAsGuest(code);
    } else {
      mpStatusMsg.textContent = `Erreur de connexion : ${err.type}`;
    }
  });
}

function connectAsGuest(code) {
  currentRoomCode = code;
  myRole = 'guest';
  currentTurn = 'host';
  isMultiplayer = true;

  if (peer) peer.destroy();
  peer = new Peer();

  peer.on('open', () => {
    mpStatusMsg.textContent = "Connexion au salon de l'Hôte...";
    conn = peer.connect(`cdoku-1v1-${code}`);
    setupConnectionListeners();
  });

  peer.on('error', (err) => {
    mpStatusMsg.textContent = `Impossible de rejoindre le salon : ${err.type}`;
  });
}

function setupConnectionListeners() {
  conn.on('open', () => {
    roomDialog.close();
    updateMultiplayerUI();
  });

  conn.on('data', (data) => {
    if (data.type === 'INIT_GAME') {
      generateGrid(data.rowIndices, data.colIndices);
      resetGame(false);
      updateMultiplayerUI();
    }

    if (data.type === 'MAKE_MOVE') {
      const country = countries.find(c => c.code === data.countryCode);
      answers[data.cellId] = { country, player: data.player };
      
      const winLine = checkTicTacToeWin(data.player);
      if (winLine) {
        const winnerName = data.player === 'host' ? '🟢 Joueur 1 (Hôte)' : '🔵 Joueur 2 (Invité)';
        mpVictoryTitle.textContent = `Défaite / Partie terminée !`;
        mpVictoryDesc.textContent = `${winnerName} a aligné 3 cases et remporte ce match !`;
        mpVictoryDialog.showModal();
      } else {
        currentTurn = currentTurn === 'host' ? 'guest' : 'host';
        updateMultiplayerUI();
      }
      renderBoard();
    }

    if (data.type === 'WRONG_MOVE') {
      currentTurn = currentTurn === 'host' ? 'guest' : 'host';
      feedback.textContent = `L'adversaire a manqué sa réponse ! C'est à VOTRE tour !`;
      updateMultiplayerUI();
      renderBoard();
    }

    if (data.type === 'REMATCH') {
      answers = Array(9).fill(null);
      currentTurn = 'host';
      if (myRole === 'host') {
        generateGrid();
        const rowIndices = rows.map(r => allCriteria.indexOf(r));
        const colIndices = columns.map(c => allCriteria.indexOf(c));
        conn.send({ type: 'INIT_GAME', rowIndices, colIndices });
      }
      mpVictoryDialog.close();
      renderBoard();
      updateMultiplayerUI();
    }
  });

  conn.on('close', () => {
    feedback.textContent = "⚠️ L'adversaire a quitté le salon.";
    isMultiplayer = false;
    updateMultiplayerUI();
  });
}

// Evénements Multijoueur
multiToggleBtn.addEventListener('click', () => {
  mpStatusMsg.textContent = '';
  roomDialog.showModal();
});

closeRoom.addEventListener('click', () => roomDialog.close());

createRoomBtn.addEventListener('click', () => {
  initPeer(null, true);
});

joinRoomBtn.addEventListener('click', () => {
  const code = roomCodeInput.value.trim().toUpperCase();
  if (code) connectAsGuest(code);
});

copyLinkBtn.addEventListener('click', () => {
  const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
  navigator.clipboard.writeText(url);
  copyLinkBtn.textContent = '✓ Lien copié !';
  setTimeout(() => { copyLinkBtn.textContent = '📋 Copier le lien'; }, 2000);
});

leaveMpBtn.addEventListener('click', () => {
  if (peer) peer.destroy();
  isMultiplayer = false;
  window.history.pushState({}, '', window.location.pathname);
  resetGame(true);
  updateMultiplayerUI();
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

closeTooltip.addEventListener('click', () => tooltipDialog.close());
confirmTooltipBtn.addEventListener('click', () => tooltipDialog.close());

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
