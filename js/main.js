import { loadData, getCountryByCode } from './data.js';
import { setupLogging, sessionLogs } from './utils.js';
import { gameState, resetGameState, validateMove, checkTicTacToeWin, cellCandidates, getMoveValidationDetails } from './game.js';
import { renderBoard, renderCountries, renderCountriesForSolution, updateMultiplayerUI, addGameFeed, searchDialog, searchDialogTitle, board, search, updateScoresUI, mpVictoryDialog, mpVictoryTitle, mpVictoryDesc, feedback, gameoverDialog, safeShowModal, applyStaticTranslations, setFeedback } from './ui.js';
import { isMultiplayer, myRole, currentTurn, setCurrentTurn, safeSend, startTurnTimer, stopTurnTimer, roomScores, initPeer, connectAsGuest, handleRoomClose, forceLeaveRoom, startNextMultiplayerMatch } from './network.js';
import { recordChoice, getChoicePercentage } from './stats.js';
import { initLanguage, getLanguage, setLanguage, t, getCountryName } from './i18n.js';

// Setup Global Error Handling
window.addEventListener('error', (event) => {
  console.error("Erreur globale capturée:", event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error("Promesse rejetée non gérée:", event.reason);
});

// Setup custom logger for bug reports
setupLogging();

const APP_VERSION = "v1.5";

// Init App
async function initApp() {
  try {
    const text = await fetch(import.meta.url).then(r => r.text());
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 8);
    console.log(`🌍 CountryDoku ${APP_VERSION} [Hash: #${hash}]`);
  } catch (e) {
    console.log(`🌍 CountryDoku ${APP_VERSION}`);
  }
  
  // Initialiser la langue (FR / EN)
  initLanguage();

  const success = await loadData();
  if (!success) {
    document.querySelector('#feedback').textContent = getLanguage() === 'en' ? 'Error loading country data.' : 'Erreur lors du chargement des données.';
    return;
  }

  // Setup UI Event Listeners
  setupEventListeners();

  // Appliquer les textes traduits
  applyStaticTranslations();

  // URL Room check
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  if (roomParam) {
    document.querySelector('#room-code-input').value = roomParam;
    connectAsGuest(roomParam.toUpperCase());
  } else {
    resetGame(true);
  }

  // Service Worker Registration (PWA)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }).catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }
}

function resetGame(newSeed = true) {
  resetGameState(newSeed);
  search.value = '';
  search.style.display = '';
  
  const resetBtnLabel = document.querySelector('#reset-btn-label');
  if (resetBtnLabel) resetBtnLabel.textContent = isMultiplayer ? t('board.propose_grid_btn') : t('board.reset_btn');
  document.querySelector('#progress').textContent = '0';
  setFeedback(t('board.default_feedback'), 'normal');
  
  const heartsListEl = document.querySelector('#hearts-list');
  if (heartsListEl) heartsListEl.innerHTML = '❤️ ❤️ ❤️';
  
  renderBoard(newSeed);
}

