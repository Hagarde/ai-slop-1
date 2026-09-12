import {
  brGameState,
  resetBrState,
  pickBombCriterion,
  pickBombCriteria,
  pickCompatibleSecondCriterion,
  checkEscalationNeed,
  computeBombTurnDuration,
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

import { buildPeerConfig } from './network.js';

export let isPartyMode = false;
export let isBrHost = false;
export let myBrPlayerId = null;
export let currentBrCode = null;

let peer = null;
let guestConn = null;
let hostConnections = new Map(); // peerId -> DataConnection
let brTimerInterval = null;

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
export async function initPartyHost(customCode = null, pseudo = 'Joueur 1', avatar = '👑', mode = 'bomb', timer = 15, bombDifficulty = '1', lives = 2) {
  const code = customCode || Math.random().toString(36).substring(2, 6).toUpperCase();
  currentBrCode = code;
  isPartyMode = true;
  isBrHost = true;
  resetBrState();

  brGameState.mode = mode;
  brGameState.bombDifficulty = bombDifficulty;
  brGameState.initialLivesPerPlayer = lives;
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
      lives: lives,
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
      initPartyHost(null, pseudo, avatar, mode, timer, bombDifficulty, lives);
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
    // I3: Ajouter au classement podium les joueurs déconnectés
    if (!brGameState.eliminatedOrder.includes(leftPeerId)) {
      brGameState.eliminatedOrder.push(leftPeerId);
    }
    addBrFeed(t('br.eliminated_feed', { player: player.pseudo }), 'wrong');

    const winner = checkBrWinner();
    if (winner || brGameState.status === 'gameover') {
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
      // I4: En mode Vagues, vérifier si la manche doit avancer après la déconnexion
      if (brGameState.mode === 'waves') {
        checkWaveAdvancement();
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
    const guestLives = brGameState.initialLivesPerPlayer || 2;

    brGameState.players.push({
      id: conn.peer,
      pseudo,
      avatar,
      isHost: false,
      lives: guestLives,
      isAlive: true
    });

    // Envoi de l'état complet du lobby à tous les joueurs
    const lobbyPayload = {
      type: 'LOBBY_UPDATE',
      players: brGameState.players,
      mode: brGameState.mode,
      bombDifficulty: brGameState.bombDifficulty,
      initialLivesPerPlayer: guestLives,
      timerDuration: brGameState.timerDuration,
      code: currentBrCode
    };

    broadcastToGuests(lobbyPayload);
    updateBrLobbyUI();
  }

  if (data.type === 'REQUEST_REPLAY') {
    if (brGameState.status === 'gameover') {
      // I2: N'auto-relance plus — notifie l'hôte pour qu'il décide
      const guest = brGameState.players.find((p) => p.id === conn.peer);
      if (guest) addBrFeed(t('br.replay_request_feed', { player: guest.pseudo }), 'info');
    }
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
  // C2: Traitement des erreurs envoyées par l'hôte (arène pleine, partie en cours, etc.)
  if (data.type === 'ERROR') {
    setBrFeedback(data.message || 'Erreur de connexion', 'wrong');
    leaveParty();
    return;
  }

  if (data.type === 'LOBBY_UPDATE') {
    brGameState.status = 'lobby';
    brGameState.players = data.players;
    brGameState.mode = data.mode;
    brGameState.bombDifficulty = data.bombDifficulty || '1';
    brGameState.initialLivesPerPlayer = data.initialLivesPerPlayer || 2;
    brGameState.timerDuration = data.timerDuration;
    updateBrLobbyUI();
  }

  if (data.type === 'GAME_START') {
    brGameState.status = 'playing';
    brGameState.round = data.round;
    brGameState.mode = data.mode;
    brGameState.bombDifficulty = data.bombDifficulty || '1';
    brGameState.initialLivesPerPlayer = data.initialLivesPerPlayer || 2;
    brGameState.players = data.players;
    brGameState.currentTurnPlayerId = data.currentTurnPlayerId;
    brGameState.turnEndTime = data.turnEndTime;
    brGameState.activeCriteria = deserializeCriteria(data.criteriaIndices);
    brGameState.usedCountries = data.usedCountries || [];
    brGameState.winner = null;
    brGameState.eliminatedOrder = [];
    startClientTimer();
    updateBrArenaUI();
  }

  if (data.type === 'RETURN_TO_LOBBY') {
    stopBrTimer();
    brGameState.status = 'lobby';
    brGameState.players = data.players;
    brGameState.winner = null;
    brGameState.eliminatedOrder = [];
    brGameState.usedCountries = [];
    updateBrLobbyUI();
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
export function hostStartGame(isRestart = false) {
  if (!isBrHost || brGameState.players.length < 2) return;

  const initialLives = brGameState.initialLivesPerPlayer || 2;
  brGameState.players.forEach((p) => {
    p.lives = initialLives;
    p.isAlive = true;
  });

  brGameState.status = 'playing';
  brGameState.round = 1;
  brGameState.usedCountries = [];
  brGameState.winner = null;
  brGameState.eliminatedOrder = [];
  brGameState.escalatedThisRound = false;
  brGameState.initialTotalLives = brGameState.players.length * initialLives;

  // Choix des critères de départ selon le mode et la difficulté
  if (brGameState.mode === 'waves') {
    brGameState.activeCriteria = pickCumulativeCriteria(1);
  } else {
    const critCount = brGameState.bombDifficulty === '2' ? 2 : 1;
    brGameState.activeCriteria = pickBombCriteria(critCount);
  }

  // Alterne le premier joueur qui commence lors d'une revanche
  if (isRestart) {
    brGameState.lastStartIndex = ((brGameState.lastStartIndex || 0) + 1) % brGameState.players.length;
  } else {
    brGameState.lastStartIndex = 0;
  }
  const firstPlayer = brGameState.players[brGameState.lastStartIndex];
  brGameState.currentTurnPlayerId = firstPlayer.id;
  hostResetTurnTimer();

  const startPayload = {
    type: 'GAME_START',
    round: brGameState.round,
    mode: brGameState.mode,
    bombDifficulty: brGameState.bombDifficulty,
    initialLivesPerPlayer: initialLives,
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

export function hostRestartGame() {
  hostStartGame(true);
}

export function hostReturnToLobby() {
  if (!isBrHost) return;
  stopBrTimer();
  brGameState.status = 'lobby';
  const initialLives = brGameState.initialLivesPerPlayer || 2;
  brGameState.players.forEach((p) => {
    p.lives = initialLives;
    p.isAlive = true;
  });
  brGameState.winner = null;
  brGameState.eliminatedOrder = [];
  brGameState.usedCountries = [];

  const lobbyPayload = {
    type: 'RETURN_TO_LOBBY',
    players: brGameState.players,
    mode: brGameState.mode,
    bombDifficulty: brGameState.bombDifficulty,
    initialLivesPerPlayer: initialLives,
    timerDuration: brGameState.timerDuration,
    code: currentBrCode
  };

  broadcastToGuests(lobbyPayload);
  updateBrLobbyUI();
}

export function requestReplayGuest() {
  if (isBrHost) {
    hostRestartGame();
  } else {
    sendToHost({ type: 'REQUEST_REPLAY' });
    const btn = document.querySelector('#br-replay-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('br.guest_waiting_replay');
    }
  }
}

function checkAndApplyEscalation() {
  if (checkEscalationNeed()) {
    const secondCrit = pickCompatibleSecondCriterion(brGameState.activeCriteria[0]);
    if (secondCrit) {
      brGameState.activeCriteria.push(secondCrit);
      brGameState.escalatedThisRound = true; // I5: Empêche l'escalade multiple
      addBrFeed(t('br.escalation_feed', { count: 2 }), 'info');
      broadcastToGuests({
        type: 'CRITERIA_ESCALATED',
        criteriaIndices: serializeCriteria(brGameState.activeCriteria)
      });
    }
  }
}

/**
 * I4: Vérifie si la manche Vagues doit avancer (utilisé après déconnexion d'un joueur)
 */
function checkWaveAdvancement() {
  if (brGameState.mode !== 'waves' || brGameState.status !== 'playing') return;
  const alivePlayers = brGameState.players.filter((p) => p.isAlive);
  if (alivePlayers.length === 0) return;
  const playersAnsweredInRound = new Set(brGameState.usedCountries.map((u) => u.playerId));
  const allAnswered = alivePlayers.every((p) => playersAnsweredInRound.has(p.id));
  if (!allAnswered) return;

  brGameState.round += 1;
  brGameState.activeCriteria = pickCumulativeCriteria(brGameState.round);
  brGameState.usedCountries = [];
  const nextPlayer = getNextAlivePlayer(brGameState.currentTurnPlayerId);
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
}

function hostResetTurnTimer() {
  const currentDuration = brGameState.mode === 'bomb'
    ? computeBombTurnDuration(brGameState.timerDuration, brGameState.usedCountries.length)
    : brGameState.timerDuration;

  brGameState.turnEndTime = Date.now() + currentDuration * 1000;
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
  if (winner || brGameState.status === 'gameover') {
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
  // C1: Vérification de tour — empêche l'hôte de jouer pendant le tour d'un invité
  if (brGameState.currentTurnPlayerId !== playerId) return;
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
      avatar: player.avatar,
      playerId: player.id // C3: Utiliser l'ID unique pour la vérification de manche Vagues
    });

    const feedMsg = t('br.correct_feed', { player: player.pseudo, country: countryName });
    addBrFeed(feedMsg, 'correct');

    // Vérifier si la manche doit avancer (en mode Vagues ou si un tour complet est fait)
    if (brGameState.mode === 'waves') {
      // C3: Utiliser playerId au lieu de pseudo pour éviter les homonymes
      const alivePlayers = brGameState.players.filter((p) => p.isAlive);
      const playersAnsweredInRound = new Set(brGameState.usedCountries.map((u) => u.playerId));
      const allAnswered = alivePlayers.every((p) => playersAnsweredInRound.has(p.id));

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
    if (winner || brGameState.status === 'gameover') {
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
