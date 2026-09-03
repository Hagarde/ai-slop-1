import { gameState, cellCandidates, resetGameState, validateMove } from './game.js';
import { countries, aliases, countriesSearchIndex } from './data.js';
import { escapeHtml, sessionLogs } from './utils.js';
import { isMultiplayer, myRole, currentTurn, roomScores, startTurnTimer, stopTurnTimer, turnTimeLeft, safeSend, startNextMultiplayerMatch, handleRoomClose, forceLeaveRoom, currentRoomCode } from './network.js';
import { getChoicePercentage } from './stats.js';
import { t, getLanguage, setLanguage, getCountryName, getCriterionLabel, getCriterionDesc, onLanguageChange } from './i18n.js';
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
if (closeTooltipBtn) closeTooltipBtn.addEventListener('click', () => tooltipDialog?.close());
if (understandTooltipBtn) understandTooltipBtn.addEventListener('click', () => tooltipDialog?.close());
if (confirmTooltipBtn) confirmTooltipBtn.addEventListener('click', () => tooltipDialog?.close());

const helpDialog = document.querySelector('#help-dialog');
const closeHelpBtn = document.querySelector('#close-help');
const startBtn = document.querySelector('#start-button');
if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => helpDialog?.close());
if (startBtn) startBtn.addEventListener('click', () => helpDialog?.close());

export function updateScoresUI() {
  const hostScoreEl = document.querySelector('#mp-score-host');
  const guestScoreEl = document.querySelector('#mp-score-guest');
  if (hostScoreEl) hostScoreEl.textContent = `${roomScores.host} pts`;
  if (guestScoreEl) guestScoreEl.textContent = `${roomScores.guest} pts`;
}

export function setFeedback(text, type = 'normal') {
  if (!feedback) return;
  feedback.textContent = text;
  feedback.classList.remove('wrong', 'correct');
  if (type === 'wrong') feedback.classList.add('wrong');
  else if (type === 'correct') feedback.classList.add('correct');
}

export function addGameFeed(msg, type = 'info') {
  const locale = getLanguage() === 'en' ? 'en-US' : 'fr-FR';
  const time = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  feedHistory.push({ msg, type, time });
  if (feedHistory.length > maxFeedHistory) feedHistory.shift();
  renderGameFeed();
}

