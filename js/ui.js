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
    if (gameState.isHardcore) {
      if (heartsListEl) {
        heartsListEl.innerHTML = gameState.lives > 0 
          ? '<span class="hardcore-heart" title="Mort Subite (1 vie)">❤️</span>' 
          : '<span class="hardcore-heart dead">🖤</span>';
      }
    } else {
      if (heartsListEl) {
        heartsListEl.textContent = Array(Math.max(0, gameState.lives)).fill('❤️').concat(Array(Math.max(0, 3 - gameState.lives)).fill('🖤')).join(' ');
      }
    }
  }
}

export function updateHardcoreUI() {
  const hardcoreBanner = document.querySelector('#hardcore-banner');
  const hardcoreTitleText = document.querySelector('#hardcore-title-text');
  const hardcoreDescText = document.querySelector('#hardcore-desc-text');
  const hardcoreRerollBtn = document.querySelector('#hardcore-reroll-btn');
  const modeSoloTab = document.querySelector('#mode-solo-tab');
  const modeHardcoreTab = document.querySelector('#mode-hardcore-tab');
  const modeMultiTab = document.querySelector('#mode-multi-tab');
  const modeBrTab = document.querySelector('#mode-br-tab');

  if (gameState.isHardcore) {
    if (hardcoreBanner) hardcoreBanner.classList.remove('hidden');
    if (!isMultiplayer) {
      if (modeHardcoreTab) modeHardcoreTab.classList.add('active');
      if (modeSoloTab) modeSoloTab.classList.remove('active');
      if (modeMultiTab) modeMultiTab.classList.remove('active');
      if (modeBrTab) modeBrTab.classList.remove('active');
      if (hardcoreRerollBtn) hardcoreRerollBtn.classList.remove('hidden');
    } else {
      if (hardcoreRerollBtn) hardcoreRerollBtn.classList.add('hidden');
    }

    const mod = gameState.hardcoreModifier;
    if (mod) {
      const isEn = getLanguage() === 'en';
      const prefix = isMultiplayer ? (isEn ? '🔥 1v1 HARDCORE: ' : '🔥 1v1 HARDCORE : ') : '';
      if (hardcoreTitleText) hardcoreTitleText.textContent = `${prefix}${mod.icon} ${isEn ? mod.titleEn : mod.titleFr}`;
      if (hardcoreDescText) hardcoreDescText.textContent = isEn ? mod.descEn : mod.descFr;
    }
  } else {
    if (hardcoreBanner) hardcoreBanner.classList.add('hidden');
    if (modeHardcoreTab) modeHardcoreTab.classList.remove('active');
    if (hardcoreRerollBtn) hardcoreRerollBtn.classList.remove('hidden');
  }
  updateLivesUI();
  updateSearchDialogHardcoreReminder();
}

let lastKnownTurn = null;
let hcAutoCloseInterval = null;

export function updateSearchDialogHardcoreReminder() {
  const reminderEl = document.querySelector('#search-dialog-hardcore-reminder');
  if (!reminderEl) return;

  if (gameState.isHardcore && gameState.hardcoreModifier) {
    reminderEl.classList.remove('hidden');
    const mod = gameState.hardcoreModifier;
    const isEn = getLanguage() === 'en';
    const iconEl = document.querySelector('#sd-hc-icon');
    const titleEl = document.querySelector('#sd-hc-title');
    const descEl = document.querySelector('#sd-hc-desc');

    if (iconEl) iconEl.textContent = mod.icon || '🔥';
    if (titleEl) titleEl.textContent = `${t('mp.hc_reminder_tag')} ${isEn ? mod.titleEn : mod.titleFr}`;
    if (descEl) descEl.textContent = isEn ? mod.descEn : mod.descFr;
  } else {
    reminderEl.classList.add('hidden');
  }
}

