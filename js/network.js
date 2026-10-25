import { gameState, generateGrid, checkTicTacToeWin, validateMove, resetGameState } from './game.js';
import { countries, allCriteria } from './data.js';
import { escapeHtml } from './utils.js';
import { addGameFeed, updateScoresUI, updateMultiplayerUI, updateHardcoreUI, updateTimerUI, board, searchDialog, mpVictoryDialog, mpVictoryTitle, mpVictoryDesc, gridProposalDialog, gridProposalDesc, feedback, renderBoard, mpStatusMsg, safeShowModal, safeClose, setFeedback, showHardcore1v1Intro } from './ui.js';
import { recordChoice, getChoicePercentage } from './stats.js';
import { t, getLanguage, getCountryName } from './i18n.js';
import { getRandomHardcoreModifier, getRandomHardcoreModifierFor1v1, getHardcoreModifierById } from './hardcore.js';

export let isMultiplayer = false;
export let isHardcoreRoom = false;
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
// NOTE SÉCU : clé publique Metered exposée côté client (risque de pillage de quota).
// TODO : la déplacer derrière un proxy serveur ou générer des credentials scoped courte durée.
// En attendant, les credentials TURN sont mis en cache 24h pour limiter les appels.
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

export async function buildPeerConfig() {
  // F-03: Tentative d'utilisation des serveurs TURN via Metered API (cache 24h)
  let iceServers = [...STUN_SERVERS];
  try {
    const cached = sessionStorage.getItem('cdoku_turn_cache');
    if (cached) {
      const { expires, servers } = JSON.parse(cached);
      if (expires > Date.now() && Array.isArray(servers) && servers.length > 0) {
        return { debug: 2, config: { iceServers: [...STUN_SERVERS, ...servers], iceCandidatePoolSize: 10 } };
      }
    }
    const resp = await fetch(`${METERED_API_URL}?apiKey=${METERED_API_KEY}`);
    if (resp.ok) {
      const turnServers = await resp.json();
      if (Array.isArray(turnServers) && turnServers.length > 0) {
        iceServers = [...STUN_SERVERS, ...turnServers];
        try {
          sessionStorage.setItem('cdoku_turn_cache', JSON.stringify({ expires: Date.now() + 24 * 3600 * 1000, servers: turnServers }));
        } catch (e) {}
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

export async function initPeer(customCode = null, isCreating = false, isHardcore = false) {
  const code = customCode || Math.random().toString(36).substring(2, 7).toUpperCase();
  currentRoomCode = code;
  closeExpected = false;
  clearRejoinTimers();
  isHardcoreRoom = isHardcore;
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

      if (isHardcoreRoom) {
        gameState.isHardcore = true;
        gameState.hardcoreModifier = getRandomHardcoreModifierFor1v1();
      } else {
        gameState.isHardcore = false;
        gameState.hardcoreModifier = null;
      }

      generateGrid();
      gameState.answers = Array(9).fill(null);
      
      const newUrl = `${window.location.origin}${window.location.pathname}?room=${code}`;
      window.history.pushState({}, '', newUrl);

      document.querySelector('#created-code-val').textContent = code;
      document.querySelector('#invite-link-input').value = newUrl;
      const hcTag = document.querySelector('#room-created-hardcore-tag');
      if (hcTag) hcTag.classList.toggle('hidden', !isHardcoreRoom);
      document.querySelector('#room-options-view').classList.add('hidden');
      document.querySelector('#room-created-view').classList.remove('hidden');
      updateStatus(t('mp.ready_wait', { code }), "info");
      updateHardcoreUI();
    }
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnectionListeners();
    updateStatus(t('mp.player2_detected'), "connecting");
  });

  peer.on('error', (err) => {
    if (err.type === 'unavailable-id' && isCreating) {
      initPeer(null, true, isHardcore);
    } else if (err.type === 'unavailable-id') {
      connectAsGuest(code);
    } else {
      updateStatus(`⚠️ Erreur : ${err.type}`, "error");
    }
  });

  // Déconnexion transitoire du serveur de signaling (ID conservé) → reconnexion auto
  peer.on('disconnected', () => {
    updateStatus(t('mp.reconnecting'), 'connecting');
    try { peer.reconnect(); } catch (e) {
      updateStatus(`⚠️ Erreur : reconnect`, 'error');
    }
  });
  peer.on('close', () => {
    updateStatus(t('mp.conn_lost'), 'error');
  });
}

export async function connectAsGuest(code) {
  currentRoomCode = code;
  closeExpected = false;
  clearRejoinTimers();
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

  peer.on('disconnected', () => {
    updateStatus(t('mp.reconnecting'), 'connecting');
    try { peer.reconnect(); } catch (e) {}
  });
}

function setupConnectionListeners() {
  if (!conn) return;

  const onConnected = () => {
    updateStatus(t('mp.connected'), "success");
    clearRejoinTimers();
    safeClose(document.querySelector('#room-dialog'));

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
    if (closeExpected) {
      fullMultiplayerCleanup();
      return;
    }
    // Fermeture inattendue : tentative de reconnexion au lieu de tout jeter
    if (myRole === 'guest') {
      guestUnexpectedClose();
    } else {
      hostUnexpectedClose();
    }
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

export function setRoomScores(scores) {
  if (scores && Number.isFinite(scores.host) && Number.isFinite(scores.guest)) {
    roomScores = { host: scores.host, guest: scores.guest };
    updateScoresUI();
  }
}

// --- Reconnexion 1v1 : l'hôte garde le salon ouvert, l'invité recompose le numéro ---
let closeExpected = false;
let hostWaitTimeout = null;
let guestRedialTimers = [];

function clearRejoinTimers() {
  if (hostWaitTimeout) { clearTimeout(hostWaitTimeout); hostWaitTimeout = null; }
  guestRedialTimers.forEach(clearTimeout);
  guestRedialTimers = [];
}

function serializeAnswers() {
  return gameState.answers.map((a) => {
    if (!a) return null;
    const country = a.country || a;
    return { code: country.code, player: a.player || null };
  });
}

function buildStateSync() {
  return {
    type: 'STATE_SYNC',
    rowIndices: gameState.currentGridIndices?.rowIndices,
    colIndices: gameState.currentGridIndices?.colIndices,
    startingPlayer,
    currentTurn,
    isHardcore: isHardcoreRoom,
    hardcoreModifierId: gameState.hardcoreModifier ? gameState.hardcoreModifier.id : null,
    answers: serializeAnswers(),
    scores: { ...roomScores },
  };
}

function fullMultiplayerCleanup() {
  clearRejoinTimers();
  isMultiplayer = false;
  isHardcoreRoom = false;
  gameState.isHardcore = false;
  gameState.hardcoreModifier = null;
  stopTurnTimer();
  addGameFeed(t('mp.disconnected'), 'wrong');
  feedback.textContent = t('mp.conn_lost');
  updateMultiplayerUI();
  updateHardcoreUI();
  renderBoard();
}

function guestUnexpectedClose() {
  stopTurnTimer();
  updateStatus(t('mp.reconnecting'), 'connecting');
  addGameFeed(t('mp.reconnecting'), 'info');
  clearRejoinTimers();
  const hostPeerId = `cdoku-1v1-${currentRoomCode}`;
  // 3 tentatives de recomposition (le salon hôte survit 60s)
  [2000, 6000, 12000].forEach((delay) => {
    guestRedialTimers.push(setTimeout(() => {
      if (closeExpected || !isMultiplayer || !peer || peer.destroyed) return;
      try {
        conn = peer.connect(hostPeerId, { reliable: true });
        setupConnectionListeners();
      } catch (e) {}
    }, delay));
  });
  // Échec définitif après 20s
  guestRedialTimers.push(setTimeout(() => {
    if (closeExpected || !isMultiplayer) return;
    if (!conn || !conn.open) fullMultiplayerCleanup();
  }, 20000));
}

function hostUnexpectedClose() {
  stopTurnTimer();
  clearRejoinTimers();
  updateStatus(t('mp.waiting_reconnect'), 'connecting');
  const msg = t('mp.waiting_reconnect');
  addGameFeed(msg, 'info');
  setFeedback(msg, 'normal');
  updateMultiplayerUI();
  renderBoard();
  // L'adversaire a 60s pour revenir avec le même lien/code, sinon nettoyage
  hostWaitTimeout = setTimeout(() => {
    if (!closeExpected && isMultiplayer) fullMultiplayerCleanup();
  }, 60000);
}

// F-02 FIX: Timer basé sur Date.now()
export function startTurnTimer() {
  stopTurnTimer();
  turnTimeLeft = 30;
  turnEndTime = Date.now() + 30000;
  updateTimerUI();

  if (!isMultiplayer) return;

  turnTimerInterval = setInterval(() => {
    turnTimeLeft = Math.max(0, Math.round((turnEndTime - Date.now()) / 1000));
    updateTimerUI();

    if (turnTimeLeft <= 0) {
      stopTurnTimer();
      if (currentTurn === myRole) {
        if (searchDialog && searchDialog.open) searchDialog.close();
        gameState.selectedCell = null;
        currentTurn = currentTurn === 'host' ? 'guest' : 'host';
        safeSend({ type: 'TIMEOUT_PASS', player: myRole });
        const senderName = myRole === 'host' 
          ? (getLanguage() === 'en' ? '🟢 Player 1 (Host)' : '🟢 Joueur 1 (Hôte)') 
          : (getLanguage() === 'en' ? '🔵 Player 2 (Guest)' : '🔵 Joueur 2 (Invité)');
        const msg = t('board.timeout_msg', { player: senderName });
        setFeedback(msg, 'wrong');
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
    if (isHardcoreRoom) {
      gameState.isHardcore = true;
      gameState.hardcoreModifier = getRandomHardcoreModifierFor1v1(gameState.hardcoreModifier?.id);
    }
    generateGrid();
  }

  safeSend({
    type: 'INIT_GAME',
    rowIndices: gameState.currentGridIndices.rowIndices,
    colIndices: gameState.currentGridIndices.colIndices,
    startingPlayer,
    isHardcore: isHardcoreRoom,
    hardcoreModifierId: gameState.hardcoreModifier ? gameState.hardcoreModifier.id : null
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
  updateHardcoreUI();
  startTurnTimer();
  if (isHardcoreRoom && gameState.hardcoreModifier) {
    showHardcore1v1Intro(gameState.hardcoreModifier);
  }
}

export function handleIncomingData(data) {
  console.log("[WebRTC] Données reçues:", data);

  if (data.type === 'GUEST_JOINED' && myRole === 'host') {
    // Retour d'un invité déconnecté en pleine partie → resync au lieu de reset
    if (gameState.answers.some(Boolean)) {
      clearRejoinTimers();
      safeSend(buildStateSync());
      const backMsg = t('mp.opponent_back');
      addGameFeed(backMsg, 'correct');
      setFeedback(backMsg, 'correct');
      updateMultiplayerUI();
      renderBoard();
      startTurnTimer();
      return;
    }
    if (isHardcoreRoom) {
      gameState.isHardcore = true;
      if (!gameState.hardcoreModifier) {
        gameState.hardcoreModifier = getRandomHardcoreModifierFor1v1();
      }
    } else {
      gameState.isHardcore = false;
      gameState.hardcoreModifier = null;
    }
    generateGrid();
    gameState.answers = Array(9).fill(null);
    safeSend({
      type: 'INIT_GAME',
      rowIndices: gameState.currentGridIndices.rowIndices,
      colIndices: gameState.currentGridIndices.colIndices,
      startingPlayer,
      isHardcore: isHardcoreRoom,
      hardcoreModifierId: gameState.hardcoreModifier ? gameState.hardcoreModifier.id : null
    });
    renderBoard();
    updateHardcoreUI();
  }

  if (data.type === 'STATE_SYNC' && myRole === 'guest') {
    const validIndices = (arr) => Array.isArray(arr) && arr.length === 3
      && arr.every((i) => Number.isInteger(i) && i >= 0 && i < allCriteria.length);
    if (!validIndices(data.rowIndices) || !validIndices(data.colIndices)) return;
    clearRejoinTimers();
    isHardcoreRoom = !!data.isHardcore;
    gameState.isHardcore = isHardcoreRoom;
    gameState.hardcoreModifier = (isHardcoreRoom && data.hardcoreModifierId)
      ? getHardcoreModifierById(data.hardcoreModifierId)
      : null;
    generateGrid(data.rowIndices, data.colIndices);
    gameState.answers = (data.answers || []).map((a) => {
      if (!a) return null;
      const country = countries.find((c) => c.code === a.code);
      return country ? { country, player: a.player } : null;
    });
    gameState.selectedCell = null;
    startingPlayer = data.startingPlayer || 'host';
    currentTurn = data.currentTurn || startingPlayer;
    setRoomScores(data.scores);
    updateMultiplayerUI();
    updateHardcoreUI();
    renderBoard();
    startTurnTimer();
    const backMsg = t('mp.reconnected');
    addGameFeed(backMsg, 'correct');
    setFeedback(backMsg, 'correct');
    updateStatus(t('mp.connected'), 'success');
  }

  if (data.type === 'GUEST_READY') {
    updateMultiplayerUI();
    addGameFeed(t('mp.guest_connected'));
    startTurnTimer();
    renderBoard();
    if (isHardcoreRoom && gameState.hardcoreModifier) {
      showHardcore1v1Intro(gameState.hardcoreModifier);
    }
  }

  if (data.type === 'INIT_GAME') {
    // Validation stricte des indices (anti-désync / anti-crash)
    const validIndices = (arr) => Array.isArray(arr) && arr.length === 3
      && arr.every((i) => Number.isInteger(i) && i >= 0 && i < allCriteria.length);
    if (!validIndices(data.rowIndices) || !validIndices(data.colIndices)) {
      console.warn("⚠️ INIT_GAME rejeté : indices invalides.", data);
      return;
    }
    isHardcoreRoom = !!data.isHardcore;
    gameState.isHardcore = isHardcoreRoom;
    if (isHardcoreRoom && data.hardcoreModifierId) {
      gameState.hardcoreModifier = getHardcoreModifierById(data.hardcoreModifierId);
    } else {
      gameState.hardcoreModifier = null;
    }
    generateGrid(data.rowIndices, data.colIndices);
    gameState.answers = Array(9).fill(null);
    gameState.selectedCell = null;
    startingPlayer = data.startingPlayer || 'host';
    currentTurn = startingPlayer;
    updateMultiplayerUI();
    updateHardcoreUI();
    renderBoard();
    startTurnTimer();
    safeSend({ type: 'GUEST_READY' });
    if (isHardcoreRoom && gameState.hardcoreModifier) {
      showHardcore1v1Intro(gameState.hardcoreModifier);
    }
  }

  // VALIDATION STRICTE
  if (data.type === 'MAKE_MOVE') {
    if (typeof data.countryCode !== 'string' || !/^[A-Z]{3}$/.test(data.countryCode)) {
      console.warn("⚠️ MAKE_MOVE rejeté : code pays invalide.", data);
      return;
    }
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
        const cellNumber = targetCellId + 1;
        const feedMsg = getLanguage() === 'en'
          ? `🔵 Opponent placed ${safeName}${pctText} (Cell ${cellNumber}).`
          : `🔵 L'adversaire a placé ${safeName}${pctText} (Case ${cellNumber}).`;
        addGameFeed(feedMsg, 'info');
        const oppPlacedMsg = t('board.mp_correct_opp', { country: safeName, cell: cellNumber, pct: pctText });
        setFeedback(oppPlacedMsg, 'correct');
        currentTurn = data.player === 'host' ? 'guest' : 'host';
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
    if (data.player !== 'host' && data.player !== 'guest') return;
    // Tour recalculé localement : l'erreur fait perdre la main, point.
    currentTurn = data.player === 'host' ? 'guest' : 'host';
    if (searchDialog && searchDialog.open) searchDialog.close();
    const cellNumber = (data.cellId || 0) + 1;
    const safeCountryName = escapeHtml(data.countryName || (getLanguage() === 'en' ? 'a country' : 'un pays'));
    const safeReason = escapeHtml(data.reason || (getLanguage() === 'en' ? 'Criterion not met' : 'Critère non respecté'));
    const feedMsg = getLanguage() === 'en'
      ? `❌ Opponent proposed "${safeCountryName}" for Cell ${cellNumber} (Rejected: ${safeReason}).`
      : `❌ L'adversaire a proposé "${safeCountryName}" pour la Case ${cellNumber} (Refusé : ${safeReason}).`;
    addGameFeed(feedMsg, 'wrong');
    const oppWrongMsg = t('board.mp_wrong_opp', { country: safeCountryName, cell: cellNumber, reason: safeReason });
    setFeedback(oppWrongMsg, 'wrong');
    updateMultiplayerUI();
    renderBoard();
    startTurnTimer();
  }

  if (data.type === 'TIMEOUT_PASS') {
    // N'accepte le timeout que si c'était bien le tour de l'expéditeur
    if (data.player !== currentTurn) {
      console.warn("⚠️ TIMEOUT_PASS rejeté : pas le tour de l'expéditeur.", data);
      return;
    }
    currentTurn = currentTurn === 'host' ? 'guest' : 'host';
    if (searchDialog && searchDialog.open) searchDialog.close();
    updateMultiplayerUI();
    renderBoard();
    startTurnTimer();
  }

  if (data.type === 'PROPOSE_REMATCH' || data.type === 'PROPOSE_NEW_GRID') {
    // Anti-spam : une proposition à la fois
    if (gridProposalDialog && gridProposalDialog.open) return;
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
  closeExpected = true;
  clearRejoinTimers();
  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }
  conn = null;
  isMultiplayer = false;
  isHardcoreRoom = false;
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
  
  resetGameState(true, false);
  updateMultiplayerUI();
  updateHardcoreUI();
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
