import { loadData, getCountryByCode } from './data.js';
import { setupLogging, sessionLogs } from './utils.js';
import { gameState, resetGameState, validateMove, checkTicTacToeWin, cellCandidates } from './game.js';
import { renderBoard, renderCountries, renderCountriesForSolution, updateMultiplayerUI, addGameFeed, searchDialog, searchDialogTitle, board, search, updateScoresUI, mpVictoryDialog, mpVictoryTitle, mpVictoryDesc, feedback } from './ui.js';
import { isMultiplayer, myRole, currentTurn, safeSend, startTurnTimer, stopTurnTimer, roomScores, initPeer, connectAsGuest, handleRoomClose, forceLeaveRoom, startNextMultiplayerMatch } from './network.js';

// Setup Global Error Handling
window.addEventListener('error', (event) => {
  console.error("Erreur globale capturée:", event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error("Promesse rejetée non gérée:", event.reason);
});

// Setup custom logger for bug reports
setupLogging();

const APP_VERSION = "v1.3";

// Init App
async function initApp() {
  console.log(`🌍 CountryDoku ${APP_VERSION}`);
  
  const success = await loadData();
  if (!success) {
    document.querySelector('#feedback').textContent = 'Erreur lors du chargement des données.';
    return;
  }

  // Setup UI Event Listeners
  setupEventListeners();

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
  if (resetBtnLabel) resetBtnLabel.textContent = isMultiplayer ? "Proposer une nouvelle grille" : "Nouvelle grille";
  document.querySelector('#progress').textContent = '0';
  document.querySelector('#feedback').textContent = 'Cliquez sur une case de la grille pour commencer.';
  
  const heartsListEl = document.querySelector('#hearts-list');
  if (heartsListEl) heartsListEl.innerHTML = '❤️ ❤️ ❤️';
  
  renderBoard(newSeed);
}

function handleCellChoose(code) {
  if (isMultiplayer && currentTurn !== myRole) {
    if (searchDialog && searchDialog.open) searchDialog.close();
    gameState.selectedCell = null;
    feedback.textContent = "⏱️ Temps écoulé ! Ce n'est plus votre tour de jouer.";
    return;
  }

  const selectedCell = gameState.selectedCell;
  if (selectedCell === null) return;
  const isMatch = validateMove(selectedCell, code);
  searchDialog.close();

  if (!isMatch) {
    if (isMultiplayer) {
      const nextTurn = myRole === 'host' ? 'guest' : 'host';
      safeSend({ type: 'WRONG_MOVE', cellId: selectedCell, countryCode: code, player: myRole, nextTurn });
      feedback.textContent = `❌ Choix INCORRECT ! Tour à l'adversaire.`;
      addGameFeed(`❌ Vous avez proposé un pays incorrect. Tour à l'adversaire.`, 'wrong');
      gameState.selectedCell = null;
      updateMultiplayerUI();
      renderBoard();
      return;
    }

    gameState.lives -= 1;
    import('./ui.js').then(ui => ui.updateLivesUI());
    
    if (gameState.lives <= 0) {
      feedback.textContent = `💔 Défaite ! Vos 3 vies sont épuisées.`;
      gameState.selectedCell = null;
      renderBoard();
      return;
    }
    
    feedback.textContent = `❌ Pays incorrect (-1 vie).`;
    gameState.selectedCell = null;
    renderBoard();
    return;
  }

  // Coup Valide
  const country = getCountryByCode(code);
  if (isMultiplayer) {
    gameState.answers[selectedCell] = { country, player: myRole };
    const nextTurn = myRole === 'host' ? 'guest' : 'host';
    safeSend({ type: 'MAKE_MOVE', cellId: selectedCell, countryCode: code, player: myRole, nextTurn });

    const winLine = checkTicTacToeWin(myRole);
    if (winLine) {
      stopTurnTimer();
      roomScores[myRole] += 1;
      updateScoresUI();
      mpVictoryTitle.textContent = `Victoire ! 🎉`;
      mpVictoryDesc.textContent = `Vous avez aligné 3 cases et remporté ce match de Tic-Tac-Toe !`;
      mpVictoryDialog.showModal();
    } else if (gameState.answers.filter(Boolean).length === 9) {
      stopTurnTimer();
      mpVictoryDialog.showModal();
    } else {
      addGameFeed(`✅ Vous avez placé ${country.name}. Tour à l'adversaire.`, 'correct');
      updateMultiplayerUI();
      startTurnTimer();
    }
  } else {
    gameState.answers[selectedCell] = { country };
    const count = gameState.answers.filter(Boolean).length;
    document.querySelector('#progress').textContent = count;
    feedback.textContent = count === 9 ? '🎉 Bravo ! Grille entièrement complétée !' : `✅ Bonne réponse (${country.name}) !`;
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
    document.querySelector('#room-dialog').showModal();
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

  document.querySelector('#close-room').addEventListener('click', handleRoomClose);
  document.querySelector('#create-room-btn').addEventListener('click', () => initPeer(null, true));
  document.querySelector('#join-room-btn').addEventListener('click', () => {
    const code = document.querySelector('#room-code-input').value.trim().toUpperCase();
    if (code) connectAsGuest(code);
  });
  
  document.querySelector('#cancel-leave-btn').addEventListener('click', () => document.querySelector('#confirm-leave-dialog').close());
  document.querySelector('#confirm-leave-btn').addEventListener('click', forceLeaveRoom);
  document.querySelector('#leave-mp-btn').addEventListener('click', forceLeaveRoom);

  document.querySelector('#copy-link-btn')?.addEventListener('click', () => {
    const linkInput = document.querySelector('#invite-link-input');
    if (!linkInput) return;
    linkInput.select();
    document.execCommand('copy');
    const btn = document.querySelector('#copy-link-btn');
    const oldText = btn.innerHTML;
    btn.innerHTML = '✅ Copié !';
    setTimeout(() => btn.innerHTML = oldText, 2000);
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
      feedback.textContent = `⏳ Ce n'est pas votre tour ! Attendez le coup de l'adversaire.`;
      return;
    }

    const rowIndex = Math.floor(id / 3);
    const columnIndex = id % 3;
    const candidates = cellCandidates(gameState.rows[rowIndex], gameState.columns[columnIndex]);

    if (!isMultiplayer && gameState.lives <= 0) {
      gameState.selectedCell = id;
      renderBoard();
      if (searchDialogTitle) searchDialogTitle.textContent = `💡 Solutions pour la Case ${id + 1}`;
      if (search) search.style.display = 'none';
      const candidatesCountEl = document.querySelector('#candidates-count');
      if (candidatesCountEl) candidatesCountEl.textContent = `💡 ${candidates.length} solution(s)`;
      const searchDialogClues = document.querySelector('#search-dialog-clues');
      if (searchDialogClues) searchDialogClues.textContent = `${gameState.rows[rowIndex].name} + ${gameState.columns[columnIndex].name}`;
      
      const cellTargetTag = document.querySelector('#cell-target-tag');
      if (cellTargetTag) cellTargetTag.textContent = `CASE ${id + 1}`;
      
      renderCountriesForSolution(candidates);
      searchDialog.showModal();
      return;
    }

    gameState.selectedCell = id;
    if (search) search.style.display = '';
    if (searchDialogTitle) searchDialogTitle.textContent = 'Choisir un pays';
    const candidatesCountEl = document.querySelector('#candidates-count');
    if (candidatesCountEl) candidatesCountEl.textContent = `💡 ${candidates.length} pays possibles`;
    const searchDialogClues = document.querySelector('#search-dialog-clues');
    if (searchDialogClues) searchDialogClues.textContent = `${gameState.rows[rowIndex].name} + ${gameState.columns[columnIndex].name}`;

    const cellTargetTag = document.querySelector('#cell-target-tag');
    if (cellTargetTag) cellTargetTag.textContent = `CASE ${id + 1}`;

    search.value = '';
    renderBoard();
    renderCountries(handleCellChoose);
    searchDialog.showModal();
    setTimeout(() => search.focus(), 50);
  });

  document.querySelector('#reset-button').addEventListener('click', () => {
    if (isMultiplayer) {
      safeSend({ type: 'PROPOSE_NEW_GRID', sender: myRole });
      feedback.textContent = "⏳ Demande envoyée à l'adversaire...";
    } else {
      resetGame(true);
    }
  });

  // Bug Report
  document.querySelector('#report-button').addEventListener('click', () => {
    const reportDialog = document.querySelector('#report-dialog');
    const logsPreview = document.querySelector('#report-logs-preview');
    if (logsPreview) logsPreview.value = sessionLogs.join('\n');
    if (reportDialog) reportDialog.showModal();
  });
  document.querySelector('#close-report').addEventListener('click', () => {
    const reportDialog = document.querySelector('#report-dialog');
    if (reportDialog) reportDialog.close();
  });

  // Rebranchement des événements manquants suite à la modularisation
  document.querySelector('#brand-logo')?.addEventListener('click', () => window.location.reload());
  
  document.querySelector('#help-button')?.addEventListener('click', () => document.querySelector('#help-dialog')?.showModal());
  document.querySelector('#close-help')?.addEventListener('click', () => document.querySelector('#help-dialog')?.close());
  document.querySelector('#start-button')?.addEventListener('click', () => document.querySelector('#help-dialog')?.close());

  document.querySelector('#retry-same-btn')?.addEventListener('click', () => { document.querySelector('#game-over-dialog')?.close(); resetGame(false); });
  document.querySelector('#new-grid-btn')?.addEventListener('click', () => { document.querySelector('#game-over-dialog')?.close(); resetGame(true); });

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
    safeSend({ type: 'ACCEPT_PROPOSAL' });
    startNextMultiplayerMatch(true);
    document.querySelector('#grid-proposal-dialog')?.close();
  });

  document.querySelector('#accept-new-grid-btn')?.addEventListener('click', () => {
    safeSend({ type: 'ACCEPT_PROPOSAL' });
    startNextMultiplayerMatch(false);
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
    btn.textContent = '✅ Copié !';
    setTimeout(() => btn.textContent = old, 2000);
  });
}

initApp();
