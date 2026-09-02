import { gameState, generateGrid, checkTicTacToeWin, validateMove, resetGameState } from './game.js';
import { countries } from './data.js';
import { escapeHtml } from './utils.js';
import { addGameFeed, updateScoresUI, updateMultiplayerUI, board, searchDialog, mpVictoryDialog, mpVictoryTitle, mpVictoryDesc, gridProposalDialog, gridProposalDesc, feedback, renderBoard, mpStatusMsg, safeShowModal } from './ui.js';
import { recordChoice, getChoicePercentage } from './stats.js';
import { t, getLanguage, getCountryName } from './i18n.js';

export let isMultiplayer = false;
export let myRole = null;
export let startingPlayer = 'host';
export let currentTurn = 'host';
export let roomScores = { host: 0, guest: 0 };
export let turnTimerInterval = null;
export let turnTimeLeft = 30;

let peer = null;
let conn = null;
export let currentRoomCode = null;
let roomChannel = null;

// F-02 FIX: Timestamp absolu pour le timer (immunisé au throttling d'onglet inactif)
let turnEndTime = null;

const METERED_API_URL = 'https://countrydoku.metered.live/api/v1/turn/credentials';
const METERED_API_KEY = 'aa340d9ab8937dc2645bfb6845b86c60c969';
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' },
];

export function resetRoomScores() {
  roomScores = { host: 0, guest: 0 };
  startingPlayer = 'host';
  currentTurn = 'host';
  updateScoresUI();
}

function updateStatus(msg, state = 'info') {
  if (mpStatusMsg) mpStatusMsg.textContent = msg;
  const mpStatusDot = document.querySelector('#mp-status-dot');
  if (mpStatusDot) {
    switch (state) {
      case 'connecting': mpStatusDot.textContent = '🔄'; break;
      case 'success': mpStatusDot.textContent = '🟢'; break;
      case 'error': mpStatusDot.textContent = '❌'; break;
      default: mpStatusDot.textContent = '🟡'; break;
    }
  }
}

async function buildPeerConfig() {
  // F-03: Tentative d'utilisation des serveurs TURN via Metered API
  let iceServers = [...STUN_SERVERS];
  try {
    const resp = await fetch(`${METERED_API_URL}?apiKey=${METERED_API_KEY}`);
    if (resp.ok) {
      const turnServers = await resp.json();
      if (Array.isArray(turnServers) && turnServers.length > 0) {
        iceServers = [...STUN_SERVERS, ...turnServers];
        console.log('[WebRTC] Serveurs TURN Metered chargés avec succès');
      }
    }
  } catch (e) {
    console.warn('[WebRTC] Impossible de charger les serveurs TURN, fallback STUN uniquement', e);
  }
  return {
    debug: 2,
    config: {
      iceServers,
      iceCandidatePoolSize: 10,
    }
  };
}

export async function initPeer(customCode = null, isCreating = false) {
  const code = customCode || Math.random().toString(36).substring(2, 7).toUpperCase();
  currentRoomCode = code;
  const peerId = `cdoku-1v1-${code}`;

  updateStatus(t('mp.connecting'), "connecting");

  if (peer) {
    try { peer.destroy(); } catch (e) {}
  }

  const peerConfig = await buildPeerConfig();
  peer = new Peer(peerId, peerConfig);

  peer.on('open', (id) => {
    if (isCreating) {
      myRole = 'host';
      currentTurn = 'host';
      isMultiplayer = true;
      resetRoomScores();
      generateGrid();
      gameState.answers = Array(9).fill(null);
      
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.pushState({}, '', newUrl);

      document.querySelector('#created-code-val').textContent = code;
      document.querySelector('#invite-link-input').value = newUrl;
      document.querySelector('#room-options-view').classList.add('hidden');
      document.querySelector('#room-created-view').classList.remove('hidden');
      updateStatus(t('mp.ready_wait', { code }), "info");
    }
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnectionListeners();
    updateStatus(t('mp.player2_detected'), "connecting");
  });

  peer.on('error', (err) => {
    if (err.type === 'unavailable-id' && isCreating) {
      initPeer(null, true);
    } else if (err.type === 'unavailable-id') {
      connectAsGuest(code);
    } else {
      updateStatus(`⚠️ Erreur : ${err.type}`, "error");
    }
  });
}

