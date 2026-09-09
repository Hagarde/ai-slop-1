import {
  brGameState,
  resetBrState,
  pickBombCriterion,
  pickBombCriteria,
  pickCompatibleSecondCriterion,
  checkEscalationNeed,
  pickCumulativeCriteria,
  validateBattleRoyaleMove,
  getNextAlivePlayer,
  applyLifeLoss,
  checkBrWinner
} from './battle_royale.js';
import { countries, allCriteria } from './data.js';
import { t, getLanguage, getCountryName } from './i18n.js';
import {
  updateBrLobbyUI,
  updateBrArenaUI,
  updateBrTimerUI,
  updateBrPodiumUI,
  addBrFeed,
  setBrFeedback
} from './ui.js';

export let isPartyMode = false;
export let isBrHost = false;
export let myBrPlayerId = null;
export let currentBrCode = null;

let peer = null;
let guestConn = null;
let hostConnections = new Map(); // peerId -> DataConnection
let brTimerInterval = null;

const METERED_API_URL = 'https://countrydoku.metered.live/api/v1/turn/credentials';
const METERED_API_KEY = 'aa340d9ab8937dc2645bfb6845b86c60c969';
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.services.mozilla.com' }
];

async function buildPeerConfig() {
  let iceServers = [...STUN_SERVERS];
  try {
    const resp = await fetch(`${METERED_API_URL}?apiKey=${METERED_API_KEY}`);
    if (resp.ok) {
      const turnServers = await resp.json();
      if (Array.isArray(turnServers) && turnServers.length > 0) {
        iceServers = [...STUN_SERVERS, ...turnServers];
      }
    }
  } catch (e) {
    console.warn('[Party WebRTC] Fallback STUN uniquement', e);
  }
  return {
    debug: 1,
    config: { iceServers, iceCandidatePoolSize: 10 }
  };
}

/**
 * Prépare les critères sous forme sérialisable (index dans allCriteria)
 */
function serializeCriteria(critList) {
  return critList.map((crit) => allCriteria.indexOf(crit));
}

function deserializeCriteria(indices) {
  return indices.map((idx) => allCriteria[idx]).filter(Boolean);
}

/**
 * Envoie un message à tous les invités (Hôte -> Tous)
 */
export function broadcastToGuests(data) {
  for (const [peerId, conn] of hostConnections.entries()) {
    if (conn && conn.open) {
      try {
        conn.send(data);
      } catch (e) {
        console.warn(`[Party] Erreur envoi vers ${peerId}`, e);
      }
    }
  }
}

/**
 * Envoie un message au Host (Invité -> Hôte)
 */
export function sendToHost(data) {
  if (guestConn && guestConn.open) {
    guestConn.send(data);
    return true;
  }
  return false;
}

// ==========================================
// 1. CRÉATION D'ARÈNE (HÔTE)
// ==========================================
export async function initPartyHost(customCode = null, pseudo = 'Joueur 1', avatar = '👑', mode = 'bomb', timer = 15, bombDifficulty = '1') {
  const code = customCode || Math.random().toString(36).substring(2, 6).toUpperCase();
  currentBrCode = code;
  isPartyMode = true;
  isBrHost = true;
  resetBrState();

  brGameState.mode = mode;
  brGameState.bombDifficulty = bombDifficulty;
  brGameState.timerDuration = timer;
  brGameState.status = 'lobby';

  const peerId = `cdoku-br-${code}`;
  myBrPlayerId = peerId;

  // Enregistre l'hôte comme joueur 1
  brGameState.players = [
    {
      id: peerId,
      pseudo: pseudo.trim() || 'Hôte',
      avatar: avatar || '👑',
      isHost: true,
      lives: 3,
      isAlive: true
    }
  ];

  if (peer) {
    try { peer.destroy(); } catch (e) {}
  }
  hostConnections.clear();

  const peerConfig = await buildPeerConfig();
  peer = new Peer(peerId, peerConfig);

  peer.on('open', () => {
    console.log(`[BR Host] Arène créée avec le code: ${code}`);
    const newUrl = `${window.location.origin}${window.location.pathname}?br=${code}`;
    window.history.pushState({}, '', newUrl);
    updateBrLobbyUI();
  });

  peer.on('connection', (conn) => {
    setupHostIncomingConnection(conn);
  });

  peer.on('error', (err) => {
    console.error('[BR Host Error]', err);
    if (err.type === 'unavailable-id') {
      initPartyHost(null, pseudo, avatar, mode, timer, bombDifficulty);
    }
  });
}

