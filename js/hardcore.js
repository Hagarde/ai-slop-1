// js/hardcore.js — Modificateurs globaux pour le Mode Hardcore

// Codes ISO alpha-3 des 19 pays membres souverains du G20
export const G20_CODES = new Set([
  'ZAF', // Afrique du Sud
  'DEU', // Allemagne
  'SAU', // Arabie saoudite
  'ARG', // Argentine
  'AUS', // Australie
  'BRA', // Brésil
  'CAN', // Canada
  'CHN', // Chine
  'KOR', // Corée du Sud
  'USA', // États-Unis
  'FRA', // France
  'IND', // Inde
  'IDN', // Indonésie
  'ITA', // Italie
  'JPN', // Japon
  'MEX', // Mexique
  'GBR', // Royaume-Uni
  'RUS', // Russie
  'TUR'  // Turquie
]);

export const HARDCORE_MODIFIERS = [
  {
    id: 'no_g20',
    icon: '🚫',
    titleFr: 'Bannissement du G20',
    titleEn: 'G20 Ban',
    descFr: 'Les 19 grandes puissances du G20 sont strictement interdites sur la grille !',
    descEn: 'The 19 G20 nation members are strictly forbidden across the entire grid!',
    violationFr: '{country} fait partie du G20',
    violationEn: '{country} is a G20 member state',
    test: (country) => !G20_CODES.has(country.code)
  },
  {
    id: 'pop_under_25m',
    icon: '📉',
    titleFr: 'Petits Poucets (< 25M hab.)',
    titleEn: 'Underdogs (< 25M pop.)',
    descFr: 'Aucun pays de plus de 25 millions d’habitants n’est autorisé sur la grille.',
    descEn: 'No country with more than 25 million inhabitants is allowed.',
    violationFr: '{country} dépasse 25 millions d’habitants ({pop} hab.)',
    violationEn: '{country} exceeds 25 million inhabitants ({pop} pop.)',
    test: (country) => (country.population || 0) < 25000000
  },
  {
    id: 'no_letter_a',
    icon: '🔤',
    titleFr: 'Privé de la lettre "A"',
    titleEn: 'No "A" in Name',
    descFr: 'Le nom du pays ne doit comporter aucune lettre "A" (en français).',
    descEn: 'The country\'s French name must not contain the letter "A".',
    violationFr: 'Le nom de {country} contient la lettre A',
    violationEn: 'The name of {country} contains the letter A',
    test: (country) => !country.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('a')
  },
  {
    id: 'island_only',
    icon: '🏝️',
    titleFr: 'Monde Insulaire',
    titleEn: 'Islands & Archipelagos',
    descFr: 'Seuls les pays insulaires (0 frontière terrestre) sont acceptés.',
    descEn: 'Only island nations (0 land borders) are allowed on the grid.',
    violationFr: '{country} a des frontières terrestres ou est enclavé',
    violationEn: '{country} has land borders or is landlocked',
    test: (country) => (!country.borders || country.borders.length === 0) && !country.landlocked
  },
  {
    id: 'landlocked_only',
    icon: '🏔️',
    titleFr: 'Forteresses Terrestres',
    titleEn: 'Landlocked Nations',
    descFr: 'Seuls les pays enclavés sans aucun littoral océanique ou maritime sont autorisés.',
    descEn: 'Only landlocked countries with no ocean coastline are allowed.',
    violationFr: '{country} possède un accès au littoral',
    violationEn: '{country} is not a landlocked nation',
    test: (country) => !!country.landlocked
  }
];

/**
 * Sélectionne un modificateur aléatoire différent du précédent si possible
 */
export function getRandomHardcoreModifier(currentId = null) {
  const pool = HARDCORE_MODIFIERS.filter(m => m.id !== currentId);
  const candidates = pool.length > 0 ? pool : HARDCORE_MODIFIERS;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

/**
 * Récupère un modificateur par son ID
 */
export function getHardcoreModifierById(id) {
  return HARDCORE_MODIFIERS.find(m => m.id === id) || null;
}
