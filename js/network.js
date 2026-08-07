import { gameState, generateGrid, checkTicTacToeWin, validateMove, resetGameState } from './game.js';
import { countries } from './data.js';
import { addGameFeed, updateScoresUI, updateMultiplayerUI, board, searchDialog, mpVictoryDialog, mpVictoryTitle, mpVictoryDesc, gridProposalDialog, gridProposalDesc, feedback, renderBoard, mpStatusMsg } from './ui.js';

export let isMultiplayer = false;
export let myRole = null;
export let startingPlayer = 'host';
export let currentTurn = 'host';
export let roomScores = { host: 0, guest: 0 };
export let turnTimerInterval = null;
export let turnTimeLeft = 30;

let peer = null;
let conn = null;
let currentRoomCode = null;
let roomChannel = null;

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
  // Simplified STUN only for robust modularization if TURN fails quickly
  return {
    debug: 2,
    config: {
      iceServers: STUN_SERVERS,
      iceCandidatePoolSize: 10,
    }
  };
}

export async function initPeer(customCode = null, isCreating = false) {
  const code = customCode || Math.random().toString(36).substring(2, 7).toUpperCase();
  currentRoomCode = code;
  const peerId = `cdoku-1v1-${code}`;

  updateStatus("⚙️ Connexion au serveur de signalisation...", "connecting");

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
      
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.pushState({}, '', newUrl);

      document.querySelector('#created-code-val').textContent = code;
      document.querySelector('#invite-link-input').value = newUrl;
      document.querySelector('#room-options-view').classList.add('hidden');
      document.querySelector('#room-created-view').classList.remove('hidden');
      updateStatus(`🟢 Salon prêt ! Code : ${code}. En attente de l'adversaire...`, "info");
    }
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnectionListeners();
    updateStatus("🤝 Joueur 2 détecté ! Connexion en cours...", "connecting");
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

  updateStatus(`⚙️ Connexion au serveur de signalisation...`, "connecting");
  
  const peerConfig = await buildPeerConfig();
  if (peer) { try { peer.destroy(); } catch (e) {} }
  peer = new Peer(peerConfig);

  peer.on('open', (id) => {
    updateStatus(`🤝 Recherche du salon ${code}...`, "connecting");
    conn = peer.connect(`cdoku-1v1-${code}`, { reliable: true });
    setupConnectionListeners();
  });

  peer.on('error', (err) => {
    isMultiplayer = false;
    myRole = null;
    updateStatus(`⚠️ Erreur de connexion : ${err.type}`, "error");
  });
}

function setupConnectionListeners() {
  if (!conn) return;

  const onConnected = () => {
    updateStatus("🟢 Connecté au salon !", "success");
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
    updateMultiplayerUI();
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

export function startTurnTimer() {
  stopTurnTimer();
  turnTimeLeft = 30;
  import('./ui.js').then(ui => ui.updateTimerUI());

  if (!isMultiplayer) return;

  turnTimerInterval = setInterval(() => {
    turnTimeLeft -= 1;
    import('./ui.js').then(ui => ui.updateTimerUI());

    if (turnTimeLeft <= 0) {
      stopTurnTimer();
      if (currentTurn === myRole) {
        if (searchDialog && searchDialog.open) searchDialog.close();
        gameState.selectedCell = null;
        currentTurn = currentTurn === 'host' ? 'guest' : 'host';
        safeSend({ type: 'TIMEOUT_PASS' });
        const senderName = myRole === 'host' ? '🟢 Joueur 1 (Hôte)' : '🔵 Joueur 2 (Invité)';
        const msg = `⏱️ Temps écoulé (30s) pour ${senderName} ! Le tour passe à l'adversaire.`;
        feedback.textContent = msg;
        addGameFeed(msg, 'wrong');
        updateMultiplayerUI();
        renderBoard();
      }
    }
  }, 1000);
}

export function stopTurnTimer() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }
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

  const starterName = startingPlayer === 'host' ? '🟢 Joueur 1 (Hôte)' : '🔵 Joueur 2 (Invité)';
  addGameFeed(`🎲 Nouveau match lancé ! C'est ${starterName} qui commence.`, 'info');

  renderBoard();
  updateMultiplayerUI();
}

export function handleIncomingData(data) {
  console.log("[WebRTC] Données reçues:", data);

  if (data.type === 'GUEST_JOINED' && myRole === 'host') {
    if (!gameState.currentGridIndices) {
      generateGrid();
    }
    safeSend({ type: 'INIT_GAME', rowIndices: gameState.currentGridIndices.rowIndices, colIndices: gameState.currentGridIndices.colIndices, startingPlayer });
  }

  if (data.type === 'GUEST_READY') {
    updateMultiplayerUI();
    addGameFeed(`🎮 Joueur 2 connecté ! Le match commence.`);
  }

  if (data.type === 'INIT_GAME') {
    generateGrid(data.rowIndices, data.colIndices);
    gameState.answers = Array(9).fill(null);
    gameState.selectedCell = null;
    startingPlayer = data.startingPlayer || 'host';
    currentTurn = startingPlayer;
    updateMultiplayerUI();
    renderBoard();
    safeSend({ type: 'GUEST_READY' });
  }

  // VALIDATION STRICTE
  if (data.type === 'MAKE_MOVE') {
    // Audit Security Fix: Verify move validity on client side
    const targetCellId = data.cellId;
    const isTurnValid = currentTurn === data.player; // It must be their turn
    const isCellValid = targetCellId >= 0 && targetCellId < 9 && !gameState.answers[targetCellId];
    
    if (isTurnValid && isCellValid && validateMove(targetCellId, data.countryCode)) {
      const country = countries.find(c => c.code === data.countryCode);
      gameState.answers[targetCellId] = { country, player: data.player };
      
      const winLine = checkTicTacToeWin(data.player);
      if (winLine) {
        stopTurnTimer();
        roomScores[data.player] += 1;
        updateScoresUI();
        mpVictoryTitle.textContent = `Défaite !`;
        mpVictoryDesc.textContent = `L'adversaire a aligné 3 cases et remporte ce match !`;
        addGameFeed(`🎉 L'adversaire a remporté le match de Tic-Tac-Toe !`, 'correct');
        mpVictoryDialog.showModal();
      } else if (gameState.answers.filter(Boolean).length === 9) {
        stopTurnTimer();
        mpVictoryDialog.showModal();
      } else {
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
    currentTurn = data.nextTurn || (data.player === 'host' ? 'guest' : 'host');
    if (searchDialog && searchDialog.open) searchDialog.close();
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
}

export function handleRoomClose() {
  if (isMultiplayer) {
    const confirmLeaveDialog = document.querySelector('#confirm-leave-dialog');
    if (confirmLeaveDialog) confirmLeaveDialog.showModal();
    return false;
  }
  const roomDialog = document.querySelector('#room-dialog');
  if (roomDialog && roomDialog.open) roomDialog.close();
  return true;
}