function handleCellChoose(code) {
  if (isMultiplayer && currentTurn !== myRole) {
    if (searchDialog && searchDialog.open) searchDialog.close();
    gameState.selectedCell = null;
    setFeedback(t('board.timeout_loss'), 'wrong');
    return;
  }

  const selectedCell = gameState.selectedCell;
  if (selectedCell === null) return;

  const cellNumber = selectedCell + 1;
  const details = getMoveValidationDetails(selectedCell, code);
  const isMatch = details.isValid;
  searchDialog.close();

  if (!isMatch) {
    const countryName = details.country ? getCountryName(details.country) : code;
    if (isMultiplayer) {
      const nextTurn = myRole === 'host' ? 'guest' : 'host';
      setCurrentTurn(nextTurn);
      safeSend({ 
        type: 'WRONG_MOVE', 
        cellId: selectedCell, 
        countryCode: code, 
        countryName, 
        reason: details.reason, 
        player: myRole, 
        nextTurn 
      });
      const wrongSelfMsg = t('board.mp_wrong_self', { country: countryName, cell: cellNumber, reason: details.reason });
      setFeedback(wrongSelfMsg, 'wrong');
      addGameFeed(`❌ ${countryName} [Case ${cellNumber}] (${details.reason})`, 'wrong');
      gameState.selectedCell = null;
      updateMultiplayerUI();
      renderBoard();
      startTurnTimer();
      return;
    }

    gameState.lives -= 1;
    import('./ui.js').then(ui => ui.updateLivesUI());
    
    if (gameState.lives <= 0) {
      setFeedback(t('board.game_over', { country: countryName, cell: cellNumber, reason: details.reason }), 'wrong');
      gameState.selectedCell = null;
      renderBoard();
      // F-01 FIX: Afficher la modale Game Over
      if (gameoverDialog && !gameoverDialog.open) gameoverDialog.showModal();
      return;
    }
    
    const plural = gameState.lives > 1 ? 's' : '';
    setFeedback(t('board.incorrect_answer', { country: countryName, cell: cellNumber, reason: details.reason, lives: gameState.lives, plural }), 'wrong');
    gameState.selectedCell = null;
    renderBoard();
    return;
  }

  // Coup Valide
  const country = getCountryByCode(code);
  const countryName = getCountryName(country);
  const rowIndex = Math.floor(selectedCell / 3);
  const columnIndex = selectedCell % 3;
  const rowCriterion = gameState.rows[rowIndex];
  const colCriterion = gameState.columns[columnIndex];
  const rowLabel = rowCriterion?.labelFr || rowCriterion?.label;
  const colLabel = colCriterion?.labelFr || colCriterion?.label;

  recordChoice(rowLabel, colLabel, code);
  const pct = getChoicePercentage(rowLabel, colLabel, code);
  const pctText = (pct !== null && pct !== undefined) 
    ? (getLanguage() === 'en' ? ` (${pct}% of players)` : ` (${pct}% des joueurs)`) 
    : '';

  if (isMultiplayer) {
    gameState.answers[selectedCell] = { country, player: myRole };
    const nextTurn = myRole === 'host' ? 'guest' : 'host';
    safeSend({ type: 'MAKE_MOVE', cellId: selectedCell, countryCode: code, player: myRole, nextTurn });

    const winLine = checkTicTacToeWin(myRole);
    if (winLine) {
      stopTurnTimer();
      roomScores[myRole] += 1;
      updateScoresUI();
      mpVictoryTitle.textContent = t('dialog.victory_title');
      mpVictoryDesc.textContent = t('dialog.victory_desc');
      safeShowModal(mpVictoryDialog);
    } else if (gameState.answers.filter(Boolean).length === 9) {
      stopTurnTimer();
      mpVictoryTitle.textContent = t('dialog.draw_title');
      mpVictoryDesc.textContent = t('dialog.draw_desc');
      safeShowModal(mpVictoryDialog);
    } else {
      const nextTurn = myRole === 'host' ? 'guest' : 'host';
      setCurrentTurn(nextTurn);
      const placedSelfMsg = t('board.mp_correct_self', { country: countryName, cell: cellNumber, pct: pctText });
      setFeedback(placedSelfMsg, 'correct');
      addGameFeed(`✅ ${countryName}${pctText} (Case ${cellNumber})`, 'correct');
      updateMultiplayerUI();
      startTurnTimer();
    }
  } else {
    gameState.answers[selectedCell] = { country };
    const count = gameState.answers.filter(Boolean).length;
    document.querySelector('#progress').textContent = count;
    const correctMsg = count === 9 ? t('board.game_complete') : t('board.correct_answer', { country: countryName, pct: pctText });
    setFeedback(correctMsg, 'correct');
  }

  gameState.selectedCell = null;
  renderBoard();
}

