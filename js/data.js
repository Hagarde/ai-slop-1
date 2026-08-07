import { buildCriteria } from './criteria.js';

export let countries = [];
export let allCriteria = [];

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
};

export async function loadData() {
  try {
    const response = await fetch('data/countries.json');
    if (!response.ok) throw new Error('Erreur de réseau lors du chargement des données');
    const data = await response.json();
    countries = data.countries;
    allCriteria = buildCriteria(countries);
    return true;
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    return false;
  }
}

export function getCountryByCode(code) {
  return countries.find(c => c.code === code);
}
