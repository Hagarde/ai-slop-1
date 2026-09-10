import { countries, allCriteria } from './data.js';
import { shuffle } from './utils.js';

export const brGameState = {
  mode: 'bomb', // 'bomb' (1 ou 2 conditions, tour par tour rapide) | 'waves' (conditions cumulatives)
  bombDifficulty: '1', // '1' | '2' | 'escalation'
  initialLivesPerPlayer: 2,
  timerDuration: 15,
  round: 1,
  status: 'idle', // 'idle' | 'lobby' | 'playing' | 'gameover'
  players: [], // [{ id, pseudo, avatar, isHost, lives: 2, isAlive: true, order: 0 }]
  initialTotalLives: 0,
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
  brGameState.bombDifficulty = '1';
  brGameState.initialLivesPerPlayer = 2;
  brGameState.timerDuration = 15;
  brGameState.round = 1;
  brGameState.status = 'idle';
  brGameState.players = [];
  brGameState.initialTotalLives = 0;
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
 * Pioche 1 ou 2 critères pour le mode Bombe Party selon la difficulté
 */
export function pickBombCriteria(count = 1) {
  if (count <= 1) {
    return [pickBombCriterion()];
  }
  // 2 critères croisés équilibrés : au moins 12 pays éligibles au croisement
  for (let attempt = 0; attempt < 300; attempt++) {
    const crit1 = pickBombCriterion();
    const shuffled = shuffle(allCriteria);
    const crit2 = shuffled.find((c2) => {
      if (c2.labelFr === crit1.labelFr) return false;
      if (c2.type && c2.type === crit1.type) return false;
      const countIntersect = countries.filter((c) => crit1.test(c) && c2.test(c)).length;
      return countIntersect >= 12 && countIntersect <= 65;
    });
    if (crit2) {
      return [crit1, crit2];
    }
  }
  return [pickBombCriterion()];
}

/**
 * Trouve un deuxième critère compatible avec le premier pour l'escalade dynamique
 */
export function pickCompatibleSecondCriterion(existingCrit) {
  if (!existingCrit) return null;
  const shuffled = shuffle(allCriteria);
  const crit2 = shuffled.find((c2) => {
    if (c2.labelFr === existingCrit.labelFr) return false;
    if (c2.type && c2.type === existingCrit.type) return false;
    const countIntersect = countries.filter((c) => existingCrit.test(c) && c2.test(c)).length;
    return countIntersect >= 10;
  });
  return crit2 || null;
}

/**
 * Vérifie si la difficulté Bombe Party doit passer à 2 critères (escalade dynamique)
 */
export function checkEscalationNeed() {
  if (brGameState.mode !== 'bomb' || brGameState.bombDifficulty !== 'escalation') {
    return false;
  }
  if (brGameState.activeCriteria.length >= 2) {
    return false;
  }
  const alivePlayers = brGameState.players.filter((p) => p.isAlive);
  if (alivePlayers.length <= 1) return false;

  const currentTotalLives = alivePlayers.reduce((sum, p) => sum + p.lives, 0);
  const initialTotal = brGameState.initialTotalLives || (brGameState.players.length * (brGameState.initialLivesPerPlayer || 2));

  // Déclencher beaucoup plus vite :
  // - Dès la première vie perdue (currentTotalLives < initialTotal)
  // - OU dès 5 pays cités dans la manche
  // - OU duel final (<= 2 joueurs vivants)
  const isLifeLost = currentTotalLives < initialTotal;
  const isPaceReached = (brGameState.usedCountries && brGameState.usedCountries.length >= 5);
  const isFinalDuel = alivePlayers.length <= 2;

  return isLifeLost || isPaceReached || isFinalDuel;
}

/**
 * Calcule la durée dynamique du tour en Bombe Party
 * (La mèche de la bombe brûle plus vite au fur et à mesure que les pays sont validés)
 */
export function computeBombTurnDuration(baseDuration = 15, validCount = 0) {
  const reduced = baseDuration - Math.floor(validCount * 0.6);
  return Math.max(5, reduced);
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
 * Détermine le prochain joueur vivant dans l'ordre de passage circulaire complet
 * Résout le bug où un joueur éliminé faisait sauter le joueur suivant.
 */
export function getNextAlivePlayer(currentId) {
  const all = brGameState.players;
  if (!all || all.length === 0) return null;
  const alive = all.filter((p) => p.isAlive);
  if (alive.length === 0) return null;
  if (alive.length === 1) return alive[0];

  const currentIndex = all.findIndex((p) => p.id === currentId);
  if (currentIndex === -1) {
    return alive[0];
  }

  // Parcourt les joueurs de façon circulaire dans l'ordre complet
  for (let i = 1; i <= all.length; i++) {
    const candidate = all[(currentIndex + i) % all.length];
    if (candidate && candidate.isAlive) {
      return candidate;
    }
  }

  return alive[0];
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