function renderGameFeed() {
  if (!mpFeedList) return;
  const countLabel = getLanguage() === 'en' 
    ? `${feedHistory.length} event${feedHistory.length > 1 ? 's' : ''}` 
    : `${feedHistory.length} événement${feedHistory.length > 1 ? 's' : ''}`;
  if (mpFeedCount) mpFeedCount.textContent = countLabel;
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
    const activeRoleName = currentTurn === 'host' 
      ? (getLanguage() === 'en' ? '🟢 Player 1' : '🟢 Joueur 1') 
      : (getLanguage() === 'en' ? '🔵 Player 2' : '🔵 Joueur 2');
    
    if (isMyTurn) {
      mpTurnText.textContent = `${t('mp.your_turn_banner')} (⏱️ ${turnTimeLeft}s)`;
    } else {
      mpTurnText.textContent = `${t('mp.opponent_turn_banner')} (${activeRoleName} - ⏱️ ${turnTimeLeft}s)`;
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
    if (resetBtnLabel) resetBtnLabel.textContent = t('board.reset_btn');
    const descText = document.querySelector('#intro-desc-text');
    if (descText) descText.innerHTML = t('intro.desc', { badge: '<span class="info-badge">ⓘ</span>' });
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
  if (resetBtnLabel) resetBtnLabel.textContent = t('board.propose_grid_btn');
  if (mpRoomCodeDisplay && currentRoomCode) {
    mpRoomCodeDisplay.textContent = `${t('mp.code_label')}${currentRoomCode}`;
  }
}

export function clueHTML(item, row = false) {
  const label = getCriterionLabel(item);
  const desc = getCriterionDesc(item);
  const icon = item.icon || '';
  const tooltipAria = t('board.clue_tooltip');
  return `
    <div class="clue ${item.type} ${row ? 'row' : ''}">
      <div class="clue-label-area">
        ${icon ? `<span class="clue-icon" aria-hidden="true">${icon}</span>` : ''}
        <span class="clue-text">${escapeHtml(label)}</span>
      </div>
      <button class="info-icon" data-label="${escapeHtml((icon ? icon + ' ' : '') + label)}" data-desc="${escapeHtml(desc)}" aria-label="${escapeHtml(tooltipAria)}">ⓘ</button>
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

// O-05 FIX: Single innerHTML pour renderBoard
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
        const selfText = getLanguage() === 'en' ? '(You)' : '(Vous)';
        const oppText = getLanguage() === 'en' ? '(Opponent)' : '(Adversaire)';
        const p1Label = getLanguage() === 'en' ? '🟢 P1' : '🟢 J1';
        const p2Label = getLanguage() === 'en' ? '🟣 P2' : '🟣 J2';

        const playerBadge = player ? `<span class="player-claim-badge ${isMe ? 'self' : 'opponent'}">${player === 'host' ? p1Label : p2Label} ${isMe ? `<small style="font-size: 9.5px; margin-left: 2px;">${selfText}</small>` : `<small style="font-size: 9.5px; margin-left: 2px; font-weight: 800;">${oppText}</small>`}</span>` : '';

        const rowCriterion = gameState.rows[rowIndex];
        const colCriterion = gameState.columns[columnIndex];
        const pct = getChoicePercentage(rowCriterion?.labelFr || rowCriterion?.label, colCriterion?.labelFr || colCriterion?.label, country.code);
        const statTitle = getLanguage() === 'en' 
          ? `${pct}% of players chose this country for this cell` 
          : `${pct}% des joueurs ont choisi ce pays pour cette case`;
        const statBadge = (pct !== null && pct !== undefined) ? `<span class="stat-badge" title="${statTitle}">📊 ${pct}%</span>` : '';
        const countryName = getCountryName(country);

        content += `
          <div class="answer-card">
            <img class="answer-flag-img" src="${country.flagUrl}" alt="Flag ${escapeHtml(countryName)}" loading="lazy" onerror="this.onerror=null; this.src='https://flagcdn.com/w160/${(country.iso2 || 'jm').toLowerCase()}.png';" />
            <span class="answer-name">${escapeHtml(countryName)}</span>
            ${playerBadge}
            ${statBadge}
          </div>
        `;
      } else if (isSolutionMode) {
        content += `<span class="cell-empty-hint solutions">${t('board.see_solutions')}</span>`;
      } else {
        content += `<span class="cell-empty-hint">${t('board.choose')}</span>`;
      }
      
      html += `
        <button class="cell ${isSelected ? 'selected' : ''} ${cellData ? 'correct' : ''} ${isSolutionMode && !cellData ? 'solution-mode-cell' : ''} ${claimClass}" data-cell="${id}" role="gridcell" aria-label="Cell ${id + 1}" style="animation-delay: ${id * 0.05}s">
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
    const emptyMsg = getLanguage() === 'en' 
      ? 'No country in the database satisfies both criteria simultaneously.' 
      : 'Aucun pays dans la base ne satisfait ces deux critères simultanément.';
    countriesEl.innerHTML = `<div class="empty-msg" style="text-align: center; padding: 20px; color: var(--ink-secondary);">${emptyMsg}</div>`;
    return;
  }

  const selectedCell = gameState.selectedCell;
  let rowLabel = '', colLabel = '';
  if (selectedCell !== null && selectedCell !== undefined) {
    const r = Math.floor(selectedCell / 3);
    const c = selectedCell % 3;
    rowLabel = gameState.rows[r]?.labelFr || gameState.rows[r]?.label;
    colLabel = gameState.columns[c]?.labelFr || gameState.columns[c]?.label;
  }

  const locale = getLanguage() === 'en' ? 'en-US' : 'fr-FR';
  const capitalLabel = t('dialog.capital_label');
  const inhabLabel = t('dialog.inhabitants');

  countriesEl.innerHTML = candidates.map((country) => {
    const pct = getChoicePercentage(rowLabel, colLabel, country.code);
    const pctTitle = getLanguage() === 'en' ? `${pct}% of choices` : `${pct}% des choix`;
    const pctBadge = (pct !== null && pct !== undefined) ? `<span class="country-stat-badge" title="${pctTitle}">📊 ${pct}%</span>` : '';
    const name = getCountryName(country);
    return `
    <div class="country-option-btn solution-item" style="cursor: default; background: var(--bg-app); border: 1px solid var(--border-medium); margin-bottom: 6px; padding: 8px 12px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 12px;">
      <img class="country-option-flag" src="${country.flagUrl}" alt="${escapeHtml(name)}" loading="lazy" style="width: 32px; height: 22px; object-fit: cover; border-radius: 3px; flex-shrink: 0;" />
      <div style="display: flex; flex-direction: column; text-align: left;">
        <strong class="country-option-name" style="font-size: 14px; color: var(--ink-primary);">${escapeHtml(name)}</strong>
        <small style="font-size: 11.5px; color: var(--ink-secondary);">${capitalLabel}${escapeHtml(country.capital || 'N/A')} • ${(country.population || 0).toLocaleString(locale)} ${inhabLabel}</small>
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
  const isEn = getLanguage() === 'en';
  
  let matches = countries.map((country, i) => {
    const idx = countriesSearchIndex[i];
    const isUsed = usedCodes.has(country.code);

    let matchScore = -1;
    if (!query) {
      matchScore = 0;
    } else if (isEn) {
      if (idx.nameEn.startsWith(query) || idx.aliasesFolded.some(a => a.startsWith(query))) {
        matchScore = 3;
      } else if (idx.nameFr.startsWith(query)) {
        matchScore = 2;
      } else if (idx.nameEn.includes(query) || idx.nameFr.includes(query) || idx.aliasesFolded.some(a => a.includes(query))) {
        matchScore = 1;
      }
    } else {
      if (idx.nameFr.startsWith(query) || idx.aliasesFolded.some(a => a.startsWith(query))) {
        matchScore = 3;
      } else if (idx.nameEn.startsWith(query)) {
        matchScore = 2;
      } else if (idx.nameFr.includes(query) || idx.nameEn.includes(query) || idx.aliasesFolded.some(a => a.includes(query))) {
        matchScore = 1;
      }
    }

    return { country, matchScore, isUsed };
  }).filter((item) => item.matchScore >= 0);

  matches.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.isUsed !== b.isUsed) return a.isUsed ? 1 : -1;
    const nameA = isEn ? (a.country.nameEnglish || a.country.name) : a.country.name;
    const nameB = isEn ? (b.country.nameEnglish || b.country.name) : b.country.name;
    return nameA.localeCompare(nameB, isEn ? 'en' : 'fr');
  });

  const sliced = matches.slice(0, 24);

  if (sliced.length === 0) {
    countriesEl.innerHTML = `<p style="font-size: 13px; color: var(--ink-muted); padding: 8px 0;">${t('dialog.search_no_results')}</p>`;
    return;
  }

  const usedText = t('dialog.search_used');
  countriesEl.innerHTML = sliced.map(({ country, isUsed }) => {
    const displayName = getCountryName(country);
    return `
      <button class="country-option-btn ${isUsed ? 'used' : ''}" data-code="${country.code}" ${isUsed ? 'disabled' : ''} role="option">
        <span class="country-option-name">${escapeHtml(displayName)} ${isUsed ? `<small class="used-badge">${usedText}</small>` : ''}</span>
      </button>
    `;
  }).join('');
}

// Application de toutes les traductions statiques et dynamiques
export function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) el.innerHTML = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.placeholder = t(key);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });

  const langBtn = document.querySelector('#lang-toggle-btn');
  if (langBtn) {
    langBtn.textContent = t('nav.lang_toggle');
  }

  const introDesc = document.querySelector('#intro-desc-text');
  if (introDesc) {
    introDesc.innerHTML = t('intro.desc', { badge: '<span class="info-badge">ⓘ</span>' });
  }

  const searchInput = document.querySelector('#country-search');
  if (searchInput) {
    searchInput.placeholder = t('dialog.search_placeholder');
  }

  const roomCodeInput = document.querySelector('#room-code-input');
  if (roomCodeInput) {
    roomCodeInput.placeholder = t('dialog.room_join_placeholder');
  }

  const reportMsg = document.querySelector('#report-user-msg');
  if (reportMsg) {
    reportMsg.placeholder = t('dialog.report_placeholder');
  }

  renderBoard();
  updateMultiplayerUI();
  updateScoresUI();
  updateTimerUI();
}

// Écouteur global de changement de langue
onLanguageChange(() => {
  applyStaticTranslations();
});