export function showHardcore1v1Intro(modifier) {
  if (!modifier) return;
  const dialog = document.querySelector('#mp-hardcore-intro-dialog');
  if (!dialog) return;

  const iconEl = document.querySelector('#mp-hc-intro-icon');
  const titleEl = document.querySelector('#mp-hc-intro-title');
  const descEl = document.querySelector('#mp-hc-intro-desc');
  const autoCloseEl = document.querySelector('#mp-hc-autoclose');
  const acceptBtn = document.querySelector('#mp-hc-accept-btn');

  const isEn = getLanguage() === 'en';
  if (iconEl) iconEl.textContent = modifier.icon || '🔥';
  if (titleEl) titleEl.textContent = isEn ? modifier.titleEn : modifier.titleFr;
  if (descEl) descEl.textContent = isEn ? modifier.descEn : modifier.descFr;

  let secondsLeft = 5;
  if (autoCloseEl) autoCloseEl.textContent = `(${secondsLeft}s)`;

  if (hcAutoCloseInterval) clearInterval(hcAutoCloseInterval);

  hcAutoCloseInterval = setInterval(() => {
    secondsLeft -= 1;
    if (autoCloseEl) autoCloseEl.textContent = `(${secondsLeft}s)`;
    if (secondsLeft <= 0) {
      clearInterval(hcAutoCloseInterval);
      hcAutoCloseInterval = null;
      if (dialog.open) dialog.close();
    }
  }, 1000);

  const closeDialog = () => {
    if (hcAutoCloseInterval) {
      clearInterval(hcAutoCloseInterval);
      hcAutoCloseInterval = null;
    }
    if (dialog.open) dialog.close();
  };

  if (acceptBtn) {
    acceptBtn.onclick = closeDialog;
  }

  safeShowModal(dialog);
}

export function updateTimerUI() {
  if (turnTimerDisplay) turnTimerDisplay.textContent = `⏱️ ${turnTimeLeft}s`;
  
  const timerNumEl = document.querySelector('#mp-turn-timer-num');
  if (timerNumEl) timerNumEl.textContent = turnTimeLeft;

  if (isMultiplayer) {
    const isMyTurn = currentTurn === myRole;
    const activeRoleName = currentTurn === 'host' 
      ? (getLanguage() === 'en' ? '🟢 Player 1' : '🟢 Joueur 1') 
      : (getLanguage() === 'en' ? '🔵 Player 2' : '🔵 Joueur 2');
    
    // Notification haptique sur smartphone lors du passage de main au joueur
    if (isMyTurn && lastKnownTurn !== myRole && lastKnownTurn !== null) {
      try {
        if ('vibrate' in navigator) navigator.vibrate([120, 60, 120]);
      } catch (e) {}
    }
    lastKnownTurn = currentTurn;

    const turnBadgeIcon = document.querySelector('#mp-turn-badge-icon');
    const turnTitleEl = document.querySelector('#mp-turn-title');
    const turnSubEl = document.querySelector('#mp-turn-sub');

    if (mpTurnBanner) {
      mpTurnBanner.classList.remove('hidden');
      if (isMyTurn) {
        mpTurnBanner.classList.add('is-my-turn');
        mpTurnBanner.classList.remove('is-opponent-turn');
        if (turnBadgeIcon) turnBadgeIcon.textContent = '🟢';
        if (turnTitleEl) turnTitleEl.textContent = t('mp.your_turn_title');
        if (turnSubEl) {
          turnSubEl.textContent = turnTimeLeft <= 10 ? t('mp.urgent_timer_sub') : t('mp.your_turn_sub');
        }
      } else {
        mpTurnBanner.classList.remove('is-my-turn');
        mpTurnBanner.classList.add('is-opponent-turn');
        if (turnBadgeIcon) turnBadgeIcon.textContent = '⏳';
        if (turnTitleEl) turnTitleEl.textContent = `${t('mp.opponent_turn_title')} (${activeRoleName})`;
        if (turnSubEl) {
          turnSubEl.textContent = turnTimeLeft <= 10 ? t('mp.urgent_timer_sub') : t('mp.opponent_turn_sub');
        }
      }

      if (turnTimeLeft <= 10) {
        mpTurnBanner.classList.add('warning');
        if (turnTimerDisplay) turnTimerDisplay.classList.add('warning');
      } else {
        mpTurnBanner.classList.remove('warning');
        if (turnTimerDisplay) turnTimerDisplay.classList.remove('warning');
      }
    }

    if (boardCard) {
      if (isMyTurn) {
        boardCard.classList.add('my-turn');
        boardCard.classList.remove('opponent-waiting');
      } else {
        boardCard.classList.remove('my-turn');
        boardCard.classList.add('opponent-waiting');
      }
    }

    // Pilules Joueur 1 / Joueur 2
    if (playerHostPill) playerHostPill.classList.toggle('active-turn', currentTurn === 'host');
    if (playerGuestPill) playerGuestPill.classList.toggle('active-turn', currentTurn === 'guest');

    // Texte legacy pour rétro-compatibilité
    if (mpTurnText) {
      if (isMyTurn) {
        mpTurnText.textContent = `${t('mp.your_turn_banner')} (⏱️ ${turnTimeLeft}s)`;
      } else {
        mpTurnText.textContent = `${t('mp.opponent_turn_banner')} (${activeRoleName} - ⏱️ ${turnTimeLeft}s)`;
      }
    }
  }
}

