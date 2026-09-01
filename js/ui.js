import { gameState, cellCandidates, resetGameState, validateMove } from './game.js';
import { countries, aliases, countriesSearchIndex } from './data.js';
import { escapeHtml, sessionLogs } from './utils.js';
import { isMultiplayer, myRole, currentTurn, roomScores, startTurnTimer, stopTurnTimer, turnTimeLeft, safeSend, startNextMultiplayerMatch, handleRoomClose, forceLeaveRoom, currentRoomCode } from './network.js';
import { getChoicePercentage } from './stats.js';
import { 
  board, countriesEl, feedback, search, searchDialog, searchDialogTitle, searchDialogClues, 
  cellTargetTag, candidatesCountEl, tooltipDialog, tooltipTitle, tooltipDesc, progressEl, 
  heartsListEl, gameoverDialog, resetButton, resetBtnLabel, mpTurnBanner, mpTurnText, 
  boardCard, mpFeedCard, mpFeedList, mpFeedCount, multiplayerBar, turnTimerDisplay, 
  mpRoomCodeDisplay, mpStatusMsg, playerHostPill, playerGuestPill, mpVictoryDialog, 
  mpVictoryTitle, mpVictoryDesc, gridProposalDialog, gridProposalDesc 
} from './elements.js';

export { 
  board, countriesEl, feedback, search, searchDialog, searchDialogTitle, searchDialogClues, 
  cellTargetTag, candidatesCountEl, tooltipDialog, tooltipTitle, tooltipDesc, progressEl, 
  heartsListEl, gameoverDialog, resetButton, resetBtnLabel, mpTurnBanner, mpTurnText, 
  boardCard, mpFeedCard, mpFeedList, mpFeedCount, multiplayerBar, turnTimerDisplay, 
  mpRoomCodeDisplay, mpStatusMsg, playerHostPill, playerGuestPill, mpVictoryDialog, 
  mpVictoryTitle, mpVictoryDesc, gridProposalDialog, gridProposalDesc 
};

const feedHistory = [];
const maxFeedHistory = 40;

// O-04: fold reste ici pour la query utilisateur uniquement (appelé 1 seule fois par frappe)
const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// --- Focus Trap logic pour l'accessibilité ---
export function setupFocusTrap(dialogElement) {
  const focusableElements = dialogElement.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
  if (focusableElements.length === 0) return;
  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];

  dialogElement.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusableElement) {
          lastFocusableElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusableElement) {
          firstFocusableElement.focus();
          e.preventDefault();
        }
      }
    }
  });
}

// Initialisation des traps sur les modals existants
document.querySelectorAll('.custom-dialog').forEach(dialogElement => {
  setupFocusTrap(dialogElement);
  
  // Fermer la modale si on clique à l'extérieur
  dialogElement.addEventListener('click', (e) => {
    const rect = dialogElement.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) dialogElement.close();
  });
});

const closeTooltipBtn = document.querySelector('#close-tooltip');
const understandTooltipBtn = document.querySelector('#tooltip-understand-btn');
const confirmTooltipBtn = document.querySelector('#confirm-tooltip-btn');
if (closeTooltipBtn) closeTooltipBtn.addEventListener('click', () => tooltipDialog.close());
if (understandTooltipBtn) understandTooltipBtn.addEventListener('click', () => tooltipDialog.close());
if (confirmTooltipBtn) confirmTooltipBtn.addEventListener('click', () => tooltipDialog.close());

export function updateScoresUI() {
  const hostScoreEl = document.querySelector('#mp-score-host');
  const guestScoreEl = document.querySelector('#mp-score-guest');
  if (hostScoreEl) hostScoreEl.textContent = `${roomScores.host} pts`;
  if (guestScoreEl) guestScoreEl.textContent = `${roomScores.guest} pts`;
}

export function addGameFeed(msg, type = 'info') {
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  feedHistory.push({ msg, type, time });
  if (feedHistory.length > maxFeedHistory) feedHistory.shift();
  renderGameFeed();
}

function renderGameFeed() {
  if (!mpFeedList) return;
  if (mpFeedCount) mpFeedCount.textContent = `${feedHistory.length} événement${feedHistory.length > 1 ? 's' : ''}`;
  mpFeedList.innerHTML = feedHistory.map(item => `
    <div class="mp-feed-item ${item.type}">
      <span style="font-family: var(--font-mono); font-size: 10.5px; opacity: 0.65; margin-right: 5px;">[${item.time}]</span>
      ${escapeHtml(item.msg)}
    </div>
  `).join('');
  setTimeout(() => { mpFeedList.scrollTop = mpFeedList.scrollHeight; }, 30);
}

export function clearGameFeed() {
  feedHistory.length = 0;
  renderGameFeed();
}

export function updateLivesUI() {
  const livesBox = document.querySelector('#lives-box');
  if (!livesBox) return;
  if (isMultiplayer) {
    livesBox.classList.add('hidden');
  } else {
    livesBox.classList.remove('hidden');
    if (heartsListEl) heartsListEl.textContent = Array(Math.max(0, gameState.lives)).fill('❤️').concat(Array(Math.max(0, 3 - gameState.lives)).fill('🖤')).join(' ');
  }
}

