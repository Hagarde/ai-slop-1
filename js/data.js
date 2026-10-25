import { buildCriteria } from './criteria.js';
import { fold } from './utils.js';

export let countries = [];
export let allCriteria = [];

// O-04 FIX: Pré-calcul des noms "folded" (sans accents, minuscules) au chargement

// Index pré-calculé pour la recherche rapide
export let countriesSearchIndex = [];

// D-04 FIX: Aliases manquants pour noms courants
export const aliases = {
  USA: ['USA', 'US', 'Etats-Unis', 'United States'],
  GBR: ['UK', 'Royaume-Uni', 'United Kingdom', 'Angleterre', 'Grande-Bretagne'],
  ARE: ['UAE', 'EAU', 'Emirats', 'Emirats arabes unis'],
  COD: ['RDC', 'Congo Kinshasa', 'DRC'],
  COG: ['Congo Brazzaville'],
  CAF: ['RCA', 'Centrafrique'],
  NLD: ['Hollande', 'Pays-Bas'],
  CZE: ['Tchequie', 'Republique Tcheque'],
  KOR: ['Coree du Sud', 'South Korea'],
  PRK: ['Coree du Nord', 'North Korea'],
  KNA: ['Saint Kitts', 'Saint-Kitts-et-Nevis'],
  VCT: ['Saint Vincent', 'Saint-Vincent-et-les-Grenadines'],
  STP: ['Sao Tome', 'Sao Tome et Principe'],
  MMR: ['Birmanie', 'Burma', 'Myanmar'],
  SWZ: ['Swaziland'],
  MKD: ['Macedoine', 'Macédoine', 'FYROM'],
  CPV: ['Cap-Vert', 'Cap Vert', 'Cabo Verde'],
  TLS: ['Timor Oriental', 'East Timor'],
  NPL: ['Nepal'],
  LKA: ['Sri Lanka', 'Ceylan'],
  IRN: ['Perse', 'Persia'],
  THA: ['Thailande', 'Siam'],
  ETH: ['Ethiopie', 'Abyssinie'],
  CIV: ["Cote d'Ivoire", 'Ivory Coast'],
  BIH: ['Bosnie', 'Bosnie-Herzegovine'],
  TTO: ['Trinidad', 'Trinite-et-Tobago'],
};

export async function loadData() {
  try {
    const response = await fetch('data/countries.json');
    if (!response.ok) throw new Error('Erreur de réseau lors du chargement des données');
    const data = await response.json();
    countries = data.countries;
    allCriteria = buildCriteria(countries);

    // O-04: Pré-calculer l'index de recherche pour éviter fold() à chaque frappe
    countriesSearchIndex = countries.map(country => ({
      code: country.code,
      nameFr: fold(country.name),
      nameEn: fold(country.nameEnglish),
      aliasesFolded: (aliases[country.code] || []).map(fold),
    }));

    // Index O(1) par code ISO (remplace les .find() en boucle)
    countryByCode.clear();
    for (const country of countries) {
      if (country && country.code) countryByCode.set(country.code, country);
    }

    return true;
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    return false;
  }
}

const countryByCode = new Map();

export function getCountryByCode(code) {
  if (countryByCode.has(code)) return countryByCode.get(code);
  return countries.find(c => c.code === code);
}