export async function connectAsGuest(code) {
  currentRoomCode = code;
  myRole = 'guest';
  currentTurn = 'host';
  isMultiplayer = true;
  resetRoomScores();

  updateStatus(t('mp.connecting'), "connecting");
  
  const peerConfig = await buildPeerConfig();
  if (peer) { try { peer.destroy(); } catch (e) {} }
  peer = new Peer(peerConfig);

  peer.on('open', (id) => {
    updateStatus(t('mp.finding_room', { code }), "connecting");
    conn = peer.connect(`cdoku-1v1-${code}`, { reliable: true });
    setupConnectionListeners();
  });

  peer.on('error', (err) => {
    isMultiplayer = false;
    myRole = null;
    updateStatus(`⚠️ Erreur : ${err.type}`, "error");
  });
}

function setupConnectionListeners() {
  if (!conn) return;

  const onConnected = () => {
    updateStatus(t('mp.connected'), "success");
    const roomDialog = document.querySelector('#room-dialog');
    if (roomDialog && roomDialog.open) roomDialog.close();

    if (myRole === 'guest') {
      safeSend({ type: 'GUEST_JOINED' });
    }
  };

  if (conn.open) {
    onConnected();
  } else {
    conn.on('open', onConnected);
  }

  conn.on('data', (data) => {
    handleIncomingData(data);
  });

  conn.on('close', () => {
    isMultiplayer = false;
    stopTurnTimer();
    addGameFeed(t('mp.disconnected'), "wrong");
    feedback.textContent = t('mp.conn_lost');
    updateMultiplayerUI();
    renderBoard();
  });
}

export function safeSend(data) {
  if (conn && conn.open) {
    console.log("[WebRTC] Envoi des données:", data);
    conn.send(data);
    return true;
  }
  return false;
}

export function setCurrentTurn(newTurn) {
  currentTurn = newTurn;
}

// F-02 FIX: Timer basé sur Date.now()
export function startTurnTimer() {
  stopTurnTimer();
  turnTimeLeft = 30;
  turnEndTime = Date.now() + 30000;
  import('./ui.js').then(ui => ui.updateTimerUI());

  if (!isMultiplayer) return;

  turnTimerInterval = setInterval(() => {
    turnTimeLeft = Math.max(0, Math.round((turnEndTime - Date.now()) / 1000));
    import('./ui.js').then(ui => ui.updateTimerUI());

    if (turnTimeLeft <= 0) {
      stopTurnTimer();
      if (currentTurn === myRole) {
        if (searchDialog && searchDialog.open) searchDialog.close();
        gameState.selectedCell = null;
        currentTurn = currentTurn === 'host' ? 'guest' : 'host';
        safeSend({ type: 'TIMEOUT_PASS' });
        const senderName = myRole === 'host' 
          ? (getLanguage() === 'en' ? '🟢 Player 1 (Host)' : '🟢 Joueur 1 (Hôte)') 
          : (getLanguage() === 'en' ? '🔵 Player 2 (Guest)' : '🔵 Joueur 2 (Invité)');
        const msg = t('board.timeout_msg', { player: senderName });
        feedback.textContent = msg;
        addGameFeed(msg, 'wrong');
        updateMultiplayerUI();
        renderBoard();
        startTurnTimer();
      }
    }
  }, 250);
}

export function stopTurnTimer() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
  turnEndTime = null;
}

export function startNextMultiplayerMatch(sameGrid = false) {
  if (myRole !== 'host') return;

  gameState.answers = Array(9).fill(null);
  gameState.selectedCell = null;

  startingPlayer = startingPlayer === 'host' ? 'guest' : 'host';
  currentTurn = startingPlayer;

  if (!sameGrid) {
    generateGrid();
  }

  safeSend({
    type: 'INIT_GAME',
    rowIndices: gameState.currentGridIndices.rowIndices,
    colIndices: gameState.currentGridIndices.colIndices,
    startingPlayer
  });

  const starterName = startingPlayer === 'host' 
    ? (getLanguage() === 'en' ? '🟢 Player 1 (Host)' : '🟢 Joueur 1 (Hôte)') 
    : (getLanguage() === 'en' ? '🔵 Player 2 (Guest)' : '🔵 Joueur 2 (Invité)');
  const newMatchMsg = getLanguage() === 'en' 
    ? `🎲 New match started! ${starterName} begins.` 
    : `🎲 Nouveau match lancé ! C'est ${starterName} qui commence.`;
  addGameFeed(newMatchMsg, 'info');

  renderBoard();
  updateMultiplayerUI();
  startTurnTimer();
}

