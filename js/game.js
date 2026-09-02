import { countries, allCriteria } from './data.js';
import { shuffle } from './utils.js';
import { getLanguage } from './i18n.js';

export const gameState = {
  rows: [],
  columns: [],
  answers: Array(9).fill(null),
  lives: 3,
  selectedCell: null,
  currentGridIndices: null,
};

const winningLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export function cellCandidates(row, column) { 
  return countries.filter((country) => row.test(country) && column.test(country)); 
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

export function resetGameState(newSeed = true) {
  gameState.answers = Array(9).fill(null);
  gameState.selectedCell = null;
  gameState.lives = 3;

  if (newSeed) {
    generateGrid();
  }
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
  const isValid = rowPass && colPass;

  let reason = '';
  const isEn = getLanguage() === 'en';
  if (!rowPass && !colPass) {
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

  return { isValid, country, rowCriterion, colCriterion, rowPass, colPass, reason };
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