export function updateTimerUI() {
  if (turnTimerDisplay) turnTimerDisplay.textContent = `⏱️ ${turnTimeLeft}s`;
  
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
    if (turnTimerDisplay) turnTimerDisplay.classList.add('warning');
    if (mpTurnBanner) mpTurnBanner.classList.add('warning');
  } else {
    if (turnTimerDisplay) turnTimerDisplay.classList.remove('warning');
    if (mpTurnBanner) mpTurnBanner.classList.remove('warning');
  }
}

export function updateMultiplayerUI() {
  const modeSoloTab = document.querySelector('#mode-solo-tab');
  const modeMultiTab = document.querySelector('#mode-multi-tab');

  if (!isMultiplayer) {
    if (multiplayerBar) multiplayerBar.classList.add('hidden');
    if (mpTurnBanner) mpTurnBanner.classList.add('hidden');
    if (mpFeedCard) mpFeedCard.classList.add('hidden');
    if (boardCard) boardCard.classList.remove('opponent-turn');
    if (resetBtnLabel) resetBtnLabel.textContent = "Nouvelle grille";
    document.querySelector('#intro-desc-text').textContent = "Cliquez sur une case pour choisir le pays correspondant. Cliquez sur ⓘ pour voir les explications des critères.";
    if (modeSoloTab) modeSoloTab.classList.add('active');
    if (modeMultiTab) modeMultiTab.classList.remove('active');
    stopTurnTimer();
    return;
  }

  if (modeSoloTab) modeSoloTab.classList.remove('active');
  if (modeMultiTab) modeMultiTab.classList.add('active');
  
  if (multiplayerBar) multiplayerBar.classList.remove('hidden');
  if (mpTurnBanner) mpTurnBanner.classList.remove('hidden');
  if (mpFeedCard) mpFeedCard.classList.remove('hidden');
  if (mpRoomCodeDisplay && currentRoomCode) {
    mpRoomCodeDisplay.textContent = `CODE : ${currentRoomCode}`;
  }
}

export function clueHTML(item, row = false) {
  return `
    <div class="clue ${item.type} ${row ? 'row' : ''}">
      <div class="clue-label-area">
        <span>${escapeHtml(item.label)}</span>
      </div>
      <button class="info-icon" data-label="${escapeHtml(item.label)}" data-desc="${escapeHtml(item.description)}" aria-label="Explication">ⓘ</button>
    </div>
  `;
}

export function showTooltip(label, description) {
  tooltipTitle.textContent = label;
  tooltipDesc.textContent = description;
  // F-05 FIX: Guard showModal
  if (!tooltipDialog.open) tooltipDialog.showModal();
}

// F-05 FIX: Safe showModal helper
export function safeShowModal(dialog) {
  if (dialog && !dialog.open) dialog.showModal();
}

// O-05 FIX: Single innerHTML pour renderBoard (au lieu de multiples insertAdjacentHTML)
export function renderBoard(isNewGrid = false) {
  const isSolutionMode = !isMultiplayer && gameState.lives <= 0;

  if (isNewGrid) {
    board.classList.add('grid-animating');
    setTimeout(() => board.classList.remove('grid-animating'), 500);
  }

  // Construire tout le HTML en mémoire d'abord
  let html = '<div class="corner"></div>' + gameState.columns.map((item) => clueHTML(item)).join('');
  
  gameState.rows.forEach((row, rowIndex) => {
    html += clueHTML(row, true);
    gameState.columns.forEach((column, columnIndex) => {
      const id = rowIndex * 3 + columnIndex;
      const cellData = gameState.answers[id];
      const isSelected = gameState.selectedCell === id;
      
      let content = `<span class="cell-number">${id + 1}</span>`;
      let claimClass = '';

      if (cellData) {
        const country = cellData.country || cellData;
        const player = cellData.player;

        if (player === 'host') claimClass = 'claimed-host';
        if (player === 'guest') claimClass = 'claimed-guest';
        if (isMultiplayer && player) {
          claimClass += player === myRole ? ' claimed-self' : ' claimed-opponent';
        }

        const isMe = player === myRole;
        const playerBadge = player ? `<span class="player-claim-badge ${isMe ? 'self' : 'opponent'}">${player === 'host' ? '🟢 J1' : '🟣 J2'} ${isMe ? '<small style="font-size: 9.5px; margin-left: 2px;">(Vous)</small>' : '<small style="font-size: 9.5px; margin-left: 2px; font-weight: 800;">(Adversaire)</small>'}</span>` : '';

        const rowCriterion = gameState.rows[rowIndex];
        const colCriterion = gameState.columns[columnIndex];
        const pct = getChoicePercentage(rowCriterion?.label, colCriterion?.label, country.code);
        const statBadge = (pct !== null && pct !== undefined) ? `<span class="stat-badge" title="${pct}% des joueurs ont choisi ce pays pour cette case">📊 ${pct}%</span>` : '';

        content += `
          <div class="answer-card">
            <img class="answer-flag-img" src="${country.flagUrl}" alt="Drapeau ${escapeHtml(country.name)}" loading="lazy" onerror="this.onerror=null; this.src='https://flagcdn.com/w160/${(country.iso2 || 'jm').toLowerCase()}.png';" />
            <span class="answer-name">${escapeHtml(country.name)}</span>
            ${playerBadge}
            ${statBadge}
          </div>
        `;
      } else if (isSolutionMode) {
        content += `<span class="cell-empty-hint solutions">💡 Voir solutions</span>`;
      } else {
        content += `<span class="cell-empty-hint">🔍 Choisir</span>`;
      }
      
      html += `
        <button class="cell ${isSelected ? 'selected' : ''} ${cellData ? 'correct' : ''} ${isSolutionMode && !cellData ? 'solution-mode-cell' : ''} ${claimClass}" data-cell="${id}" role="gridcell" aria-label="Case ${id + 1}" style="animation-delay: ${id * 0.05}s">
          ${content}
        </button>
      `;
    });
  });

  // O-05: Injection unique dans le DOM
  board.innerHTML = html;

  board.querySelectorAll('.info-icon').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showTooltip(btn.dataset.label, btn.dataset.desc);
    });
  });
}

