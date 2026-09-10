import { loadData, getCountryByCode, countriesSearchIndex } from './data.js';
import { setupLogging, sessionLogs } from './utils.js';
import { gameState, resetGameState, validateMove, checkTicTacToeWin, cellCandidates, getMoveValidationDetails, exportGridSeed, applyGridSeed } from './game.js';
import { renderBoard, renderCountries, renderCountriesForSolution, updateMultiplayerUI, updateHardcoreUI, updateLivesUI, addGameFeed, searchDialog, searchDialogTitle, board, search, updateScoresUI, mpVictoryDialog, mpVictoryTitle, mpVictoryDesc, feedback, gameoverDialog, safeShowModal, applyStaticTranslations, setFeedback, updateSearchDialogHardcoreReminder } from './ui.js';
import { isMultiplayer, myRole, currentTurn, setCurrentTurn, safeSend, startTurnTimer, stopTurnTimer, roomScores, initPeer, connectAsGuest, handleRoomClose, forceLeaveRoom, startNextMultiplayerMatch } from './network.js';
import { initPartyHost, joinPartyGuest, hostStartGame, hostRestartGame, hostReturnToLobby, requestReplayGuest, isBrHost, submitCountryMove, leaveParty, isPartyMode } from './party_network.js';
import { brGameState } from './battle_royale.js';
import { recordChoice, getChoicePercentage, syncGlobalStats } from './stats.js';
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

const APP_VERSION = "v1.8";

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

  // Synchronisation asynchrone des statistiques mondiales Supabase
  syncGlobalStats();

  // URL Room, BR & Seed check
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  const seedParam = urlParams.get('seed');
  const brParam = urlParams.get('br');

  if (roomParam) {
    document.querySelector('#room-code-input').value = roomParam;
    connectAsGuest(roomParam.toUpperCase());
  } else if (brParam) {
    resetGame(true);
    const joinCodeInput = document.querySelector('#br-join-code-input');
    if (joinCodeInput) joinCodeInput.value = brParam.toUpperCase();
    const brDialog = document.querySelector('#battle-royale-dialog');
    if (brDialog) {
      document.querySelector('#br-setup-view')?.classList.remove('hidden');
      document.querySelector('#br-lobby-view')?.classList.add('hidden');
      document.querySelector('#br-arena-view')?.classList.add('hidden');
      document.querySelector('#br-podium-view')?.classList.add('hidden');
      safeShowModal(brDialog);
    }
  } else if (seedParam && applyGridSeed(seedParam)) {
    search.value = '';
    search.style.display = '';
    document.querySelector('#progress').textContent = '0';
    updateLivesUI();
    updateHardcoreUI();
    renderBoard(true);
    setFeedback(t('dialog.seed_loaded'), 'correct');
  } else {
    resetGame(true);
  }

  // Service Worker Registration (PWA) avec mise à jour automatique
  if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[App] Nouveau Service Worker activé, rechargement automatique...');
        window.location.reload();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        // Force la détection immédiate de mise à jour au chargement
        registration.update();
      }).catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }
}