export function handleIncomingData(data) {
  console.log("[WebRTC] Données reçues:", data);

  if (data.type === 'GUEST_JOINED' && myRole === 'host') {
    generateGrid();
    gameState.answers = Array(9).fill(null);
    safeSend({ type: 'INIT_GAME', rowIndices: gameState.currentGridIndices.rowIndices, colIndices: gameState.currentGridIndices.colIndices, startingPlayer });
    renderBoard();
  }

  if (data.type === 'GUEST_READY') {
    updateMultiplayerUI();
    addGameFeed(t('mp.guest_connected'));
    startTurnTimer();
    renderBoard();
  }

  if (data.type === 'INIT_GAME') {
    generateGrid(data.rowIndices, data.colIndices);
    gameState.answers = Array(9).fill(null);
    gameState.selectedCell = null;
    startingPlayer = data.startingPlayer || 'host';
    currentTurn = startingPlayer;
    updateMultiplayerUI();
    renderBoard();
    startTurnTimer();
    safeSend({ type: 'GUEST_READY' });
  }

  // VALIDATION STRICTE
  if (data.type === 'MAKE_MOVE') {
    const targetCellId = data.cellId;
    const isTurnValid = currentTurn === data.player;
    const isCellValid = targetCellId >= 0 && targetCellId < 9 && !gameState.answers[targetCellId];
    
    if (isTurnValid && isCellValid && validateMove(targetCellId, data.countryCode)) {
      const country = countries.find(c => c.code === data.countryCode);
      gameState.answers[targetCellId] = { country, player: data.player };
      
      const row = Math.floor(targetCellId / 3);
      const col = targetCellId % 3;
      const rowCriterion = gameState.rows[row];
      const colCriterion = gameState.columns[col];
      const rowLabel = rowCriterion?.labelFr || rowCriterion?.label;
      const colLabel = colCriterion?.labelFr || colCriterion?.label;
      recordChoice(rowLabel, colLabel, data.countryCode);
      const pct = getChoicePercentage(rowLabel, colLabel, data.countryCode);
      const pctText = (pct !== null && pct !== undefined) 
        ? (getLanguage() === 'en' ? ` (${pct}% of players)` : ` (${pct}% des joueurs)`) 
        : '';

      const countryName = country ? getCountryName(country) : data.countryCode;
      const safeName = escapeHtml(countryName);

      const winLine = checkTicTacToeWin(data.player);
      if (winLine) {
        stopTurnTimer();
        roomScores[data.player] += 1;
        updateScoresUI();
        mpVictoryTitle.textContent = t('dialog.defeat_title');
        mpVictoryDesc.textContent = t('dialog.defeat_desc');
        const feedMsg = getLanguage() === 'en' 
          ? `🎉 Opponent placed ${safeName}${pctText} and won the match!` 
          : `🎉 L'adversaire a placé ${safeName}${pctText} et remporte le match !`;
        addGameFeed(feedMsg, 'correct');
        safeShowModal(mpVictoryDialog);
      } else if (gameState.answers.filter(Boolean).length === 9) {
        stopTurnTimer();
        mpVictoryTitle.textContent = t('dialog.draw_title');
        mpVictoryDesc.textContent = t('dialog.draw_desc');
        safeShowModal(mpVictoryDialog);
      } else {
        const feedMsg = getLanguage() === 'en'
          ? `🔵 Opponent placed ${safeName}${pctText} (Cell ${targetCellId + 1}).`
          : `🔵 L'adversaire a placé ${safeName}${pctText} (Case ${targetCellId + 1}).`;
        addGameFeed(feedMsg, 'info');
        currentTurn = data.nextTurn || (data.player === 'host' ? 'guest' : 'host');
        updateMultiplayerUI();
        startTurnTimer();
      }
      renderBoard();
    } else {
      console.warn("⚠️ Mouvement invalide reçu de l'adversaire (tricherie potentielle ou désync).", data);
    }
  }

  if (data.type === 'WRONG_MOVE') {
    if (typeof data.cellId !== 'number' || data.cellId < 0 || data.cellId > 8) return;
    currentTurn = data.nextTurn || (data.player === 'host' ? 'guest' : 'host');
    if (searchDialog && searchDialog.open) searchDialog.close();
    const safeCountryName = escapeHtml(data.countryName || (getLanguage() === 'en' ? 'a country' : 'un pays'));
    const safeReason = escapeHtml(data.reason || (getLanguage() === 'en' ? 'Criterion not met' : 'Critère non respecté'));
    const feedMsg = getLanguage() === 'en'
      ? `❌ Opponent proposed "${safeCountryName}" for Cell ${(data.cellId || 0) + 1} (Rejected: ${safeReason}).`
      : `❌ L'adversaire a proposé "${safeCountryName}" pour la Case ${(data.cellId || 0) + 1} (Refusé : ${safeReason}).`;
    addGameFeed(feedMsg, 'wrong');
    updateMultiplayerUI();
    renderBoard();
    startTurnTimer();
  }

  if (data.type === 'TIMEOUT_PASS') {
    currentTurn = currentTurn === 'host' ? 'guest' : 'host';
    if (searchDialog && searchDialog.open) searchDialog.close();
    updateMultiplayerUI();
    renderBoard();
    startTurnTimer();
  }

  if (data.type === 'PROPOSE_REMATCH' || data.type === 'PROPOSE_NEW_GRID') {
    const isRematch = data.type === 'PROPOSE_REMATCH';
    if (gridProposalDesc) {
      gridProposalDesc.textContent = isRematch ? t('dialog.proposal_desc_rematch') : t('dialog.proposal_desc_new');
    }
    safeShowModal(gridProposalDialog);
  }

  if (data.type === 'ACCEPT_PROPOSAL') {
    const acceptedMsg = getLanguage() === 'en' 
      ? "✅ Opponent accepted the proposal!" 
      : "✅ L'adversaire a accepté la proposition !";
    addGameFeed(acceptedMsg, "correct");
    if (gridProposalDialog && gridProposalDialog.open) gridProposalDialog.close();
    if (mpVictoryDialog && mpVictoryDialog.open) mpVictoryDialog.close();
    if (myRole === 'host') {
      startNextMultiplayerMatch(data.sameGrid || false);
    }
  }

  if (data.type === 'DECLINE_PROPOSAL') {
    const declinedMsg = getLanguage() === 'en' 
      ? "❌ Opponent declined the proposal." 
      : "❌ L'adversaire a refusé la proposition.";
    addGameFeed(declinedMsg, "wrong");
    if (gridProposalDialog && gridProposalDialog.open) gridProposalDialog.close();
  }
}

export function forceLeaveRoom() {
  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }
  conn = null;
  isMultiplayer = false;
  myRole = null;
  currentRoomCode = null;
  window.history.pushState({}, '', window.location.pathname);
  
  const confirmLeaveDialog = document.querySelector('#confirm-leave-dialog');
  if (confirmLeaveDialog && confirmLeaveDialog.open) confirmLeaveDialog.close();
  
  const roomDialog = document.querySelector('#room-dialog');
  if (roomDialog && roomDialog.open) roomDialog.close();
  
  const roomOptionsView = document.querySelector('#room-options-view');
  if (roomOptionsView) roomOptionsView.classList.remove('hidden');
  
  const roomCreatedView = document.querySelector('#room-created-view');
  if (roomCreatedView) roomCreatedView.classList.add('hidden');
  
  resetGameState(true);
  updateMultiplayerUI();
  renderBoard(true);
}

export function handleRoomClose() {
  if (isMultiplayer) {
    const confirmLeaveDialog = document.querySelector('#confirm-leave-dialog');
    safeShowModal(confirmLeaveDialog);
    return false;
  }
  const roomDialog = document.querySelector('#room-dialog');
  if (roomDialog && roomDialog.open) roomDialog.close();
  return true;
}
