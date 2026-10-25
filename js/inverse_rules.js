// Mode Fil Rouge — bibliothèque de critères et utilitaires bitset.
//
// Un « critère » est une règle vérifiable sur un pays. Le mode inverse ne
// compare jamais la saisie du joueur à une solution prévue : il vérifie
// uniquement que TOUS les pays affichés satisfont le critère.

import { allCriteria, countries } from './data.js';
import { getLanguage } from './i18n.js';
import { fold } from './utils.js';

export const RULE_TYPES = {
  geography: { icon: '🌍', fr: 'Géographie', en: 'Geography' },
  economy: { icon: '📊', fr: 'Économie', en: 'Economy' },
  linguistic: { icon: '🗣️', fr: 'Langues', en: 'Languages' },
  flag: { icon: '🏴', fr: 'Drapeau', en: 'Flag' },
  history: { icon: '🏛️', fr: 'Histoire', en: 'History' },
};

// Ces critères dépendent du nom français : en anglais, l'ensemble change.
// Ils sont volontairement exclus du mode pour garantir un pool bilingue stable.
const LOCALE_DEPENDENT_LABELS = new Set([
  'Capitale même initiale que le pays',
  'Nom en 5 lettres ou moins',
  'Nom se terminant par -ia ou -ie',
  'Nom composé (plusieurs mots)',
]);

// Alias de recherche ajoutés aux libellés/descriptions.
const EXTRA_ALIASES = [
  { match: 'hémisphère Nord', aliases: ['nord', 'north', 'hemisphere'] },
  { match: 'hémisphère Sud', aliases: ['sud', 'south', 'hemisphere'] },
  { match: 'Pays enclavé', aliases: ['sans mer', 'landlock', 'enclave'] },
  { match: 'accès à la mer', aliases: ['mer', 'littoral', 'coast', 'sea'] },
  { match: 'sans frontière terrestre', aliases: ['ile', 'île', 'island', 'insulaire'] },
  { match: 'sommets > 4 000', aliases: ['montagne', 'peak', '4000', 'altitude'] },
  { match: 'Devise : Euro', aliases: ['monnaie', 'currency', 'euro'] },
  { match: 'Devise : Dollar', aliases: ['monnaie', 'currency', 'dollar'] },
  { match: 'Devise : Franc', aliases: ['monnaie', 'currency', 'franc'] },
  { match: 'Devise : Dinar', aliases: ['monnaie', 'currency', 'dinar', 'roupie'] },
  { match: 'OCDE', aliases: ['oecd'] },
  { match: 'nucléaire', aliases: ['nuclear', 'atome', 'centrale'] },
  { match: 'Union monétaire', aliases: ['monnaie', 'currency', 'zone euro', 'franc cfa'] },
  { match: 'conduite à gauche', aliases: ['gauche', 'left', 'drive'] },
  { match: 'zone intertropicale', aliases: ['tropique', 'tropical', 'equateur'] },
  { match: 'Climat aride', aliases: ['desert', 'désert', 'arid', 'secheresse'] },
  { match: 'glaciers', aliases: ['glacier', 'neige', 'montagne'] },
  { match: 'bandes verticales', aliases: ['rayures', 'stripe', 'vertical'] },
  { match: 'bandes horizontales', aliases: ['rayures', 'stripe', 'horizontal'] },
  { match: 'Étoile', aliases: ['star', 'etoile'] },
  { match: 'Croissant', aliases: ['lune', 'crescent', 'moon'] },
  { match: 'triangle', aliases: ['triangle'] },
  { match: 'croix', aliases: ['cross'] },
  { match: 'colonie britannique', aliases: ['royaume-uni', 'british', 'uk'] },
  { match: 'colonie française', aliases: ['france', 'french'] },
  { match: 'colonie espagnole', aliases: ['espagne', 'spanish'] },
  { match: 'Empire ottoman', aliases: ['ottoman', 'turquie'] },
  { match: 'Empire romain', aliases: ['rome', 'roman'] },
  { match: 'Empire mongol', aliases: ['mongol'] },
  { match: 'Empire perse', aliases: ['perse', 'persan', 'iran'] },
  { match: 'Empire russe', aliases: ['urss', 'soviet', 'russie'] },
  { match: 'austro-hongrois', aliases: ['autriche', 'hongrie', 'habsbourg'] },
  { match: 'Empire inca', aliases: ['inca', 'perou'] },
  { match: 'Empire éthiopien', aliases: ['ethiopie', 'aksum'] },
  { match: 'Empire chinois', aliases: ['chine', 'qing'] },
  { match: 'État fédéral', aliases: ['federation', 'federal'] },
  { match: 'indépendant en 1990', aliases: ['independance', '1990', 'urss'] },
  { match: 'Au moins 3 pays frontaliers', aliases: ['voisins', 'frontiere', 'borders'] },
  { match: 'Plus de 100M', aliases: ['population', 'habitants', 'demographie'] },
  { match: 'Entre 10M et 100M', aliases: ['population', 'habitants', 'demographie'] },
  { match: 'Moins de 10M', aliases: ['population', 'habitants', 'demographie'] },
  { match: 'Superficie >', aliases: ['surface', 'area', 'grand'] },
  { match: 'Superficie <', aliases: ['surface', 'area', 'petit'] },
];