function setupHostIncomingConnection(conn) {
  conn.on('open', () => {
    console.log(`[BR Host] Nouveau joueur connecté : ${conn.peer}`);
    hostConnections.set(conn.peer, conn);
  });

  conn.on('data', (data) => {
    handleHostIncomingData(conn, data);
  });

  conn.on('close', () => {
    console.log(`[BR Host] Joueur déconnecté : ${conn.peer}`);
    hostConnections.delete(conn.peer);
    handlePlayerLeft(conn.peer);
  });
}

function handlePlayerLeft(leftPeerId) {
  const player = brGameState.players.find((p) => p.id === leftPeerId);
  if (!player) return;

  if (brGameState.status === 'lobby') {
    brGameState.players = brGameState.players.filter((p) => p.id !== leftPeerId);
    broadcastToGuests({
      type: 'LOBBY_UPDATE',
      players: brGameState.players,
      mode: brGameState.mode,
      bombDifficulty: brGameState.bombDifficulty,
      timerDuration: brGameState.timerDuration
    });
    updateBrLobbyUI();
  } else if (brGameState.status === 'playing') {
    player.isAlive = false;
    player.lives = 0;
    addBrFeed(t('br.eliminated_feed', { player: player.pseudo }), 'wrong');

    const winner = checkBrWinner();
    if (winner) {
      stopBrTimer();
      broadcastToGuests({
        type: 'GAME_OVER',
        winner,
        players: brGameState.players
      });
      updateBrPodiumUI(winner);
    } else {
      if (brGameState.currentTurnPlayerId === leftPeerId) {
        const nextPlayer = getNextAlivePlayer(leftPeerId);
        brGameState.currentTurnPlayerId = nextPlayer ? nextPlayer.id : null;
        hostResetTurnTimer();
        broadcastToGuests({
          type: 'TURN_SWITCH',
          currentTurnPlayerId: brGameState.currentTurnPlayerId,
          turnEndTime: brGameState.turnEndTime,
          players: brGameState.players
        });
      }
      updateBrArenaUI();
    }
  }
}

function handleHostIncomingData(conn, data) {
  if (data.type === 'JOIN_LOBBY') {
    if (brGameState.status !== 'lobby') {
      conn.send({ type: 'ERROR', message: 'La partie a déjà commencé.' });
      return;
    }
    if (brGameState.players.length >= 8) {
      conn.send({ type: 'ERROR', message: 'L\'arène est complète (8 joueurs max).' });
      return;
    }

    const pseudo = (data.pseudo || `Joueur ${brGameState.players.length + 1}`).trim();
    const avatar = data.avatar || '🌍';

    brGameState.players.push({
      id: conn.peer,
      pseudo,
      avatar,
      isHost: false,
      lives: 3,
      isAlive: true
    });

    // Envoi de l'état complet du lobby à tous les joueurs
    const lobbyPayload = {
      type: 'LOBBY_UPDATE',
      players: brGameState.players,
      mode: brGameState.mode,
      bombDifficulty: brGameState.bombDifficulty,
      timerDuration: brGameState.timerDuration,
      code: currentBrCode
    };

    broadcastToGuests(lobbyPayload);
    updateBrLobbyUI();
  }

  if (data.type === 'SUBMIT_COUNTRY') {
    if (brGameState.status !== 'playing') return;
    if (brGameState.currentTurnPlayerId !== conn.peer) return;

    hostProcessMove(conn.peer, data.countryCode);
  }
}

