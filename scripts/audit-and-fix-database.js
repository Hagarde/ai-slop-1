import { readFile, writeFile } from 'node:fs/promises';

const TRANSCONTINENTAL = {
  RUS: ['Europe', 'Asia'],
  TUR: ['Europe', 'Asia'],
  KAZ: ['Asia', 'Europe'],
  EGY: ['Africa', 'Asia'],
  GEO: ['Asia', 'Europe'],
  AZE: ['Asia', 'Europe'],
  ARM: ['Asia', 'Europe'],
  CYP: ['Asia', 'Europe'],
};

function inRegion(country, targetRegion) {
  if (country.region === targetRegion) return true;
  const extra = TRANSCONTINENTAL[country.code];
  return extra ? extra.includes(targetRegion) : false;
}

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function runAuditAndFix() {
  const fileData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  let countries = fileData.countries;

  console.log(`=== AUDIT & REPARATION DE LA BASE DE DONNÉES (${countries.length} PAYS) ===\n`);

  let fixesCount = 0;

  countries = countries.map(c => {
    let updated = { ...c };

    // Fix 1: Sync flagColorCount with flagColors.length
    const actualColorsCount = (c.flagColors || []).length;
    if (c.flagColorCount !== actualColorsCount) {
      console.log(`🔧 Fix flagColorCount pour ${c.name} (${c.code}): ${c.flagColorCount} -> ${actualColorsCount}`);
      updated.flagColorCount = actualColorsCount;
      fixesCount++;
    }

    return updated;
  });

  // Save fixed countries.json
  await writeFile('data/countries.json', JSON.stringify({ ...fileData, countries }, null, 2));
  console.log(`\n✅ ${fixesCount} correction(s) enregistrée(s) dans data/countries.json.`);

  // Audit USA specifically for user feedback
  const usa = countries.find(c => c.code === 'USA');
  console.log(`\n📌 VERIFICATION DETAILLEE DU DRAPEAU AMERICAIN (USA) :`);
  console.log(`   - Nom : ${usa.name}`);
  console.log(`   - Hex des couleurs : ${usa.flagColors.join(', ')}`);
  console.log(`   - Traduction des couleurs : Red (#d21034), White (#ffffff), Blue (#005eb8)`);
  console.log(`   - Nombre de couleurs officielles : ${usa.flagColors.length}`);
  console.log(`   - Test "Drapeau avec au moins 4 couleurs" (>= 4) : ${usa.flagColors.length >= 4 ? 'VALIDE' : 'REJETE (Invalide : le drapeau américain a 3 couleurs)'}`);

  // Test every criterion across all countries
  const hasLanguage = (language) => (country) => country.languages.some((value) => fold(value) === fold(language));
  const hasCurrencyCode = (code) => (country) => country.currencies.some((item) => item.code === code);
  const hasCurrencyName = (namePart) => (country) => country.currencies.some((item) => fold(item.name).includes(fold(namePart)));
  const hasColor = (hex) => (country) => (country.flagColors || []).includes(hex);

  function criterion(label, type, description, test) { return { label, type, description, test }; }

  const criteria = [
    criterion('Dans l’hémisphère Nord', 'geography', '', (c) => c.hemisphere === 'Nord'),
    criterion('Dans l’hémisphère Sud', 'geography', '', (c) => c.hemisphere === 'Sud'),
    criterion('En Afrique', 'geography', '', (c) => inRegion(c, 'Africa')),
    criterion('En Europe', 'geography', '', (c) => inRegion(c, 'Europe')),
    criterion('En Asie', 'geography', '', (c) => inRegion(c, 'Asia')),
    criterion('En Amérique', 'geography', '', (c) => inRegion(c, 'Americas')),
    criterion('En Océanie', 'geography', '', (c) => inRegion(c, 'Oceania')),
    criterion('Pays enclavé (sans mer)', 'geography', '', (c) => c.landlocked === true),
    criterion('Possède un accès à la mer', 'geography', '', (c) => c.landlocked === false),
    criterion('Traversé par l’Équateur', 'geography', '', (c) => c.equator === true),
    criterion('Présence de sommets > 4 000 m', 'geography', '', (c) => c.peak4000 === true),
    criterion('Au moins 3 pays frontaliers', 'geography', '', (c) => c.borders.length >= 3),
    criterion('Sans frontière terrestre', 'geography', '', (c) => c.borders.length === 0),
    criterion('Superficie > 1 000 000 km²', 'economy', '', (c) => (c.area || 0) >= 1_000_000),
    criterion('Superficie < 50 000 km²', 'economy', '', (c) => (c.area || 0) > 0 && (c.area || 0) < 50_000),
    criterion('Plus de 100M d’habitants', 'economy', '', (c) => c.population >= 100_000_000),
    criterion('Entre 10M et 100M d’habitants', 'economy', '', (c) => c.population >= 10_000_000 && c.population < 100_000_000),
    criterion('Moins de 10M d’habitants', 'economy', '', (c) => c.population > 0 && c.population < 10_000_000),
    criterion('Membre de l’OCDE', 'economy', '', (c) => c.oecd === true),
    criterion('Non-membre de l’OCDE', 'economy', '', (c) => c.oecd === false),
    criterion('Devise : Euro (€)', 'economy', '', hasCurrencyCode('EUR')),
    criterion('Devise : Dollar ($)', 'economy', '', hasCurrencyName('dollar')),
    criterion('Devise : Franc', 'economy', '', hasCurrencyName('franc')),
    criterion('Devise : Dinar', 'economy', '', hasCurrencyName('dinar')),
    criterion('Devise : Roupie', 'economy', '', hasCurrencyName('rupee')),
    criterion('Au moins 2 langues officielles', 'language', '', (c) => c.languages.length >= 2),
    criterion('Capitale même initiale que le pays', 'language', '', (c) => c.capitalSameLetter === true),
    criterion('Langue : l’anglais', 'language', '', hasLanguage('English')),
    criterion('Langue : le français', 'language', '', hasLanguage('French')),
    criterion('Langue : l’espagnol', 'language', '', hasLanguage('Spanish')),
    criterion('Langue : l’arabe', 'language', '', hasLanguage('Arabic')),
    criterion('Langue : le portugais', 'language', '', hasLanguage('Portuguese')),
    criterion('Langue : le russe', 'language', '', hasLanguage('Russian')),
    criterion('Langue : le chinois', 'language', '', hasLanguage('Chinese')),
    criterion('Symbole sur le drapeau', 'history', '', (c) => c.symbolOnFlag === true),
    criterion('Drapeau à bandes verticales', 'history', '', (c) => c.flagStripes === 'vertical'),
    criterion('Drapeau à bandes horizontales', 'history', '', (c) => c.flagStripes === 'horizontal'),
    criterion('Drapeau avec au moins 4 couleurs', 'history', '', (c) => (c.flagColorCount || 0) >= 4),
    criterion('Drapeau avec du rouge', 'history', '', hasColor('#d21034')),
    criterion('Drapeau avec du bleu', 'history', '', hasColor('#005eb8')),
    criterion('Drapeau avec du vert', 'history', '', hasColor('#007a3d')),
    criterion('Drapeau avec du jaune / or', 'history', '', hasColor('#ffd100')),
    criterion('Drapeau avec du noir', 'history', '', hasColor('#000000')),
    criterion('Nom en 5 lettres ou moins', 'history', '', (c) => c.name.length <= 5),
    criterion('Nom se terminant par -ia ou -ie', 'history', '', (c) => /i[ae]$/i.test(c.name)),
  ];

  console.log(`\n📌 RESULTAT DES CRITERES SUR LA BASE (Min 5 pays requis par critere) :`);
  let validCriteriaCount = 0;
  criteria.forEach(crit => {
    const matching = countries.filter(crit.test);
    const isValid = matching.length >= 5;
    if (isValid) validCriteriaCount++;
    console.log(`   ${isValid ? '✅' : '❌'} ${crit.label.padEnd(35)} : ${matching.length} pays valides`);
  });

  console.log(`\nTotal criteres valides : ${validCriteriaCount} / ${criteria.length}`);
}

runAuditAndFix().catch(console.error);