export function renderCountriesForSolution(candidates) {
  if (!candidates || candidates.length === 0) {
    countriesEl.innerHTML = `<div class="empty-msg" style="text-align: center; padding: 20px; color: var(--ink-secondary);">Aucun pays dans la base ne satisfait ces deux critères simultanément.</div>`;
    return;
  }

  const selectedCell = gameState.selectedCell;
  let rowLabel = '', colLabel = '';
  if (selectedCell !== null && selectedCell !== undefined) {
    const r = Math.floor(selectedCell / 3);
    const c = selectedCell % 3;
    rowLabel = gameState.rows[r]?.label;
    colLabel = gameState.columns[c]?.label;
  }

  countriesEl.innerHTML = candidates.map((country) => {
    const pct = getChoicePercentage(rowLabel, colLabel, country.code);
    const pctBadge = (pct !== null && pct !== undefined) ? `<span class="country-stat-badge" title="${pct}% des choix">📊 ${pct}%</span>` : '';
    return `
    <div class="country-option-btn solution-item" style="cursor: default; background: var(--bg-app); border: 1px solid var(--border-medium); margin-bottom: 6px; padding: 8px 12px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px;">
      <img class="country-option-flag" src="${country.flagUrl}" alt="${escapeHtml(country.name)}" loading="lazy" style="width: 32px; height: 22px; object-fit: cover; border-radius: 3px; flex-shrink: 0;" />
      <div style="display: flex; flex-direction: column; text-align: left;">
        <strong class="country-option-name" style="font-size: 14px; color: var(--ink-primary);">${escapeHtml(country.name)}</strong>
        <small style="font-size: 11.5px; color: var(--ink-secondary);">Capitale : ${escapeHtml(country.capital || 'N/A')} • ${(country.population || 0).toLocaleString('fr-FR')} hab.</small>
      </div>
      ${pctBadge}
    </div>
  `;
  }).join('');
}

// O-02 FIX: Variable pour stocker le callback de choix (pour délégation d'événements)
let _currentChooseCallback = null;

// O-02 FIX: Délégation d'événements — un seul listener sur countriesEl
if (countriesEl) {
  countriesEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.country-option-btn:not(.used)');
    if (btn && _currentChooseCallback) {
      _currentChooseCallback(btn.dataset.code);
    }
  });
}

// O-04 FIX: Utiliser l'index pré-calculé au lieu de fold() à chaque frappe
export function renderCountries(onChooseCallback) {
  _currentChooseCallback = onChooseCallback;
  const query = fold(search.value.trim());
  const usedCodes = new Set(gameState.answers.filter(Boolean).map((a) => (a.country ? a.country.code : a.code)));
  
  let matches = countries.map((country, i) => {
    const idx = countriesSearchIndex[i];
    const isUsed = usedCodes.has(country.code);

    let matchScore = -1;
    if (!query) {
      matchScore = 0;
    } else if (idx.nameFr.startsWith(query) || idx.aliasesFolded.some(a => a.startsWith(query))) {
      matchScore = 3;
    } else if (idx.nameEn.startsWith(query)) {
      matchScore = 2;
    } else if (idx.nameFr.includes(query) || idx.nameEn.includes(query) || idx.aliasesFolded.some(a => a.includes(query))) {
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

  // O-02: Plus besoin de boucle addEventListener — délégation gérée au-dessus
  countriesEl.innerHTML = sliced.map(({ country, isUsed }) => `
    <button class="country-option-btn ${isUsed ? 'used' : ''}" data-code="${country.code}" ${isUsed ? 'disabled' : ''} role="option">
      <span class="country-option-name">${escapeHtml(country.name)} ${isUsed ? '<small class="used-badge">(Déjà placé)</small>' : ''}</span>
    </button>
  `).join('');
}