// ==========================================
// 2. REJOINDRE UNE ARÈNE (INVITÉ)
// ==========================================
export async function joinPartyGuest(code, pseudo = 'Joueur', avatar = '🌍') {
  currentBrCode = code.trim().toUpperCase();
  isPartyMode = true;
  isBrHost = false;
  resetBrState();
  brGameState.status = 'connecting';

  setBrFeedback(t('br.connecting'), 'normal');

  const hostPeerId = `cdoku-br-${currentBrCode}`;
  const peerConfig = await buildPeerConfig();

  if (peer) {
    try { peer.destroy(); } catch (e) {}
  }

  peer = new Peer(peerConfig);

  peer.on('open', (id) => {
    myBrPlayerId = id;
    guestConn = peer.connect(hostPeerId, { reliable: true });

    guestConn.on('open', () => {
      console.log(`[BR Guest] Connecté à l'hôte: ${hostPeerId}`);
      guestConn.send({
        type: 'JOIN_LOBBY',
        pseudo,
        avatar
      });
    });

    guestConn.on('data', (data) => {
      handleGuestIncomingData(data);
    });

    guestConn.on('close', () => {
      console.warn('[BR Guest] Connexion avec l\'hôte perdue');
      setBrFeedback(t('br.disconnected'), 'wrong');
      leaveParty();
    });
  });

  peer.on('error', (err) => {
    console.error('[BR Guest Error]', err);
    setBrFeedback(t('br.disconnected'), 'wrong');
  });
}

function handleGuestIncomingData(data) {
  if (data.type === 'LOBBY_UPDATE') {
    brGameState.status = 'lobby';
    brGameState.players = data.players;
    brGameState.mode = data.mode;
    brGameState.bombDifficulty = data.bombDifficulty || '1';
    brGameState.timerDuration = data.timerDuration;
    updateBrLobbyUI();
  }

  if (data.type === 'GAME_START') {
    brGameState.status = 'playing';
    brGameState.round = data.round;
    brGameState.mode = data.mode;
    brGameState.bombDifficulty = data.bombDifficulty || '1';
    brGameState.players = data.players;
    brGameState.currentTurnPlayerId = data.currentTurnPlayerId;
    brGameState.turnEndTime = data.turnEndTime;
    brGameState.activeCriteria = deserializeCriteria(data.criteriaIndices);
    brGameState.usedCountries = data.usedCountries || [];
    startClientTimer();
    updateBrArenaUI();
  }

  if (data.type === 'MOVE_RESULT') {
    brGameState.players = data.players;
    brGameState.usedCountries = data.usedCountries;
    brGameState.currentTurnPlayerId = data.nextPlayerId;
    brGameState.turnEndTime = data.turnEndTime;

    if (data.feedMessage) {
      addBrFeed(data.feedMessage, data.success ? 'correct' : 'wrong');
    }
    startClientTimer();
    updateBrArenaUI();
  }

  if (data.type === 'CRITERIA_ESCALATED') {
    brGameState.activeCriteria = deserializeCriteria(data.criteriaIndices);
    addBrFeed(t('br.escalation_feed', { count: brGameState.activeCriteria.length }), 'info');
    updateBrArenaUI();
  }

  if (data.type === 'TURN_SWITCH') {
    brGameState.players = data.players;
    brGameState.currentTurnPlayerId = data.currentTurnPlayerId;
    brGameState.turnEndTime = data.turnEndTime;
    startClientTimer();
    updateBrArenaUI();
  }

  if (data.type === 'ROUND_NEXT') {
    brGameState.round = data.round;
    brGameState.activeCriteria = deserializeCriteria(data.criteriaIndices);
    brGameState.usedCountries = [];
    brGameState.currentTurnPlayerId = data.currentTurnPlayerId;
    brGameState.turnEndTime = data.turnEndTime;
    addBrFeed(t('br.round_badge', { round: data.round }), 'info');
    startClientTimer();
    updateBrArenaUI();
  }

  if (data.type === 'GAME_OVER') {
    stopBrTimer();
    brGameState.status = 'gameover';
    brGameState.winner = data.winner;
    brGameState.players = data.players;
    updateBrPodiumUI(data.winner);
  }
}

