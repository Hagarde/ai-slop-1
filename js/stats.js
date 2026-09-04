// Gestionnaire de statistiques de choix des joueurs (Proportions par couple de critères)
// Synchronisation Supabase globale + Fallback LocalStorage hors-ligne

const STORAGE_KEY = 'countrydoku_stats_v1';
const SUPABASE_URL = 'https://ztknesapyabgiwrnelay.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZCxL7JMLYlXLarIkd1C1MA_Romwz2lO';

// Base de statistiques pré-remplie pour offrir des pourcentages réalistes dès le départ
const BASELINE_STATS = {
  "En Afrique___Drapeau avec du rouge": { total: 30, countries: { "AGO": 10, "EGY": 8, "MAR": 7, "KEN": 5 } },
  "En Europe___Possède un accès à la mer": { total: 45, countries: { "FRA": 18, "ESP": 15, "ITA": 12 } },
  "Dans l’hémisphère Nord___Superficie > 1 000 000 km²": { total: 40, countries: { "CAN": 16, "USA": 14, "CHN": 10 } }
};

// Cache mémoire — chargé une seule fois, mis à jour depuis Supabase et lu depuis la RAM
let memoryStats = null;
let isSyncedWithSupabase = false;

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
  memoryStats = stats;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn("Impossible de sauvegarder les statistiques dans localStorage", e);
  }
}

function makeKey(rowLabel, colLabel) {
  return `${String(rowLabel || '').trim()}___${String(colLabel || '').trim()}`;
}

// Synchronisation asynchrone des statistiques mondiales depuis Supabase au démarrage
export async function syncGlobalStats() {
  if (isSyncedWithSupabase) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/countrydoku_stats?select=criterion_pair,country_code,count`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return;

    const stats = loadStats();
    for (const row of rows) {
      const pair = row.criterion_pair;
      const code = row.country_code;
      const count = Number(row.count) || 0;
      if (!pair || !code || count <= 0) continue;

      if (!stats[pair]) {
        stats[pair] = { total: 0, countries: {} };
      }
      stats[pair].countries[code] = count;
    }

    // Recalculer les totaux par paire de critères
    for (const pair in stats) {
      let sum = 0;
      for (const c in stats[pair].countries) {
        sum += stats[pair].countries[c];
      }
      stats[pair].total = sum;
    }

    isSyncedWithSupabase = true;
    saveStats(stats);
    console.log(`📊 Statistiques mondiales Supabase synchronisées (${rows.length} enregistrements).`);
  } catch (e) {
    console.warn("Supabase indisponible, utilisation des statistiques locales hors-ligne.", e);
  }
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

  // Envoi asynchrone en arrière-plan vers Supabase (sans bloquer le jeu)
  sendChoiceToSupabase(key, countryCode);
}

async function sendChoiceToSupabase(pairKey, countryCode) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_country_choice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ p_pair: pairKey, p_country: countryCode })
    });
  } catch (e) {
    // Échec silencieux si hors-ligne, aucune interruption de jeu
  }
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
