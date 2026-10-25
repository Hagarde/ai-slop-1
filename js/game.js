import { countries, allCriteria } from './data.js';
import { shuffle } from './utils.js';
import { getLanguage } from './i18n.js';
import { getRandomHardcoreModifier, getHardcoreModifierById } from './hardcore.js';

export const gameState = {
  rows: [],
  columns: [],
  answers: Array(9).fill(null),
  lives: 3,
  selectedCell: null,
  currentGridIndices: null,
  isHardcore: false,
  hardcoreModifier: null,
};

const winningLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

/**
 * Paires de critères impossibles à satisfaire simultanément (cellule à 0 candidat garanti).
 * Vérifiées par construction (plages disjointes, valeurs uniques) ou mesurées sur les données.
 * Utilisées pour écarter un tirage avant le calcul coûteux des candidats.
 */
const EXCLUSIVE_PAIRS = [
  ['Dans l’hémisphère Nord', 'Dans l’hémisphère Sud'],
  ['Pays enclavé (sans mer)', 'Possède un accès à la mer'],
  ['Membre de l’OCDE', 'Non-membre de l’OCDE'],
  ['Superficie > 1 000 000 km²', 'Superficie < 50 000 km²'],
  ['Plus de 100M d’habitants', 'Entre 10M et 100M d’habitants'],
  ['Plus de 100M d’habitants', 'Moins de 10M d’habitants'],
  ['Entre 10M et 100M d’habitants', 'Moins de 10M d’habitants'],
  ['Drapeau à bandes verticales', 'Drapeau à bandes horizontales'],
  ['Écriture officielle latine', 'Écriture officielle non latine'],
  // NOTE : pas de paires de devises ici — le Zimbabwe (multi-devises) utilise
  // Euro + Dollar + Roupie simultanément, donc aucune paire n'est garantie vide.
  // Paires mesurées à 0-1 pays sur la base (audit données) :
  ['En Europe', 'Ancienne colonie espagnole'],
  ['En Europe', 'Territoire de l’Empire inca (Tawantinsuyu)'],
  ['En Océanie', 'Pays enclavé (sans mer)'],
  ['En Océanie', 'Territoire de l’Empire mongol'],
  ['Traversé par l’Équateur', 'Devise : Dinar ou Roupie'],
  ['Traversé par l’Équateur', 'Territoire de l’Empire austro-hongrois'],
];

const exclusiveKeys = new Set(
  EXCLUSIVE_PAIRS.map(([a, b]) => [a, b].sort().join('|||'))
);

export function isExclusivePair(critA, critB) {
  const keyA = critA?.labelFr || critA?.label;
  const keyB = critB?.labelFr || critB?.label;
  if (!keyA || !keyB) return false;
  return exclusiveKeys.has([keyA, keyB].sort().join('|||'));
}

export function cellCandidates(row, column) { 
  return countries.filter((country) => {
    if (gameState.isHardcore && gameState.hardcoreModifier && !gameState.hardcoreModifier.test(country)) {
      return false;
    }
    return row.test(country) && column.test(country);
  }); 
}

function solveGrid(candidateLists, locked = {}) {
  const order = [...candidateLists.keys()].sort((a, b) => candidateLists[a].length - candidateLists[b].length);
  const solution = Array(9).fill(null);
  const used = new Set();
  
  for (const [cell, item] of Object.entries(locked)) { 
    const country = item.country || item; 
    solution[cell] = country; 
    used.add(country.code); 
  }
  
  function visit(position) {
    if (position === order.length) return true;
    const cell = order[position];
    if (solution[cell]) return visit(position + 1);
    
    for (const country of candidateLists[cell]) {
      if (used.has(country.code)) continue;
      solution[cell] = country; used.add(country.code);
      if (visit(position + 1)) return true;
      solution[cell] = null; used.delete(country.code);
    }
    return false;
  }
  return visit(0) ? solution : null;
}