// ==========================================
// 3. BOUCLE DE JEU (AUTORITÉ HÔTE)
// ==========================================
export function hostStartGame() {
  if (!isBrHost || brGameState.players.length < 2) return;

  brGameState.status = 'playing';
  brGameState.round = 1;
  brGameState.usedCountries = [];
  brGameState.initialTotalLives = brGameState.players.reduce((sum, p) => sum + p.lives, 0);

  // Choix des critères de départ selon le mode et la difficulté
  if (brGameState.mode === 'waves') {
    brGameState.activeCriteria = pickCumulativeCriteria(1);
  } else {
    const critCount = brGameState.bombDifficulty === '2' ? 2 : 1;
    brGameState.activeCriteria = pickBombCriteria(critCount);
  }

  // Premier joueur vivant
  const firstPlayer = brGameState.players[0];
  brGameState.currentTurnPlayerId = firstPlayer.id;
  hostResetTurnTimer();

  const startPayload = {
    type: 'GAME_START',
    round: brGameState.round,
    mode: brGameState.mode,
    bombDifficulty: brGameState.bombDifficulty,
    players: brGameState.players,
    currentTurnPlayerId: brGameState.currentTurnPlayerId,
    turnEndTime: brGameState.turnEndTime,
    criteriaIndices: serializeCriteria(brGameState.activeCriteria),
    usedCountries: brGameState.usedCountries
  };

  broadcastToGuests(startPayload);
  startClientTimer();
  updateBrArenaUI();
}

function checkAndApplyEscalation() {
  if (checkEscalationNeed()) {
    const secondCrit = pickCompatibleSecondCriterion(brGameState.activeCriteria[0]);
    if (secondCrit) {
      brGameState.activeCriteria.push(secondCrit);
      addBrFeed(t('br.escalation_feed', { count: 2 }), 'info');
      broadcastToGuests({
        type: 'CRITERIA_ESCALATED',
        criteriaIndices: serializeCriteria(brGameState.activeCriteria)
      });
    }
  }
}

function hostResetTurnTimer() {
  brGameState.turnEndTime = Date.now() + brGameState.timerDuration * 1000;
  stopBrTimer();

  brTimerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.round((brGameState.turnEndTime - Date.now()) / 1000));
    updateBrTimerUI(remaining);

    if (remaining <= 0) {
      stopBrTimer();
      hostHandleTimeout();
    }
  }, 250);
}

function hostHandleTimeout() {
  const timeoutPlayerId = brGameState.currentTurnPlayerId;
  const player = brGameState.players.find((p) => p.id === timeoutPlayerId);
  if (!player) return;

  const { eliminated, livesRemaining } = applyLifeLoss(timeoutPlayerId);
  const feedMsg = eliminated
    ? t('br.eliminated_feed', { player: player.pseudo })
    : t('br.lost_life_feed', { player: player.pseudo, reason: t('br.err_timeout'), lives: livesRemaining });

  addBrFeed(feedMsg, 'wrong');

  const winner = checkBrWinner();
  if (winner) {
    stopBrTimer();
    broadcastToGuests({
      type: 'GAME_OVER',
      winner,
      players: brGameState.players
    });
    updateBrPodiumUI(winner);
    return;
  }

  // Vérifie si la bombe doit escalader vers 2 conditions
  checkAndApplyEscalation();

  const nextPlayer = getNextAlivePlayer(timeoutPlayerId);
  brGameState.currentTurnPlayerId = nextPlayer ? nextPlayer.id : null;
  hostResetTurnTimer();

  const payload = {
    type: 'MOVE_RESULT',
    success: false,
    reason: 'TIMEOUT',
    feedMessage: feedMsg,
    players: brGameState.players,
    usedCountries: brGameState.usedCountries,
    nextPlayerId: brGameState.currentTurnPlayerId,
    turnEndTime: brGameState.turnEndTime
  };

  broadcastToGuests(payload);
  updateBrArenaUI();
}

export function submitCountryMove(countryCode) {
  if (isBrHost) {
    hostProcessMove(myBrPlayerId, countryCode);
  } else {
    sendToHost({ type: 'SUBMIT_COUNTRY', countryCode });
  }
}

