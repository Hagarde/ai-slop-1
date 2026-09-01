// Gestionnaire de statistiques de choix des joueurs (Proportions par couple de critères)
// O-01 FIX: Cache RAM pour éviter les accès localStorage synchrones répétés

const STORAGE_KEY = 'countrydoku_stats_v1';

// Base de statistiques pré-remplie pour offrir des pourcentages réalistes dès le départ
const BASELINE_STATS = {
  "En Afrique___Drapeau avec du rouge": { total: 30, countries: { "AGO": 10, "EGY": 8, "MAR": 7, "KEN": 5 } },
  "En Europe___Possède un accès à la mer": { total: 45, countries: { "FRA": 18, "ESP": 15, "ITA": 12 } },
  "Dans l'hémisphère Nord___Superficie > 1 000 000 km²": { total: 40, countries: { "CAN": 16, "USA": 14, "CHN": 10 } }
};

// Cache mémoire — chargé une seule fois, lu depuis la RAM ensuite
let memoryStats = null;

function loadStats() {
  if (memoryStats) return memoryStats;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memoryStats = raw ? { ...BASELINE_STATS, ...JSON.parse(raw) } : { ...BASELINE_STATS };
  } catch (e) {
    memoryStats = { ...BASELINE_STATS };
  }
  return memoryStats;
}

function saveStats(stats) {
  memoryStats = stats; // Mise à jour du cache RAM
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn("Impossible de sauvegarder les statistiques dans localStorage", e);
  }
}

function makeKey(rowLabel, colLabel) {
  return `${String(rowLabel || '').trim()}___${String(colLabel || '').trim()}`;
}

export function recordChoice(rowLabel, colLabel, countryCode) {
  if (!rowLabel || !colLabel || !countryCode) return;
  
  const stats = loadStats();
  const key = makeKey(rowLabel, colLabel);
  
  if (!stats[key]) {
    stats[key] = { total: 0, countries: {} };
  }
  
  stats[key].total = (stats[key].total || 0) + 1;
  stats[key].countries[countryCode] = (stats[key].countries[countryCode] || 0) + 1;
  
  saveStats(stats);
}

export function getChoicePercentage(rowLabel, colLabel, countryCode) {
  if (!rowLabel || !colLabel || !countryCode) return null;
  
  const stats = loadStats();
  const key = makeKey(rowLabel, colLabel);
  const cellStat = stats[key];
  
  if (!cellStat || !cellStat.total || cellStat.total <= 0) {
    return null;
  }
  
  const count = cellStat.countries[countryCode] || 0;
  if (count <= 0) return 0;
  
  return Math.round((count / cellStat.total) * 100);
}