export function generateGrid(rowIndices = null, colIndices = null) {
  if (rowIndices && colIndices) {
    gameState.rows = rowIndices.map(i => allCriteria[i]);
    gameState.columns = colIndices.map(i => allCriteria[i]);
    gameState.currentGridIndices = { rowIndices, colIndices };
    return;
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const choices = shuffle(allCriteria).slice(0, 6);
    const testRows = choices.slice(0, 3);
    const testColumns = choices.slice(3);
    // Pré-filtre : écarte les tirages contenant une paire mutuellement exclusive
    let hasExclusive = false;
    for (const row of testRows) {
      for (const column of testColumns) {
        if (isExclusivePair(row, column)) { hasExclusive = true; break; }
      }
      if (hasExclusive) break;
    }
    if (hasExclusive) continue;
    const lists = testRows.flatMap((row) => testColumns.map((column) => cellCandidates(row, column)));
    
    if (lists.some((list) => list.length < 2)) continue;
    
    if (solveGrid(lists)) {
      gameState.rows = testRows;
      gameState.columns = testColumns;
      gameState.currentGridIndices = {
        rowIndices: gameState.rows.map(r => allCriteria.indexOf(r)),
        colIndices: gameState.columns.map(c => allCriteria.indexOf(c))
      };
      return;
    }
  }
  throw new Error('Aucune grille solvable n’a pu être générée.');
}

export function checkTicTacToeWin(playerRole) {
  for (const line of winningLines) {
    if (line.every((cellId) => gameState.answers[cellId] && gameState.answers[cellId].player === playerRole)) {
      return line;
    }
  }
  return null;
}

export function resetGameState(newSeed = true, isHardcore = null) {
  if (isHardcore !== null) {
    gameState.isHardcore = isHardcore;
  }
  gameState.answers = Array(9).fill(null);
  gameState.selectedCell = null;
  gameState.lives = gameState.isHardcore ? 1 : 3;

  if (newSeed) {
    if (gameState.isHardcore) {
      gameState.hardcoreModifier = getRandomHardcoreModifier(gameState.hardcoreModifier?.id);
    } else {
      gameState.hardcoreModifier = null;
    }
    try {
      generateGrid();
    } catch (e) {
      // Fallback : contrainte hardcore trop stricte -> on retente sans modificateur
      console.warn('[Game] Grille hardcore impossible, fallback solo standard.', e);
      gameState.isHardcore = false;
      gameState.hardcoreModifier = null;
      gameState.lives = 3;
      generateGrid();
    }
  }
}

/**
 * Exporte la graine compacte de la grille active
 * Format : CD-[r0].[r1].[r2]-[c0].[c1].[c2]
 * ou en mode Hardcore : CDH-[modId]-[r0].[r1].[r2]-[c0].[c1].[c2]
 */
export function exportGridSeed() {
  if (!gameState.currentGridIndices) return null;
  const { rowIndices, colIndices } = gameState.currentGridIndices;
  const rStr = rowIndices.join('.');
  const cStr = colIndices.join('.');
  if (gameState.isHardcore && gameState.hardcoreModifier) {
    return `CDH-${gameState.hardcoreModifier.id}-${rStr}-${cStr}`;
  }
  return `CD-${rStr}-${cStr}`;
}

/**
 * Analyse et valide une chaîne de graine
 */
export function parseGridSeed(seedString) {
  if (!seedString || typeof seedString !== 'string') return null;
  const clean = seedString.trim();
  
  if (clean.startsWith('CDH-')) {
    const parts = clean.slice(4).split('-');
    if (parts.length !== 3) return null;
    const [modId, rPart, cPart] = parts;
    const rowIndices = rPart.split('.').map(Number);
    const colIndices = cPart.split('.').map(Number);
    if (rowIndices.length !== 3 || colIndices.length !== 3) return null;
    if (rowIndices.some(i => isNaN(i) || i < 0 || i >= allCriteria.length)) return null;
    if (colIndices.some(i => isNaN(i) || i < 0 || i >= allCriteria.length)) return null;
    const mod = getHardcoreModifierById(modId);
    if (!mod) return null;
    return { isHardcore: true, hardcoreModifier: mod, rowIndices, colIndices };
  } else if (clean.startsWith('CD-')) {
    const parts = clean.slice(3).split('-');
    if (parts.length !== 2) return null;
    const [rPart, cPart] = parts;
    const rowIndices = rPart.split('.').map(Number);
    const colIndices = cPart.split('.').map(Number);
    if (rowIndices.length !== 3 || colIndices.length !== 3) return null;
    if (rowIndices.some(i => isNaN(i) || i < 0 || i >= allCriteria.length)) return null;
    if (colIndices.some(i => isNaN(i) || i < 0 || i >= allCriteria.length)) return null;
    return { isHardcore: false, hardcoreModifier: null, rowIndices, colIndices };
  }
  return null;
}