function setupEventListeners() {
  // Navigation / Modes
  const multiToggleBtn = document.querySelector('#multi-toggle-btn');
  const modeMultiTab = document.querySelector('#mode-multi-tab');
  const modeSoloTab = document.querySelector('#mode-solo-tab');

  const openMultiplayerModal = () => {
    document.querySelector('#room-options-view').classList.remove('hidden');
    document.querySelector('#room-created-view').classList.add('hidden');
    const roomDialog = document.querySelector('#room-dialog');
    safeShowModal(roomDialog); // F-05 FIX
  };

  if (multiToggleBtn) multiToggleBtn.addEventListener('click', openMultiplayerModal);
  if (modeMultiTab) modeMultiTab.addEventListener('click', openMultiplayerModal);
  if (modeSoloTab) {
    modeSoloTab.addEventListener('click', () => {
      if (isMultiplayer) handleRoomClose();
      else {
        modeSoloTab.classList.add('active');
        if (modeMultiTab) modeMultiTab.classList.remove('active');
      }
    });
  }

  // Sélecteur de langue (FR / EN)
  const langToggleBtn = document.querySelector('#lang-toggle-btn');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      const nextLang = getLanguage() === 'fr' ? 'en' : 'fr';
      setLanguage(nextLang);
    });
  }

  document.querySelector('#close-room').addEventListener('click', handleRoomClose);
  document.querySelector('#create-room-btn').addEventListener('click', () => initPeer(null, true));
  document.querySelector('#join-room-btn').addEventListener('click', () => {
    const code = document.querySelector('#room-code-input').value.trim().toUpperCase();
    if (code) connectAsGuest(code);
  });

  // E-02 FIX: Touche Entrée pour rejoindre un salon
  document.querySelector('#room-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = e.target.value.trim().toUpperCase();
      if (code) connectAsGuest(code);
    }
  });
  
  document.querySelector('#cancel-leave-btn').addEventListener('click', () => document.querySelector('#confirm-leave-dialog').close());
  document.querySelector('#confirm-leave-btn').addEventListener('click', forceLeaveRoom);
  document.querySelector('#leave-mp-btn').addEventListener('click', forceLeaveRoom);

  document.querySelector('#copy-link-btn')?.addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('#copy-link-btn');
      const oldText = btn.innerHTML;
      btn.innerHTML = t('mp.copied');
      setTimeout(() => btn.innerHTML = oldText, 2000);
    }).catch(() => {
      const linkInput = document.querySelector('#invite-link-input');
      if (linkInput) { linkInput.select(); document.execCommand('copy'); }
    });
  });

  document.querySelector('#modal-copy-link-btn')?.addEventListener('click', () => {
    const linkInput = document.querySelector('#invite-link-input');
    const url = linkInput ? linkInput.value : window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('#modal-copy-link-btn');
      const oldText = btn.innerHTML;
      btn.innerHTML = t('mp.link_copied');
      setTimeout(() => btn.innerHTML = oldText, 2000);
    });
  });

  // Search Dialog
  search.addEventListener('input', () => renderCountries(handleCellChoose));
  document.querySelector('#close-search').addEventListener('click', () => {
    searchDialog.close();
    gameState.selectedCell = null;
    renderBoard();
  });

  // Cell clicks handled dynamically in renderBoard (delegation)
  board.addEventListener('click', (e) => {
    const cellBtn = e.target.closest('.cell');
    if (!cellBtn) return;
    
    const id = Number(cellBtn.dataset.cell);
    if (gameState.answers[id]) return;

    if (isMultiplayer && currentTurn !== myRole) {
      setFeedback(t('board.not_your_turn'), 'wrong');
      return;
    }

    const rowIndex = Math.floor(id / 3);
    const columnIndex = id % 3;
    const candidates = cellCandidates(gameState.rows[rowIndex], gameState.columns[columnIndex]);

    if (!isMultiplayer && gameState.lives <= 0) {
      gameState.selectedCell = id;
      renderBoard();
      if (searchDialogTitle) searchDialogTitle.textContent = t('dialog.search_solutions_title', { cell: id + 1 });
      if (search) search.style.display = 'none';
      const candidatesCountEl = document.querySelector('#candidates-count');
      if (candidatesCountEl) candidatesCountEl.textContent = t('dialog.search_solutions_count', { count: candidates.length });
      const searchDialogClues = document.querySelector('#search-dialog-clues');
      if (searchDialogClues) {
        const rCrit = gameState.rows[rowIndex];
        const cCrit = gameState.columns[columnIndex];
        const rLabel = (rCrit?.icon ? `${rCrit.icon} ` : '') + (rCrit?.label || '');
        const cLabel = (cCrit?.icon ? `${cCrit.icon} ` : '') + (cCrit?.label || '');
        searchDialogClues.textContent = `${t('dialog.search_clues_prefix')}${rLabel} + ${cLabel}`;
      }
      
      const cellTargetTag = document.querySelector('#cell-target-tag');
      if (cellTargetTag) cellTargetTag.textContent = t('dialog.cell_tag', { cell: id + 1 });
      
      renderCountriesForSolution(candidates);
      safeShowModal(searchDialog); // F-05 FIX
      return;
    }

    gameState.selectedCell = id;
    if (search) search.style.display = '';
    if (searchDialogTitle) searchDialogTitle.textContent = t('dialog.search_title');
    const candidatesCountEl = document.querySelector('#candidates-count');
    if (candidatesCountEl) candidatesCountEl.textContent = t('dialog.search_valid_count', { count: candidates.length });
    const searchDialogClues = document.querySelector('#search-dialog-clues');
    if (searchDialogClues) {
      const rCrit = gameState.rows[rowIndex];
      const cCrit = gameState.columns[columnIndex];
      const rLabel = (rCrit?.icon ? `${rCrit.icon} ` : '') + (rCrit?.label || '');
      const cLabel = (cCrit?.icon ? `${cCrit.icon} ` : '') + (cCrit?.label || '');
      searchDialogClues.textContent = `${t('dialog.search_clues_prefix')}${rLabel} + ${cLabel}`;
    }

    const cellTargetTag = document.querySelector('#cell-target-tag');
    if (cellTargetTag) cellTargetTag.textContent = t('dialog.cell_tag', { cell: id + 1 });

    search.value = '';
    renderBoard();
    renderCountries(handleCellChoose);
    safeShowModal(searchDialog); // F-05 FIX
    setTimeout(() => search.focus(), 50);
  });

  document.querySelector('#reset-button').addEventListener('click', () => {
    if (isMultiplayer) {
      safeSend({ type: 'PROPOSE_NEW_GRID', sender: myRole });
      setFeedback(t('board.req_sent'), 'normal');
    } else {
      resetGame(true);
    }
  });

  // Bug Report
  document.querySelector('#report-button').addEventListener('click', () => {
    const reportDialog = document.querySelector('#report-dialog');
    const logsPreview = document.querySelector('#report-logs-preview');
    if (logsPreview) logsPreview.value = sessionLogs.join('\n');
    safeShowModal(reportDialog); // F-05 FIX
  });
  document.querySelector('#close-report').addEventListener('click', () => {
    const reportDialog = document.querySelector('#report-dialog');
    if (reportDialog) reportDialog.close();
  });

  document.querySelector('#brand-logo')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (isMultiplayer) {
      handleRoomClose();
    } else {
      resetGame(true);
    }
  });
  
  document.querySelector('#help-button')?.addEventListener('click', () => {
    const d = document.querySelector('#help-dialog');
    safeShowModal(d); // F-05 FIX
  });
  document.querySelector('#close-help')?.addEventListener('click', () => document.querySelector('#help-dialog')?.close());
  document.querySelector('#start-button')?.addEventListener('click', () => document.querySelector('#help-dialog')?.close());

  // F-01 FIX: Utiliser le bon sélecteur #gameover-dialog
  document.querySelector('#retry-same-btn')?.addEventListener('click', () => { document.querySelector('#gameover-dialog')?.close(); resetGame(false); });
  document.querySelector('#new-grid-btn')?.addEventListener('click', () => { document.querySelector('#gameover-dialog')?.close(); resetGame(true); });

  document.querySelector('#close-mp-victory')?.addEventListener('click', () => document.querySelector('#mp-victory-dialog')?.close());
  document.querySelector('#mp-view-board-btn')?.addEventListener('click', () => document.querySelector('#mp-victory-dialog')?.close());

  document.querySelector('#mp-rematch-btn')?.addEventListener('click', () => {
    safeSend({ type: 'PROPOSE_REMATCH', sender: myRole });
    document.querySelector('#mp-victory-dialog')?.close();
  });
  
  document.querySelector('#mp-new-match-btn')?.addEventListener('click', () => {
    safeSend({ type: 'PROPOSE_NEW_GRID', sender: myRole });
    document.querySelector('#mp-victory-dialog')?.close();
  });

  document.querySelector('#accept-rematch-grid-btn')?.addEventListener('click', () => {
    safeSend({ type: 'ACCEPT_PROPOSAL', sameGrid: true });
    if (myRole === 'host') startNextMultiplayerMatch(true);
    document.querySelector('#grid-proposal-dialog')?.close();
  });

  document.querySelector('#accept-new-grid-btn')?.addEventListener('click', () => {
    safeSend({ type: 'ACCEPT_PROPOSAL', sameGrid: false });
    if (myRole === 'host') startNextMultiplayerMatch(false);
    document.querySelector('#grid-proposal-dialog')?.close();
  });

  document.querySelector('#decline-grid-btn')?.addEventListener('click', () => {
    safeSend({ type: 'DECLINE_PROPOSAL' });
    document.querySelector('#grid-proposal-dialog')?.close();
  });

  document.querySelector('#close-grid-proposal')?.addEventListener('click', () => document.querySelector('#grid-proposal-dialog')?.close());

  document.querySelector('#send-report-email-btn')?.addEventListener('click', () => {
    window.location.href = 'mailto:support@countrydoku.com?subject=Bug Report';
  });
  
  document.querySelector('#copy-report-logs-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(JSON.stringify(sessionLogs, null, 2));
    const btn = document.querySelector('#copy-report-logs-btn');
    const old = btn.textContent;
    btn.textContent = t('mp.copied');
    setTimeout(() => btn.textContent = old, 2000);
  });
}

initApp();