function resetGame(newSeed = true, isHardcore = null) {
  resetGameState(newSeed, isHardcore);
  search.value = '';
  search.style.display = '';
  
  const resetBtnLabel = document.querySelector('#reset-btn-label');
  if (resetBtnLabel) resetBtnLabel.textContent = isMultiplayer ? t('board.propose_grid_btn') : t('board.reset_btn');
  document.querySelector('#progress').textContent = '0';
  setFeedback(t('board.default_feedback'), 'normal');
  
  updateLivesUI();
  updateHardcoreUI();
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
    updateLivesUI();
    
    if (gameState.lives <= 0) {
      const gameOverMsg = gameState.isHardcore
        ? t('board.hardcore_game_over', { country: countryName, cell: cellNumber, reason: details.reason })
        : t('board.game_over', { country: countryName, cell: cellNumber, reason: details.reason });
      setFeedback(gameOverMsg, 'wrong');
      gameState.selectedCell = null;
      renderBoard();
      // F-01 FIX: Afficher la modale Game Over avec le texte adapté
      const gameOverDesc = document.querySelector('#gameover-dialog p');
      if (gameOverDesc) {
        gameOverDesc.textContent = gameState.isHardcore ? t('dialog.gameover_desc_hardcore') : t('dialog.gameover_desc');
      }
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
  const modeHardcoreTab = document.querySelector('#mode-hardcore-tab');
  const modeBrTab = document.querySelector('#mode-br-tab');
  const brToggleBtn = document.querySelector('#br-toggle-btn');
  const hardcoreRerollBtn = document.querySelector('#hardcore-reroll-btn');

  const openMultiplayerModal = () => {
    if (isPartyMode) leaveParty();
    document.querySelector('#room-options-view').classList.remove('hidden');
    document.querySelector('#room-created-view').classList.add('hidden');
    const roomDialog = document.querySelector('#room-dialog');
    safeShowModal(roomDialog); // F-05 FIX
  };

  const openBattleRoyaleModal = () => {
    if (isMultiplayer) handleRoomClose();
    const brDialog = document.querySelector('#battle-royale-dialog');
    if (brDialog) {
      if (!isPartyMode) {
        document.querySelector('#br-setup-view')?.classList.remove('hidden');
        document.querySelector('#br-lobby-view')?.classList.add('hidden');
        document.querySelector('#br-arena-view')?.classList.add('hidden');
        document.querySelector('#br-podium-view')?.classList.add('hidden');
      }
      safeShowModal(brDialog);
    }
  };

  if (multiToggleBtn) multiToggleBtn.addEventListener('click', openMultiplayerModal);
  if (modeMultiTab) modeMultiTab.addEventListener('click', openMultiplayerModal);
  if (brToggleBtn) brToggleBtn.addEventListener('click', openBattleRoyaleModal);
  if (modeBrTab) modeBrTab.addEventListener('click', openBattleRoyaleModal);

  if (modeSoloTab) {
    modeSoloTab.addEventListener('click', () => {
      if (isMultiplayer) handleRoomClose();
      if (isPartyMode) leaveParty();
      if (gameState.isHardcore) {
        resetGame(true, false);
      } else {
        modeSoloTab.classList.add('active');
        if (modeMultiTab) modeMultiTab.classList.remove('active');
        if (modeHardcoreTab) modeHardcoreTab.classList.remove('active');
        if (modeBrTab) modeBrTab.classList.remove('active');
      }
    });
  }

  if (modeHardcoreTab) {
    modeHardcoreTab.addEventListener('click', () => {
      if (isMultiplayer) handleRoomClose();
      if (isPartyMode) leaveParty();
      if (!gameState.isHardcore) {
        resetGame(true, true);
      }
    });
  }

  if (hardcoreRerollBtn) {
    hardcoreRerollBtn.addEventListener('click', () => {
      if (gameState.isHardcore) {
        resetGame(true, true);
      }
    });
  }

  // Battle Royale Events
  const avatarPicker = document.querySelector('#br-avatar-picker');
  if (avatarPicker) {
    avatarPicker.addEventListener('click', (e) => {
      const btn = e.target.closest('.br-avatar-btn');
      if (!btn) return;
      avatarPicker.querySelectorAll('.br-avatar-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  }

  const modeSelect = document.querySelector('#br-mode-select');
  const bombDifficultyWrapper = document.querySelector('#br-bomb-difficulty-wrapper');
  if (modeSelect && bombDifficultyWrapper) {
    modeSelect.addEventListener('change', () => {
      if (modeSelect.value === 'bomb') {
        bombDifficultyWrapper.classList.remove('hidden');
      } else {
        bombDifficultyWrapper.classList.add('hidden');
      }
    });
  }

  document.querySelector('#br-create-btn')?.addEventListener('click', () => {
    const pseudoInput = document.querySelector('#br-pseudo-input');
    const pseudo = (pseudoInput?.value || 'Voyageur').trim() || 'Voyageur';
    const activeAvatarBtn = document.querySelector('#br-avatar-picker .br-avatar-btn.active');
    const avatar = activeAvatarBtn?.dataset.avatar || '👑';
    const mode = modeSelect ? modeSelect.value : 'bomb';
    const bombDifficultySelect = document.querySelector('#br-bomb-difficulty-select');
    const bombDifficulty = bombDifficultySelect ? bombDifficultySelect.value : '1';
    const livesSelect = document.querySelector('#br-lives-select');
    const lives = livesSelect ? parseInt(livesSelect.value, 10) : 2;
    const timerSelect = document.querySelector('#br-timer-select');
    const timer = timerSelect ? parseInt(timerSelect.value, 10) : 15;

    initPartyHost(null, pseudo, avatar, mode, timer, bombDifficulty, lives);
  });

  const handleBrJoin = () => {
    const codeInput = document.querySelector('#br-join-code-input');
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';
    if (!code) {
      const fb = document.querySelector('#br-setup-feedback');
      if (fb) {
        fb.textContent = getLanguage() === 'en' ? 'Please enter a room code.' : 'Veuillez entrer un code de salon.';
        fb.className = 'br-feedback-banner wrong';
        fb.classList.remove('hidden');
      }
      return;
    }
    const pseudoInput = document.querySelector('#br-pseudo-input');
    const pseudo = (pseudoInput?.value || 'Voyageur').trim() || 'Voyageur';
    const activeAvatarBtn = document.querySelector('#br-avatar-picker .br-avatar-btn.active');
    const avatar = activeAvatarBtn?.dataset.avatar || '🌍';

    joinPartyGuest(code, pseudo, avatar);
  };

  document.querySelector('#br-join-btn')?.addEventListener('click', handleBrJoin);
  document.querySelector('#br-join-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBrJoin();
    }
  });

  document.querySelector('#br-copy-link-btn')?.addEventListener('click', () => {
    const linkInput = document.querySelector('#br-invite-link-input');
    const url = linkInput ? linkInput.value : window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.querySelector('#br-copy-link-btn');
      const oldText = btn.textContent;
      btn.textContent = t('mp.copied');
      setTimeout(() => { btn.textContent = oldText; }, 2000);
    }).catch(() => {
      if (linkInput) {
        linkInput.select();
        document.execCommand('copy');
      }
    });
  });

  document.querySelector('#br-start-game-btn')?.addEventListener('click', () => {
    hostStartGame();
  });

  const handleLeaveBr = () => {
    leaveParty();
    if (gameState.isHardcore) {
      modeHardcoreTab?.classList.add('active');
    } else {
      modeSoloTab?.classList.add('active');
    }
    modeBrTab?.classList.remove('active');
  };

  document.querySelector('#br-leave-lobby-btn')?.addEventListener('click', handleLeaveBr);
  document.querySelector('#br-leave-arena-btn')?.addEventListener('click', handleLeaveBr);
  document.querySelector('#close-br-dialog')?.addEventListener('click', handleLeaveBr);

  document.querySelector('#br-replay-btn')?.addEventListener('click', () => {
    if (isBrHost) {
      hostRestartGame();
    } else {
      requestReplayGuest();
    }
  });

  document.querySelector('#br-lobby-return-btn')?.addEventListener('click', () => {
    if (isBrHost) {
      hostReturnToLobby();
    } else {
      handleLeaveBr();
    }
  });

  // Battle Royale Country Input & Autocomplete
  const brSearchInput = document.querySelector('#br-country-search');
  const brSubmitBtn = document.querySelector('#br-country-submit');
  const brAutocompleteList = document.querySelector('#br-autocomplete-list');

  const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const getBrMatches = (rawQuery) => {
    const query = fold(rawQuery.trim());
    if (!query) return [];
    const isEn = getLanguage() === 'en';

    const matches = countriesSearchIndex.map((idx) => {
      const country = getCountryByCode(idx.code);
      let matchScore = -1;
      if (isEn) {
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
      return { country, matchScore };
    }).filter(item => item.matchScore > 0);

    matches.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      const nameA = isEn ? (a.country.nameEnglish || a.country.name) : a.country.name;
      const nameB = isEn ? (b.country.nameEnglish || b.country.name) : b.country.name;
      return nameA.localeCompare(nameB, isEn ? 'en' : 'fr');
    });

    return matches.slice(0, 8);
  };

  const renderBrAutocomplete = () => {
    if (!brSearchInput || !brAutocompleteList) return;
    const matches = getBrMatches(brSearchInput.value);
    if (matches.length === 0) {
      brAutocompleteList.innerHTML = '';
      brAutocompleteList.classList.add('hidden');
      return;
    }

    brAutocompleteList.innerHTML = matches.map(({ country }) => {
      const name = getCountryName(country);
      const iso2 = country.iso2 ? country.iso2.toLowerCase() : '';
      const flagImg = iso2 ? `<img src="https://flagcdn.com/w40/${iso2}.png" alt="" class="br-chip-flag" />` : '';
      return `
        <button type="button" class="br-autocomplete-item" data-code="${country.code}">
          ${flagImg}
          <span>${name}</span>
        </button>
      `;
    }).join('');
    brAutocompleteList.classList.remove('hidden');
  };

  const submitBrChosenCountry = () => {
    if (!brSearchInput) return;
    const val = brSearchInput.value.trim();
    if (!val) return;
    const matches = getBrMatches(val);
    if (matches.length > 0) {
      submitCountryMove(matches[0].country.code);
      brSearchInput.value = '';
      if (brAutocompleteList) brAutocompleteList.classList.add('hidden');
    }
  };

  if (brSearchInput) {
    brSearchInput.addEventListener('input', renderBrAutocomplete);
    brSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitBrChosenCountry();
      }
    });
  }

  if (brAutocompleteList) {
    brAutocompleteList.addEventListener('click', (e) => {
      const item = e.target.closest('.br-autocomplete-item');
      if (!item) return;
      const code = item.dataset.code;
      if (code) {
        submitCountryMove(code);
        if (brSearchInput) brSearchInput.value = '';
        brAutocompleteList.classList.add('hidden');
      }
    });
  }

  if (brSubmitBtn) {
    brSubmitBtn.addEventListener('click', submitBrChosenCountry);
  }

  // Sélecteur de langue (FR / EN)
  const langToggleBtn = document.querySelector('#lang-toggle-btn');
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      const nextLang = getLanguage() === 'fr' ? 'en' : 'fr';
      setLanguage(nextLang);
    });
  }

  document.querySelector('#close-room')?.addEventListener('click', handleRoomClose);
  document.querySelector('#create-room-btn')?.addEventListener('click', () => {
    const isHardcore = !!document.querySelector('#mp-hardcore-checkbox')?.checked;
    initPeer(null, true, isHardcore);
  });
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
      updateSearchDialogHardcoreReminder();
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
    updateSearchDialogHardcoreReminder();
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

  // Seed Dialog Handlers
  const seedDialogBtn = document.querySelector('#seed-dialog-btn');
  const seedDialog = document.querySelector('#seed-dialog');
  const closeSeedDialog = document.querySelector('#close-seed-dialog');
  const seedCurrentInput = document.querySelector('#seed-current-input');
  const seedImportInput = document.querySelector('#seed-import-input');
  const copySeedCodeBtn = document.querySelector('#copy-seed-code-btn');
  const copySeedLinkBtn = document.querySelector('#copy-seed-link-btn');
  const loadSeedBtn = document.querySelector('#load-seed-btn');
  const seedFeedback = document.querySelector('#seed-feedback');

  if (seedDialogBtn && seedDialog) {
    seedDialogBtn.addEventListener('click', () => {
      const currentSeed = exportGridSeed();
      if (seedCurrentInput) seedCurrentInput.value = currentSeed || '';
      if (seedImportInput) seedImportInput.value = '';
      if (seedFeedback) {
        seedFeedback.textContent = '';
        seedFeedback.className = 'seed-feedback hidden';
      }
      safeShowModal(seedDialog);
    });
  }

  closeSeedDialog?.addEventListener('click', () => seedDialog?.close());

  copySeedCodeBtn?.addEventListener('click', () => {
    const seed = seedCurrentInput ? seedCurrentInput.value : exportGridSeed();
    if (seed) {
      navigator.clipboard.writeText(seed).then(() => {
        const oldText = copySeedCodeBtn.textContent;
        copySeedCodeBtn.textContent = t('dialog.seed_copied');
        setTimeout(() => { copySeedCodeBtn.textContent = oldText; }, 2000);
      });
    }
  });

  copySeedLinkBtn?.addEventListener('click', () => {
    const seed = seedCurrentInput ? seedCurrentInput.value : exportGridSeed();
    if (seed) {
      const directUrl = `${window.location.origin}${window.location.pathname}?seed=${encodeURIComponent(seed)}`;
      navigator.clipboard.writeText(directUrl).then(() => {
        const oldText = copySeedLinkBtn.textContent;
        copySeedLinkBtn.textContent = t('dialog.seed_link_copied');
        setTimeout(() => { copySeedLinkBtn.textContent = oldText; }, 2000);
      });
    }
  });

  loadSeedBtn?.addEventListener('click', () => {
    const inputCode = seedImportInput ? seedImportInput.value.trim() : '';
    if (!inputCode) return;

    if (isMultiplayer) {
      if (seedFeedback) {
        seedFeedback.textContent = getLanguage() === 'en' 
          ? '⚠️ Seed loading is disabled during 1v1 multiplayer.' 
          : '⚠️ Le chargement de graine est désactivé en mode 1v1.';
        seedFeedback.className = 'seed-feedback error';
        seedFeedback.classList.remove('hidden');
      }
      return;
    }

    const ok = applyGridSeed(inputCode);
    if (ok) {
      search.value = '';
      search.style.display = '';
      document.querySelector('#progress').textContent = '0';
      updateLivesUI();
      updateHardcoreUI();
      renderBoard(true);
      setFeedback(t('dialog.seed_loaded'), 'correct');

      const newUrl = `${window.location.origin}${window.location.pathname}?seed=${encodeURIComponent(inputCode)}`;
      window.history.pushState({}, '', newUrl);

      if (seedFeedback) {
        seedFeedback.textContent = t('dialog.seed_loaded');
        seedFeedback.className = 'seed-feedback success';
        seedFeedback.classList.remove('hidden');
      }
      setTimeout(() => {
        seedDialog?.close();
      }, 700);
    } else {
      if (seedFeedback) {
        seedFeedback.textContent = t('dialog.seed_invalid');
        seedFeedback.className = 'seed-feedback error';
        seedFeedback.classList.remove('hidden');
      }
    }
  });
}

initApp();