/**
 * Applique une graine pour restaurer la grille exacte
 * Refuse les grilles insolubles (case sans candidat) pour éviter une partie bloquée.
 */
export function applyGridSeed(seedString) {
  const parsed = parseGridSeed(seedString);
  if (!parsed) return false;

  gameState.isHardcore = parsed.isHardcore;
  gameState.hardcoreModifier = parsed.hardcoreModifier;
  gameState.answers = Array(9).fill(null);
  gameState.selectedCell = null;
  gameState.lives = parsed.isHardcore ? 1 : 3;

  generateGrid(parsed.rowIndices, parsed.colIndices);

  // Vérifie qu'aucune case n'est vide (solvabilité minimale, hardcore inclus)
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (cellCandidates(gameState.rows[r], gameState.columns[c]).length === 0) {
        return false;
      }
    }
  }
  return true;
}

export function getMoveValidationDetails(cellId, countryCode) {
  const country = countries.find((item) => item.code === countryCode);
  if (!country) return { isValid: false, country: null, reason: 'Pays inconnu' };

  const row = Math.floor(cellId / 3);
  const col = cellId % 3;
  const rowCriterion = gameState.rows[row];
  const colCriterion = gameState.columns[col];

  const rowPass = rowCriterion ? rowCriterion.test(country) : false;
  const colPass = colCriterion ? colCriterion.test(country) : false;
  const modifierPass = (!gameState.isHardcore || !gameState.hardcoreModifier)
    ? true
    : gameState.hardcoreModifier.test(country);

  const isValid = rowPass && colPass && modifierPass;

  let reason = '';
  const isEn = getLanguage() === 'en';

  if (!modifierPass && gameState.hardcoreModifier) {
    const mod = gameState.hardcoreModifier;
    const name = isEn ? (country.nameEnglish || country.name) : country.name;
    const pop = (country.population || 0).toLocaleString(isEn ? 'en-US' : 'fr-FR');
    const violation = isEn
      ? mod.violationEn.replace('{country}', name).replace('{pop}', pop)
      : mod.violationFr.replace('{country}', name).replace('{pop}', pop);
    const modTitle = isEn ? mod.titleEn : mod.titleFr;
    reason = isEn
      ? `Hardcore Rule "${modTitle}" violated: ${violation}`
      : `Règle Hardcore "${modTitle}" enfreinte : ${violation}`;
  } else if (!rowPass && !colPass) {
    reason = isEn
      ? `Does not match "${rowCriterion?.label}" nor "${colCriterion?.label}"`
      : `Ne respecte ni "${rowCriterion?.label}" ni "${colCriterion?.label}"`;
  } else if (!rowPass) {
    reason = isEn
      ? `Does not match "${rowCriterion?.label}"`
      : `Ne respecte pas "${rowCriterion?.label}"`;
  } else if (!colPass) {
    reason = isEn
      ? `Does not match "${colCriterion?.label}"`
      : `Ne respecte pas "${colCriterion?.label}"`;
  }

  return { isValid, country, rowCriterion, colCriterion, rowPass, colPass, modifierPass, reason };
}

// Validation d'un coup
export function validateMove(cellId, countryCode) {
  const details = getMoveValidationDetails(cellId, countryCode);
  
  if (details.country && details.rowCriterion && details.colCriterion) {
    console.log(`[VALIDATION] Évaluation de : ${details.country.name} pour la Case ${cellId + 1}`);
    console.log(`  -> Critère Ligne "${details.rowCriterion.label}" : ${details.rowPass ? "✅ VALIDÉ" : "❌ REFUSÉ"}`);
    console.log(`  -> Critère Colonne "${details.colCriterion.label}" : ${details.colPass ? "✅ VALIDÉ" : "❌ REFUSÉ"}`);
    console.log(`  => Résultat global : ${details.isValid ? "✅ CORRECT" : "❌ FAUX"}`);
  }

  return details.isValid;
}