export function updateMultiplayerUI() {
  const modeSoloTab = document.querySelector('#mode-solo-tab');
  const modeHardcoreTab = document.querySelector('#mode-hardcore-tab');
  const modeMultiTab = document.querySelector('#mode-multi-tab');
  const modeBrTab = document.querySelector('#mode-br-tab');

  if (!isMultiplayer) {
    if (multiplayerBar) multiplayerBar.classList.add('hidden');
    if (mpTurnBanner) {
      mpTurnBanner.classList.add('hidden');
      mpTurnBanner.classList.remove('is-my-turn', 'is-opponent-turn', 'warning');
    }
    if (mpFeedCard) mpFeedCard.classList.add('hidden');
    if (boardCard) boardCard.classList.remove('my-turn', 'opponent-waiting');
    if (resetBtnLabel) resetBtnLabel.textContent = t('board.reset_btn');
    const descText = document.querySelector('#intro-desc-text');
    if (descText) descText.innerHTML = t('intro.desc', { badge: '<span class="info-badge">ⓘ</span>' });
    if (gameState.isHardcore) {
      if (modeSoloTab) modeSoloTab.classList.remove('active');
      if (modeHardcoreTab) modeHardcoreTab.classList.add('active');
    } else {
      if (modeSoloTab) modeSoloTab.classList.add('active');
      if (modeHardcoreTab) modeHardcoreTab.classList.remove('active');
    }
    if (modeMultiTab) modeMultiTab.classList.remove('active');
    if (modeBrTab) modeBrTab.classList.remove('active');
    lastKnownTurn = null;
    stopTurnTimer();
    updateHardcoreUI();
    return;
  }

  if (modeSoloTab) modeSoloTab.classList.remove('active');
  if (modeHardcoreTab) modeHardcoreTab.classList.remove('active');
  if (modeBrTab) modeBrTab.classList.remove('active');
  if (modeMultiTab) modeMultiTab.classList.add('active');
  
  if (multiplayerBar) multiplayerBar.classList.remove('hidden');
  if (mpTurnBanner) mpTurnBanner.classList.remove('hidden');
  if (mpFeedCard) mpFeedCard.classList.remove('hidden');
  if (resetBtnLabel) resetBtnLabel.textContent = t('board.propose_grid_btn');
  if (mpRoomCodeDisplay && currentRoomCode) {
    mpRoomCodeDisplay.textContent = `${t('mp.code_label')}${currentRoomCode}`;
  }

  // Ajout du badge (VOUS) sur le label du joueur local
  const hostLabel = document.querySelector('#player-host-label');
  const guestLabel = document.querySelector('#player-guest-label');
  const youTag = `<span class="player-you-tag">${t('mp.you_tag')}</span>`;
  if (hostLabel) {
    hostLabel.innerHTML = (getLanguage() === 'en' ? 'Player 1' : 'Joueur 1') + (myRole === 'host' ? youTag : '');
  }
  if (guestLabel) {
    guestLabel.innerHTML = (getLanguage() === 'en' ? 'Player 2' : 'Joueur 2') + (myRole === 'guest' ? youTag : '');
  }

  updateHardcoreUI();
  updateTimerUI();
}

