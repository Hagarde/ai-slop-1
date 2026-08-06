import { readFile, writeFile } from 'node:fs/promises';

async function updateFlagsData() {
  const fileData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  let countries = fileData.countries;

  console.log(`=== MISE À JOUR DES CRITÈRES ET DRAPEAUX DE ${countries.length} PAYS ===\n`);

  // 1. Liste précise des pays avec un TRIANGLE (chevron) sur leur drapeau
  const countriesWithTriangle = new Set([
    'JOR', // Jordanie
    'VUT', // Vanuatu
    'ZWE', // Zimbabwe
    'CUB', // Cuba
    'BHS', // Bahamas
    'ERI', // Érythrée
    'MOZ', // Mozambique
    'JAM', // Jamaïque (croix de St-André forme 4 triangles)
    'SDN', // Soudan
    'SSD', // Soudan du Sud
    'CZE', // Tchéquie
    'GUY', // Guyana
    'STP', // São Tomé et Príncipe
    'DJI', // Djibouti
    'COM', // Comores
    'GNQ', // Guinée équatoriale
    'GNB', // Guinée-Bissau
    'TLS', // Timor oriental
    'PHL', // Philippines
    'ATG', // Antigua-et-Barbuda
    'PSE'  // Palestine (si présent)
  ]);

  // 2. Pays dont symbolOnFlag doit être FALSE (drapeaux tricolores/bicolores simples sans armoiries ni symboles)
  const noSymbolFlags = new Set([
    'BEN', // Bénin (bande verte + 2 horizontales)
    'NGA', // Nigeria (vert-blanc-vert)
    'PER', // Pérou (rouge-blanc-rouge)
    'ROU', // Roumanie (bleu-jaune-rouge)
    'TCD', // Tchad (bleu-jaune-rouge)
    'MUS', // Maurice (4 bandes)
    'GAB', // Gabon (3 bandes)
    'IDN', // Indonésie (rouge-blanc)
    'MDG', // Madagascar (blanc + 2 horizontales)
    'FRA', // France
    'ITA', // Italie
    'DEU', // Allemagne
    'NLD', // Pays-Bas
    'BEL', // Belgique
    'IRL', // Irlande
    'CIV', // Côte d'Ivoire
    'GIN', // Guinée
    'MLI', // Mali
    'EST', // Estonie
    'LTU', // Lituanie
    'LVA', // Lettonie
    'LUX', // Luxembourg
    'AUT', // Autriche
    'HUN', // Hongrie
    'UKR', // Ukraine
    'POL', // Pologne
    'MCO', // Monaco
    'ARM', // Arménie
    'BGR', // Bulgarie
    'YEM', // Yémen
    'SLE', // Sierra Leone
    'COL', // Colombie
    'CRD'  // etc.
  ]);

  let fixesCount = 0;

  countries = countries.map(c => {
    let updated = { ...c };

    // Ajout propriété flagTriangle
    const hasTriangle = countriesWithTriangle.has(c.code);
    updated.flagTriangle = hasTriangle;

    // Corrections de flagStripes spécifiquement demandées par l'utilisateur
    if (c.code === 'MCO') {
      console.log(`🔧 Correction flagStripes MCO (Monaco) : vertical -> horizontal`);
      updated.flagStripes = 'horizontal';
      fixesCount++;
    }
    if (c.code === 'MNE') {
      console.log(`🔧 Correction flagStripes MNE (Monténégro) : vertical -> null`);
      updated.flagStripes = null;
      fixesCount++;
    }
    if (c.code === 'STP') {
      console.log(`🔧 Correction flagStripes STP (São Tomé et Príncipe) : vertical -> horizontal`);
      updated.flagStripes = 'horizontal';
      fixesCount++;
    }

    // Corrections de symbolOnFlag pour les drapeaux épurés
    if (noSymbolFlags.has(c.code) && c.symbolOnFlag !== false) {
      console.log(`🔧 Correction symbolOnFlag ${c.name} (${c.code}) : true -> false`);
      updated.symbolOnFlag = false;
      fixesCount++;
    }

    return updated;
  });

  await writeFile('data/countries.json', JSON.stringify({ ...fileData, countries }, null, 2));
  console.log(`\n✅ Données mises à jour dans data/countries.json (${fixesCount} ajustements faits).`);

  // Rapport rapide des 3 nouveaux critères sur la base
  console.log(`\n📌 VERIFICATION DES 3 NOUVEAUX CRITÈRES SUR LES 193 PAYS :`);

  const noRedNoBlue = countries.filter(c => !(c.flagColors || []).includes('#d21034') && !(c.flagColors || []).includes('#005eb8'));
  console.log(`   1. "Drapeau sans rouge ni bleu" : ${noRedNoBlue.length} pays valides`);
  noRedNoBlue.forEach(c => console.log(`      - ${c.name} (${c.code}) : [${c.flagColors.join(', ')}]`));

  const multiWords = countries.filter(c => /[\s-]/.test(c.name));
  console.log(`\n   2. "Nom en plusieurs mots" : ${multiWords.length} pays valides`);
  console.log(`      - Exemples : ${multiWords.slice(0, 10).map(c => c.name).join(', ')}...`);

  const withTriangle = countries.filter(c => c.flagTriangle);
  console.log(`\n   3. "Triangle sur le drapeau" : ${withTriangle.length} pays valides`);
  console.log(`      - Exemples : ${withTriangle.map(c => c.name).join(', ')}`);
}

updateFlagsData().catch(console.error);