function aliasesFor(labelFr, labelEn, descriptionFr, descriptionEn) {
  const result = new Set();
  [labelFr, labelEn, descriptionFr, descriptionEn].forEach((text) => {
    if (!text) return;
    result.add(fold(text));
  });
  for (const entry of EXTRA_ALIASES) {
    if (labelFr.includes(entry.match)) {
      entry.aliases.forEach((alias) => result.add(fold(alias)));
    }
  }
  return [...result];
}

export function buildRuleLibrary(countryList = countries, criteriaList = allCriteria) {
  const rules = [];
  const seenSets = new Set();
  const indexByCode = new Map();
  countryList.forEach((country, index) => indexByCode.set(country.code, index));

  criteriaList.forEach((criterion, index) => {
    if (LOCALE_DEPENDENT_LABELS.has(criterion.labelFr)) return;

    const codes = [];
    for (const country of countryList) {
      try {
        if (criterion.test(country)) codes.push(country.code);
      } catch (error) {
        // Une donnée manquante ne doit jamais casser le mode.
      }
    }
    if (codes.length < 1) return;

    const setKey = [...codes].sort().join(',');
    if (seenSets.has(setKey)) return;
    seenSets.add(setKey);

    const set = new Set(codes);
    const rule = {
      id: `rule_${index}`,
      index,
      labelFr: criterion.labelFr,
      labelEn: criterion.labelEn,
      descriptionFr: criterion.descriptionFr,
      descriptionEn: criterion.descriptionEn,
      type: criterion.type || 'geography',
      icon: criterion.icon || RULE_TYPES[criterion.type]?.icon || '🌍',
      set,
      codes,
      size: codes.length,
      aliases: aliasesFor(criterion.labelFr, criterion.labelEn, criterion.descriptionFr, criterion.descriptionEn),
      obscure: criterion.type === 'history' && (
        criterion.labelFr.includes('Empire') ||
        criterion.labelFr.includes('Territoire de l')
      ),
      localeDependent: false,
    };
    rules.push(rule);
  });

  return { rules, indexByCode, countryCount: countryList.length };
}

export function getRuleLabel(rule) {
  if (!rule) return '';
  return getLanguage() === 'en' ? (rule.labelEn || rule.labelFr) : rule.labelFr;
}

export function getRuleDescription(rule) {
  if (!rule) return '';
  return getLanguage() === 'en' ? (rule.descriptionEn || rule.descriptionFr) : rule.descriptionFr;
}

export function getTypeLabel(type) {
  const info = RULE_TYPES[type] || RULE_TYPES.geography;
  return getLanguage() === 'en' ? info.en : info.fr;
}

export function getTypeIcon(type) {
  return (RULE_TYPES[type] || RULE_TYPES.geography).icon;
}

// Recherche tolérante (accents, casse, alias, mots partiels).
export function searchRules(rules, rawQuery, limit = 8) {
  const query = fold((rawQuery || '').trim());
  if (!query) return [];
  const tokens = query.split(/[^a-z0-9]+/).filter(Boolean);
  const scored = [];

  for (const rule of rules) {
    const label = fold(getRuleLabel(rule));
    const labelWords = label.split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0;

    if (label === query) score = 100;
    else if (label.startsWith(query)) score = 80;
    else if (labelWords.some((word) => word.startsWith(query))) score = 65;
    else if (rule.aliases.some((alias) => alias === query)) score = 60;
    else if (rule.aliases.some((alias) => alias.startsWith(query))) score = 45;
    else if (label.includes(query)) score = 35;
    else if (rule.aliases.some((alias) => alias.includes(query))) score = 25;
    else if (tokens.length > 1 && tokens.every((token) => rule.aliases.some((alias) => alias.includes(token)))) score = 20;

    if (score > 0) scored.push({ rule, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return getRuleLabel(a.rule).localeCompare(getRuleLabel(b.rule), getLanguage() === 'en' ? 'en' : 'fr');
  });
  return scored.slice(0, limit).map((item) => item.rule);
}

// --- Bitsets -----------------------------------------------------------------
// 193 pays = 7 mots de 32 bits. Les opérations d'intersection sont en O(7).

export function createMask(words) {
  return new Uint32Array(words);
}

export function maskFromRule(rule, words, indexByCode) {
  const mask = createMask(words);
  for (const code of rule.codes) {
    const index = indexByCode.get(code);
    if (index === undefined) continue;
    mask[index >>> 5] |= (1 << (index & 31));
  }
  return mask;
}

export function maskAnd(a, b, out = new Uint32Array(a.length)) {
  for (let i = 0; i < a.length; i++) out[i] = a[i] & b[i];
  return out;
}

export function maskCount(mask) {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    let value = mask[i];
    value = value - ((value >>> 1) & 0x55555555);
    value = (value & 0x33333333) + ((value >>> 2) & 0x33333333);
    value = (value + (value >>> 4)) & 0x0f0f0f0f;
    count += (value * 0x01010101) >>> 24;
  }
  return count;
}

export function maskHas(mask, index) {
  return (mask[index >>> 5] & (1 << (index & 31))) !== 0;
}

export function maskToCodes(mask, countryList) {
  const codes = [];
  for (let index = 0; index < countryList.length; index++) {
    if (maskHas(mask, index)) codes.push(countryList[index].code);
  }
  return codes;
}

export function maskKey(mask) {
  let key = '';
  for (let i = 0; i < mask.length; i++) {
    key += mask[i].toString(36) + '.';
  }
  return key;
}

export function allCountriesMask(words, count) {
  const mask = createMask(words);
  for (let index = 0; index < count; index++) {
    mask[index >>> 5] |= (1 << (index & 31));
  }
  return mask;
}
