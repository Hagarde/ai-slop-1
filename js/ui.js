import { gameState, cellCandidates, resetGameState, validateMove } from './game.js';
import { countries, aliases } from './data.js';
import { escapeHtml, sessionLogs } from './utils.js';
import { isMultiplayer, myRole, currentTurn, roomScores, startTurnTimer, stopTurnTimer, turnTimeLeft, safeSend, startNextMultiplayerMatch, handleRoomClose, forceLeaveRoom } from './network.js';
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
document.querySelectorAll('.custom-dialog').forEach(setupFocusTrap);

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
    if (heartsListEl) heartsListEl.textContent = '❤️'.repeat(gameState.lives) + '🖤'.repeat(3 - gameState.lives);
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
  
  // Note: on utilise import dynamique ou var partagées.
  // mpRoomCodeDisplay est mis à jour depuis network.js
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
  tooltipDialog.showModal();
}

export function renderBoard(isNewGrid = false) {
  const isSolutionMode = !isMultiplayer && gameState.lives <= 0;

  if (isNewGrid) {
    board.classList.add('grid-animating');
    setTimeout(() => board.classList.remove('grid-animating'), 500);
  }

  board.innerHTML = '<div class="corner"></div>' + gameState.columns.map((item) => clueHTML(item)).join('');
  
  gameState.rows.forEach((row, rowIndex) => {
    board.insertAdjacentHTML('beforeend', clueHTML(row, true));
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

        content += `
          <div class="answer-card">
            <img class="answer-flag-img" src="${country.flagUrl}" alt="Drapeau ${escapeHtml(country.name)}" loading="lazy" onerror="this.onerror=null; this.src='https://flagcdn.com/w160/${(country.iso2 || 'jm').toLowerCase()}.png';" />
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
        <button class="cell ${isSelected ? 'selected' : ''} ${cellData ? 'correct' : ''} ${isSolutionMode && !cellData ? 'solution-mode-cell' : ''} ${claimClass}" data-cell="${id}" role="gridcell" aria-label="Case ${id + 1}" style="animation-delay: ${id * 0.05}s">
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

  // Events attachés dans main.js pour éviter références cycliques
}

export function renderCountriesForSolution(candidates) {
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

export function renderCountries(onChooseCallback) {
  const query = fold(search.value.trim());
  const usedCodes = new Set(gameState.answers.filter(Boolean).map((a) => (a.country ? a.country.code : a.code)));
  
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
    button.addEventListener('click', () => onChooseCallback(button.dataset.code));
  });
}