const CATEGORY_NAMES = {
  fr: {
    geography: 'GÉO',
    flag: 'DRAPEAU',
    linguistic: 'LING.',
    language: 'LING.',
    economy: 'ÉCO',
    history: 'HIST.'
  },
  en: {
    geography: 'GEO',
    flag: 'FLAG',
    linguistic: 'LING.',
    language: 'LING.',
    economy: 'ECON',
    history: 'HIST.'
  }
};

export function clueHTML(item, row = false) {
  const label = getCriterionLabel(item);
  const desc = getCriterionDesc(item);
  const icon = item.icon || '';
  const lang = getLanguage() === 'en' ? 'en' : 'fr';
  const catShort = (CATEGORY_NAMES[lang] && CATEGORY_NAMES[lang][item.type]) || '';
  const tooltipAria = t('board.clue_tooltip');
  return `
    <div class="clue ${item.type} ${row ? 'row' : ''}">
      <div class="clue-header">
        <div class="clue-tag">
          ${icon ? `<span class="clue-icon" aria-hidden="true">${icon}</span>` : ''}
          <span class="clue-category">${escapeHtml(catShort)}</span>
        </div>
        <button class="info-icon" data-label="${escapeHtml((icon ? icon + ' ' : '') + label)}" data-desc="${escapeHtml(desc)}" aria-label="${escapeHtml(tooltipAria)}" title="${escapeHtml(tooltipAria)}">ⓘ</button>
      </div>
      <div class="clue-text">${escapeHtml(label)}</div>
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

  board.querySelectorAll('.clue').forEach((clueEl) => {
    clueEl.addEventListener('click', (e) => {
      const btn = clueEl.querySelector('.info-icon');
      if (btn) {
        showTooltip(btn.dataset.label, btn.dataset.desc);
      }
    });
  });

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
    const iconEl = langBtn.querySelector('.nav-btn-icon');
    const textEl = langBtn.querySelector('.nav-btn-text');
    if (iconEl && textEl) {
      const targetFlag = getLanguage() === 'fr' ? 'gb' : 'fr';
      const flagAlt = getLanguage() === 'fr' ? 'English' : 'Français';
      iconEl.innerHTML = `<img src="https://flagcdn.com/w40/${targetFlag}.png" alt="${flagAlt}" style="width: 20px; height: 14px; border-radius: 2px; object-fit: cover; display: inline-block; vertical-align: middle;" />`;
      textEl.textContent = t('nav.lang_label');
    } else {
      langBtn.textContent = t('nav.lang_toggle');
    }
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
  updateHardcoreUI();
  updateScoresUI();
  updateTimerUI();
}

// ==========================================
// BATTLE ROYALE UI LOGIC (3+ JOUEURS)
// ==========================================
export function updateBrLobbyUI() {
  const brDialog = document.querySelector('#battle-royale-dialog');
  if (brDialog && !brDialog.open) safeShowModal(brDialog);

  document.querySelector('#br-setup-view')?.classList.add('hidden');
  document.querySelector('#br-lobby-view')?.classList.remove('hidden');
  document.querySelector('#br-arena-view')?.classList.add('hidden');
  document.querySelector('#br-podium-view')?.classList.add('hidden');

  import('./battle_royale.js').then(({ brGameState }) => {
    import('./party_network.js').then(({ isBrHost, currentBrCode }) => {
      const codeVal = document.querySelector('#br-lobby-code-val');
      if (codeVal) codeVal.textContent = currentBrCode || '---';

      const inviteInput = document.querySelector('#br-invite-link-input');
      if (inviteInput) {
        inviteInput.value = `${window.location.origin}${window.location.pathname}?br=${currentBrCode || ''}`;
      }

      const countEl = document.querySelector('#br-lobby-player-count');
      if (countEl) countEl.textContent = `${brGameState.players.length}/8`;

      const listEl = document.querySelector('#br-lobby-players-list');
      if (listEl) {
        listEl.innerHTML = '';
        brGameState.players.forEach((p) => {
          const card = document.createElement('div');
          card.className = 'br-lobby-player-card';
          card.innerHTML = `
            <span class="br-player-avatar">${renderPlayerAvatar(p.avatar || '🌍')}</span>
            <div class="br-player-info">
              <span class="br-player-pseudo">${escapeHtml(p.pseudo)}</span>
              ${p.isHost ? `<span class="br-host-badge">${t('br.host_tag')}</span>` : ''}
            </div>
          `;
          listEl.appendChild(card);
        });
      }

      const hostControls = document.querySelector('#br-host-controls');
      const guestWaiting = document.querySelector('#br-guest-waiting');
      const startBtn = document.querySelector('#br-start-game-btn');

      if (isBrHost) {
        if (hostControls) hostControls.classList.remove('hidden');
        if (guestWaiting) guestWaiting.classList.add('hidden');
        if (startBtn) {
          startBtn.disabled = brGameState.players.length < 2;
          startBtn.textContent = t('br.start_game_btn', { count: brGameState.players.length });
        }
      } else {
        if (hostControls) hostControls.classList.add('hidden');
        if (guestWaiting) guestWaiting.classList.remove('hidden');
      }
    });
  });
}

export function updateBrArenaUI() {
  document.querySelector('#br-setup-view')?.classList.add('hidden');
  document.querySelector('#br-lobby-view')?.classList.add('hidden');
  document.querySelector('#br-arena-view')?.classList.remove('hidden');
  document.querySelector('#br-podium-view')?.classList.add('hidden');

  import('./battle_royale.js').then(({ brGameState }) => {
    import('./party_network.js').then(({ myBrPlayerId }) => {
      // Met à jour l'arène visuelle circulaire avec l'aiguille rotative
      updateBrCircleArena(brGameState.currentTurnPlayerId);

      const roundBadge = document.querySelector('#br-round-badge');
      if (roundBadge) roundBadge.textContent = t('br.round_badge', { round: brGameState.round });

      const criteriaList = document.querySelector('#br-criteria-cards');
      if (criteriaList) {
        criteriaList.innerHTML = '';
        brGameState.activeCriteria.forEach((crit) => {
          const card = document.createElement('div');
          card.className = 'br-criterion-card';
          const icon = crit.icon || '📌';
          const label = getCriterionLabel(crit);
          const desc = getCriterionDesc(crit);
          card.innerHTML = `
            <span class="br-crit-icon">${icon}</span>
            <div class="br-crit-text">
              <strong>${escapeHtml(label)}</strong>
              <small>${escapeHtml(desc)}</small>
            </div>
          `;
          criteriaList.appendChild(card);
        });
      }

      const survivorsList = document.querySelector('#br-survivors-list');
      if (survivorsList) {
        survivorsList.innerHTML = '';
        brGameState.players.forEach((p) => {
          const pill = document.createElement('div');
          const isCurrentTurn = p.id === brGameState.currentTurnPlayerId;
          pill.className = `br-survivor-pill ${isCurrentTurn ? 'active-turn' : ''} ${!p.isAlive ? 'eliminated' : ''}`;

          const hearts = p.isAlive ? '❤️'.repeat(p.lives) : '💀';
          pill.innerHTML = `
            <span class="br-survivor-avatar">${renderPlayerAvatar(p.avatar || '🌍')}</span>
            <span class="br-survivor-pseudo">${escapeHtml(p.pseudo)}</span>
            <span class="br-survivor-hearts">${hearts}</span>
          `;
          survivorsList.appendChild(pill);
        });
      }

      const turnPrompt = document.querySelector('#br-turn-prompt');
      const searchInput = document.querySelector('#br-country-search');
      const submitBtn = document.querySelector('#br-country-submit');

      const isMyTurn = brGameState.currentTurnPlayerId === myBrPlayerId;
      const me = brGameState.players.find((p) => p.id === myBrPlayerId);
      const isEliminated = me && !me.isAlive;

      if (isEliminated) {
        if (turnPrompt) {
          turnPrompt.textContent = t('br.spectator_msg');
          turnPrompt.className = 'br-turn-prompt spectator';
        }
        if (searchInput) { searchInput.disabled = true; searchInput.value = ''; }
        if (submitBtn) submitBtn.disabled = true;
      } else if (isMyTurn) {
        if (turnPrompt) {
          turnPrompt.textContent = t('br.your_turn_prompt');
          turnPrompt.className = 'br-turn-prompt my-turn';
        }
        if (searchInput) {
          searchInput.disabled = false;
          searchInput.focus();
        }
        if (submitBtn) submitBtn.disabled = false;
      } else {
        const activePlayer = brGameState.players.find((p) => p.id === brGameState.currentTurnPlayerId);
        const activeName = activePlayer ? activePlayer.pseudo : '...';
        if (turnPrompt) {
          turnPrompt.textContent = t('br.waiting_turn_prompt', { player: activeName });
          turnPrompt.className = 'br-turn-prompt other-turn';
        }
        if (searchInput) { searchInput.disabled = true; searchInput.value = ''; }
        if (submitBtn) submitBtn.disabled = true;
      }

      const usedList = document.querySelector('#br-used-countries-list');
      const usedCount = document.querySelector('#br-used-count');
      if (usedCount) usedCount.textContent = brGameState.usedCountries.length;

      if (usedList) {
        if (brGameState.usedCountries.length === 0) {
          usedList.innerHTML = `<span class="br-no-used-msg">${t('br.no_used_yet')}</span>`;
        } else {
          usedList.innerHTML = '';
          brGameState.usedCountries.forEach((item) => {
            const country = countries.find((c) => c.code === item.code);
            const iso2 = country?.iso2?.toLowerCase();
            const flagImg = iso2
              ? `<img src="https://flagcdn.com/w40/${iso2}.png" alt="" class="br-chip-flag" />`
              : '';
            const chip = document.createElement('div');
            chip.className = 'br-used-chip';
            chip.innerHTML = `
              ${flagImg}
              <span class="br-chip-name">${escapeHtml(item.name || item.code)}</span>
              <span class="br-chip-author" title="${escapeHtml(item.pseudo)}">${renderPlayerAvatar(item.avatar || '👤')}</span>
            `;
            usedList.appendChild(chip);
          });
        }
      }
    });
  });
}

/**
 * Rendu de l'Arène Visuelle Circulaire (Mode Bombe Party)
 * Positionne trigonométriquement les joueurs en cercle autour de la bombe
 * et oriente l'aiguille centrale vers le joueur actif.
 */
export function updateBrCircleArena(activePlayerId) {
  const circleArenaWrapper = document.querySelector('#br-circle-arena-wrapper');
  const linearTimer = document.querySelector('#br-linear-timer-container');
  if (!circleArenaWrapper) return;

  import('./battle_royale.js').then(({ brGameState }) => {
    import('./party_network.js').then(({ myBrPlayerId }) => {
      // Affiche l'arène circulaire uniquement en mode Bombe, sinon minuteur classique
      if (brGameState.mode === 'bomb') {
        circleArenaWrapper.classList.remove('hidden');
        if (linearTimer) linearTimer.classList.add('hidden');
      } else {
        circleArenaWrapper.classList.add('hidden');
        if (linearTimer) linearTimer.classList.remove('hidden');
        return;
      }

      const ringEl = document.querySelector('#br-circle-players-ring');
      const arrowWrapper = document.querySelector('#br-circle-arrow-wrapper');
      const players = brGameState.players || [];
      const numPlayers = players.length;
      if (numPlayers === 0) return;

      const effectiveActiveId = activePlayerId !== undefined ? activePlayerId : brGameState.currentTurnPlayerId;
      const activeIdx = players.findIndex((p) => p.id === effectiveActiveId);

      // Rotation de l'aiguille vers le joueur actif (en partant de midi / 0 deg)
      if (arrowWrapper && activeIdx >= 0) {
        const arrowAngle = (activeIdx / numPlayers) * 360;
        arrowWrapper.style.transform = `rotate(${arrowAngle}deg)`;
      }

      // Rendu des nœuds joueurs autour du cercle
      if (ringEl) {
        ringEl.innerHTML = '';
        players.forEach((p, idx) => {
          // Angle en degrés : index 0 à midi (-90 deg en trigonométrie standard)
          const angleDeg = (idx / numPlayers) * 360 - 90;
          const angleRad = (angleDeg * Math.PI) / 180;
          const radiusPct = numPlayers > 5 ? 44 : 39; // I7: Rayon élargi si >5 joueurs
          const xPct = 50 + radiusPct * Math.cos(angleRad);
          const yPct = 50 + radiusPct * Math.sin(angleRad);

          const isCurrentTurn = p.id === effectiveActiveId;
          const isMe = p.id === myBrPlayerId;
          const hearts = p.isAlive ? '❤️'.repeat(p.lives) : '💀';

          const node = document.createElement('div');
          node.className = `br-circle-player-node ${isCurrentTurn ? 'is-active-turn' : ''} ${!p.isAlive ? 'is-eliminated' : ''}`;
          node.style.left = `${xPct}%`;
          node.style.top = `${yPct}%`;

          node.innerHTML = `
            <span class="br-circle-node-avatar">${renderPlayerAvatar(p.avatar || '🌍')}</span>
            <span class="br-circle-node-pseudo" title="${escapeHtml(p.pseudo)}">${escapeHtml(p.pseudo)}</span>
            <span class="br-circle-node-hearts">${hearts}</span>
            ${isMe ? `<span class="br-circle-you-badge">${t('br.you_badge')}</span>` : ''}
          `;
          ringEl.appendChild(node);
        });
      }
    });
  });
}

export function updateBrTimerUI(remaining) {
  const timerNum = document.querySelector('#br-timer-seconds');
  const timerBar = document.querySelector('#br-timer-bar-fill');
  const bombIcon = document.querySelector('#br-bomb-icon');

  if (timerNum) timerNum.textContent = remaining;

  // Éléments de l'Arène Circulaire
  const circleTimerText = document.querySelector('#br-circle-timer-text');
  if (circleTimerText) circleTimerText.textContent = `${remaining}s`;
  const circleBombIcon = document.querySelector('#br-circle-bomb-icon');
  const circleHub = document.querySelector('#br-circle-center-hub');
  const fuseBadge = document.querySelector('#br-circle-fuse-badge');

  import('./battle_royale.js').then(({ brGameState }) => {
    const total = brGameState.timerDuration || 15;
    const pct = Math.max(0, Math.min(100, (remaining / total) * 100));

    if (timerBar) {
      timerBar.style.width = `${pct}%`;
      if (remaining <= 4) {
        timerBar.style.background = '#dc2626';
      } else if (remaining <= 8) {
        timerBar.style.background = '#f59e0b';
      } else {
        timerBar.style.background = '#10b981';
      }
    }

    if (bombIcon) {
      if (remaining <= 4) {
        bombIcon.classList.add('urgent-pulse');
      } else {
        bombIcon.classList.remove('urgent-pulse');
      }
    }

    if (circleBombIcon) {
      if (remaining <= 4) {
        circleBombIcon.classList.add('urgent-pulse');
      } else {
        circleBombIcon.classList.remove('urgent-pulse');
      }
    }

    if (circleHub) {
      if (remaining <= 4) {
        circleHub.style.borderColor = '#dc2626';
        circleHub.style.boxShadow = '0 0 18px rgba(220, 38, 38, 0.45)';
      } else if (remaining <= 8) {
        circleHub.style.borderColor = '#f59e0b';
        circleHub.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.3)';
      } else {
        circleHub.style.borderColor = '';
        circleHub.style.boxShadow = '';
      }
    }

    if (fuseBadge) {
      const currentTurnDuration = Math.max(5, (brGameState.timerDuration || 15) - ((brGameState.usedCountries?.length || 0) * 0.6));
      if (currentTurnDuration <= 8 || remaining <= 4) {
        fuseBadge.classList.remove('hidden');
      } else {
        fuseBadge.classList.add('hidden');
      }
    }
  });
}

export function renderPlayerAvatar(avatar, className = '') {
  if (!avatar) return `<span class="br-avatar-emoji ${className}">🌍</span>`;
  const trimmed = String(avatar).trim();
  if (/^[a-zA-Z]{2}$/.test(trimmed)) {
    const iso2 = trimmed.toLowerCase();
    return `<img src="https://flagcdn.com/w40/${iso2}.png" alt="${iso2.toUpperCase()}" class="br-avatar-flag-img ${className}" loading="lazy" />`;
  }
  return `<span class="br-avatar-emoji ${className}">${escapeHtml(trimmed)}</span>`;
}

export function updateBrPodiumUI(winner) {
  document.querySelector('#br-setup-view')?.classList.add('hidden');
  document.querySelector('#br-lobby-view')?.classList.add('hidden');
  document.querySelector('#br-arena-view')?.classList.add('hidden');
  document.querySelector('#br-podium-view')?.classList.remove('hidden');

  const winnerName = document.querySelector('#br-winner-name');
  const winnerAvatar = document.querySelector('#br-winner-avatar');
  const podiumList = document.querySelector('#br-podium-ranks');
  const replayBtn = document.querySelector('#br-replay-btn');
  const lobbyReturnBtn = document.querySelector('#br-lobby-return-btn');

  // M3: Titre alternatif si match nul (0 survivants)
  const podiumTitle = document.querySelector('.br-podium-title');
  const podiumDesc = document.querySelector('#br-podium-view p');
  if (winner) {
    if (winnerName) winnerName.textContent = winner.pseudo;
    if (winnerAvatar) winnerAvatar.innerHTML = renderPlayerAvatar(winner.avatar || '👑', 'br-winner-avatar-icon');
    if (podiumTitle) podiumTitle.textContent = t('br.winner_title');
  } else {
    if (winnerName) winnerName.textContent = t('br.draw_name') || 'Match Nul';
    if (winnerAvatar) winnerAvatar.innerHTML = '🤝';
    if (podiumTitle) podiumTitle.textContent = t('br.draw_title') || 'MATCH NUL ! 🤝';
    if (podiumDesc) podiumDesc.textContent = t('br.draw_desc') || 'Aucun survivant...';
  }

  import('./party_network.js').then(({ isBrHost }) => {
    if (replayBtn) {
      replayBtn.disabled = false;
      // M2: innerHTML avec emoji au lieu de textContent
      replayBtn.innerHTML = isBrHost ? `🔄 ${t('br.restart_game_host')}` : `🙋 ${t('br.request_rematch_guest')}`;
    }
    if (lobbyReturnBtn) {
      if (isBrHost) {
        lobbyReturnBtn.classList.remove('hidden');
        lobbyReturnBtn.textContent = t('br.return_lobby_btn');
      } else {
        lobbyReturnBtn.classList.add('hidden');
      }
    }
  });

  import('./battle_royale.js').then(({ brGameState }) => {
    if (podiumList) {
      podiumList.innerHTML = '';
      if (winner) {
        const row1 = document.createElement('div');
        row1.className = 'br-podium-row gold';
        row1.innerHTML = `<span>🥇 1er</span> <strong>${escapeHtml(winner.pseudo)}</strong> <span>${renderPlayerAvatar(winner.avatar || '👑')}</span>`;
        podiumList.appendChild(row1);
      }

      const reversedEliminated = [...brGameState.eliminatedOrder].reverse();
      const rankIcons = ['🥈 2e', '🥉 3e'];
      reversedEliminated.slice(0, 2).forEach((pid, idx) => {
        const p = brGameState.players.find((pl) => pl.id === pid);
        if (p) {
          const row = document.createElement('div');
          row.className = `br-podium-row ${idx === 0 ? 'silver' : 'bronze'}`;
          row.innerHTML = `<span>${rankIcons[idx]}</span> <strong>${escapeHtml(p.pseudo)}</strong> <span>${renderPlayerAvatar(p.avatar || '🌍')}</span>`;
          podiumList.appendChild(row);
        }
      });
    }
  });
}

export function addBrFeed(message, type = 'info') {
  const feedList = document.querySelector('#br-feed-list');
  if (!feedList) return;

  const item = document.createElement('div');
  item.className = `br-feed-item ${type}`;
  item.textContent = message;
  feedList.prepend(item);

  while (feedList.children.length > 25) {
    feedList.removeChild(feedList.lastChild);
  }
}

export function setBrFeedback(msg, type = 'normal') {
  const fb = document.querySelector('#br-setup-feedback');
  if (!fb) return;
  fb.textContent = msg;
  fb.className = `br-feedback-banner ${type}`;
}

// Écouteur global de changement de langue
onLanguageChange(() => {
  applyStaticTranslations();
});