function hostProcessMove(playerId, countryCode) {
  const player = brGameState.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) return;

  const result = validateBattleRoyaleMove(countryCode);

  if (result.isValid) {
    const country = result.country;
    const countryName = getCountryName(country);

    brGameState.usedCountries.unshift({
      code: country.code,
      name: countryName,
      pseudo: player.pseudo,
      avatar: player.avatar
    });

    const feedMsg = t('br.correct_feed', { player: player.pseudo, country: countryName });
    addBrFeed(feedMsg, 'correct');

    // Vérifier si la manche doit avancer (en mode Vagues ou si un tour complet est fait)
    if (brGameState.mode === 'waves') {
      // Si tous les joueurs encore vivants ont validé un pays dans cette manche
      const alivePlayers = brGameState.players.filter((p) => p.isAlive);
      const playersAnsweredInRound = new Set(brGameState.usedCountries.map((u) => u.pseudo));
      const allAnswered = alivePlayers.every((p) => playersAnsweredInRound.has(p.pseudo));

      if (allAnswered) {
        brGameState.round += 1;
        brGameState.activeCriteria = pickCumulativeCriteria(brGameState.round);
        brGameState.usedCountries = [];
        const nextPlayer = getNextAlivePlayer(playerId);
        brGameState.currentTurnPlayerId = nextPlayer ? nextPlayer.id : null;
        hostResetTurnTimer();

        broadcastToGuests({
          type: 'ROUND_NEXT',
          round: brGameState.round,
          criteriaIndices: serializeCriteria(brGameState.activeCriteria),
          currentTurnPlayerId: brGameState.currentTurnPlayerId,
          turnEndTime: brGameState.turnEndTime
        });
        updateBrArenaUI();
        return;
      }
    }

    // Passage au joueur suivant
    const nextPlayer = getNextAlivePlayer(playerId);
    brGameState.currentTurnPlayerId = nextPlayer ? nextPlayer.id : null;
    hostResetTurnTimer();

    const payload = {
      type: 'MOVE_RESULT',
      success: true,
      feedMessage: feedMsg,
      players: brGameState.players,
      usedCountries: brGameState.usedCountries,
      nextPlayerId: brGameState.currentTurnPlayerId,
      turnEndTime: brGameState.turnEndTime
    };

    broadcastToGuests(payload);
    updateBrArenaUI();
  } else {
    // Mauvais coup
    const reasonText = result.reason === 'ALREADY_USED' ? t('br.err_already_used') : t('br.err_not_valid');
    const { eliminated, livesRemaining } = applyLifeLoss(playerId);

    const feedMsg = eliminated
      ? t('br.eliminated_feed', { player: player.pseudo })
      : t('br.lost_life_feed', { player: player.pseudo, reason: reasonText, lives: livesRemaining });

    addBrFeed(feedMsg, 'wrong');

    const winner = checkBrWinner();
    if (winner) {
      stopBrTimer();
      broadcastToGuests({
        type: 'GAME_OVER',
        winner,
        players: brGameState.players
      });
      updateBrPodiumUI(winner);
      return;
    }

    // Vérifie si la bombe doit escalader vers 2 conditions
    checkAndApplyEscalation();

    const nextPlayer = getNextAlivePlayer(playerId);
    brGameState.currentTurnPlayerId = nextPlayer ? nextPlayer.id : null;
    hostResetTurnTimer();

    const payload = {
      type: 'MOVE_RESULT',
      success: false,
      reason: result.reason,
      feedMessage: feedMsg,
      players: brGameState.players,
      usedCountries: brGameState.usedCountries,
      nextPlayerId: brGameState.currentTurnPlayerId,
      turnEndTime: brGameState.turnEndTime
    };

    broadcastToGuests(payload);
    updateBrArenaUI();
  }
}

// ==========================================
// 4. CHRONOMÈTRE CLIENT & SORTIE
// ==========================================
function startClientTimer() {
  stopBrTimer();
  brTimerInterval = setInterval(() => {
    if (!brGameState.turnEndTime) return;
    const remaining = Math.max(0, Math.round((brGameState.turnEndTime - Date.now()) / 1000));
    updateBrTimerUI(remaining);
  }, 250);
}

export function stopBrTimer() {
  if (brTimerInterval) {
    clearInterval(brTimerInterval);
    brTimerInterval = null;
  }
}

export function leaveParty() {
  stopBrTimer();
  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }
  guestConn = null;
  hostConnections.clear();
  isPartyMode = false;
  isBrHost = false;
  myBrPlayerId = null;
  currentBrCode = null;
  resetBrState();

  const brDialog = document.querySelector('#battle-royale-dialog');
  if (brDialog && brDialog.open) brDialog.close();

  window.history.pushState({}, '', window.location.pathname);
}
