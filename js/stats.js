// Gestionnaire de statistiques de choix des joueurs (Proportions par couple de critères)

const STORAGE_KEY = 'countrydoku_stats_v1';

// Base de statistiques pré-remplie pour offrir des pourcentages réalistes dès le départ
const BASELINE_STATS = {
  // Exemples génériques pour alimenter le démarrage
  "En Afrique___Drapeau avec du rouge": { total: 30, countries: { "AGO": 10, "EGY": 8, "MAR": 7, "KEN": 5 } },
  "En Europe___Possède un accès à la mer": { total: 45, countries: { "FRA": 18, "ESP": 15, "ITA": 12 } },
  "Dans l’hémisphère Nord___Superficie > 1 000 000 km²": { total: 40, countries: { "CAN": 16, "USA": 14, "CHN": 10 } }
};

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...BASELINE_STATS };
    const parsed = JSON.parse(raw);
    return { ...BASELINE_STATS, ...parsed };
  } catch (e) {
    return { ...BASELINE_STATS };
  }
}

function saveStats(stats) {
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
