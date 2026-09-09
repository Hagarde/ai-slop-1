import { countries, allCriteria } from './data.js';
import { shuffle } from './utils.js';

export const brGameState = {
  mode: 'bomb', // 'bomb' (1 condition, tour par tour rapide) | 'waves' (conditions cumulatives)
  timerDuration: 15,
  round: 1,
  status: 'idle', // 'idle' | 'lobby' | 'playing' | 'gameover'
  players: [], // [{ id, pseudo, avatar, isHost, lives: 3, isAlive: true, order: 0 }]
  currentTurnPlayerId: null,
  activeCriteria: [], // list of active criteria objects for current round
  usedCountries: [], // [{ code, name, pseudo, avatar, flagUrl }]
  turnEndTime: null,
  winner: null,
  eliminatedOrder: [] // IDs of eliminated players in order of elimination (for podium ranking)
};

/**
 * Réinitialise l'état du Battle Royale
 */
export function resetBrState() {
  brGameState.mode = 'bomb';
  brGameState.timerDuration = 15;
  brGameState.round = 1;
  brGameState.status = 'idle';
  brGameState.players = [];
  brGameState.currentTurnPlayerId = null;
  brGameState.activeCriteria = [];
  brGameState.usedCountries = [];
  brGameState.turnEndTime = null;
  brGameState.winner = null;
  brGameState.eliminatedOrder = [];
}

/**
 * Pioche un critère équilibré pour le mode Bombe Party
 * (Garantit au moins 18 pays valides pour laisser de la marge aux joueurs)
 */
export function pickBombCriterion(excludeCritLabel = null) {
  const eligible = allCriteria.filter((crit) => {
    if (excludeCritLabel && crit.labelFr === excludeCritLabel) return false;
    const matchingCount = countries.filter((c) => crit.test(c)).length;
    return matchingCount >= 18 && matchingCount <= 90;
  });

  const pool = eligible.length > 0 ? eligible : allCriteria;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked;
}

/**
 * Pioche une suite de critères cumulatifs pour le mode Vagues
 * ex: Manche 1 = 1 critère (>=25 pays)
 *     Manche 2 = 2 critères (>=10 pays)
 *     Manche 3 = 3 critères (>=4 pays)
 *     Manche 4 = 4 critères (>=1 pays)
 */
export function pickCumulativeCriteria(roundNumber) {
  const targetCount = Math.min(4, Math.max(1, roundNumber));
  
  for (let attempt = 0; attempt < 100; attempt++) {
    const shuffled = shuffle(allCriteria);
    const chosen = [];
    let currentFiltered = [...countries];

    for (let i = 0; i < targetCount; i++) {
      const minRequired = targetCount - i;
      const candidate = shuffled.find((crit) => {
        if (chosen.includes(crit)) return false;
        const remaining = currentFiltered.filter((c) => crit.test(c));
        return remaining.length >= minRequired;
      });

      if (!candidate) break;
      chosen.push(candidate);
      currentFiltered = currentFiltered.filter((c) => candidate.test(c));
    }

    if (chosen.length === targetCount && currentFiltered.length >= 1) {
      return chosen;
    }
  }

  // Fallback si la recherche stricte échoue : 1 critère large
  return [pickBombCriterion()];
}

/**
 * Valide un pays proposé par un joueur dans le round actuel
 */
export function validateBattleRoyaleMove(countryCode) {
  const country = countries.find((c) => c.code === countryCode);
  if (!country) {
    return { isValid: false, reason: 'UNKNOWN_COUNTRY', country: null };
  }

  // 1. Vérifie si le pays a déjà été cité dans cette manche
  const alreadyUsed = brGameState.usedCountries.some((item) => item.code === countryCode);
  if (alreadyUsed) {
    return { isValid: false, reason: 'ALREADY_USED', country };
  }

  // 2. Vérifie si le pays respecte TOUS les critères actifs
  const allPassed = brGameState.activeCriteria.every((crit) => crit.test(country));
  if (!allPassed) {
    return { isValid: false, reason: 'NOT_VALID', country };
  }

  return { isValid: true, reason: null, country };
}

/**
 * Détermine le prochain joueur vivant dans l'ordre de passage
 */
export function getNextAlivePlayer(currentId) {
  const alivePlayers = brGameState.players.filter((p) => p.isAlive);
  if (alivePlayers.length <= 1) return alivePlayers[0] || null;

  const currentIndex = alivePlayers.findIndex((p) => p.id === currentId);
  if (currentIndex === -1) return alivePlayers[0];

  const nextIndex = (currentIndex + 1) % alivePlayers.length;
  return alivePlayers[nextIndex];
}

/**
 * Applique la perte d'une vie à un joueur et vérifie son élimination
 */
export function applyLifeLoss(playerId) {
  const player = brGameState.players.find((p) => p.id === playerId);
  if (!player || !player.isAlive) return { eliminated: false, livesRemaining: 0 };

  player.lives = Math.max(0, player.lives - 1);
  let eliminated = false;

  if (player.lives <= 0) {
    player.isAlive = false;
    eliminated = true;
    if (!brGameState.eliminatedOrder.includes(playerId)) {
      brGameState.eliminatedOrder.push(playerId);
    }
  }

  return { eliminated, livesRemaining: player.lives, player };
}

/**
 * Vérifie s'il ne reste qu'un seul survivant
 */
export function checkBrWinner() {
  const alivePlayers = brGameState.players.filter((p) => p.isAlive);
  if (alivePlayers.length === 1) {
    brGameState.winner = alivePlayers[0];
    brGameState.status = 'gameover';
    return alivePlayers[0];
  }
  if (alivePlayers.length === 0) {
    brGameState.status = 'gameover';
    return null;
  }
  return null;
}
