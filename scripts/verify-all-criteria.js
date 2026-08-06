import { readFile, writeFile } from 'node:fs/promises';

async function verifyAll() {
  const localData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  const countries = localData.countries;

  console.log(`=== AUDIT COMPLET DE LA BASE DE DONNÉES DE ${countries.length} PAYS ===\n`);

  // 1. Vérification spécifique USA
  const usa = countries.find(c => c.code === 'USA');
  console.log(`📌 ÉTATS-UNIS (USA) :`);
  console.log(`   - Nom : ${usa.name}`);
  console.log(`   - Hémisphère : ${usa.hemisphere}`);
  console.log(`   - Couleurs officielles du drapeau : ${usa.flagColors.join(', ')} (${usa.flagColors.length} couleurs : Rouge, Blanc, Bleu)`);
  console.log(`   - Nombre de couleurs retenu (flagColorCount) : ${usa.flagColorCount}`);
  console.log(`   - Critère "Drapeau >= 4 couleurs" : ${usa.flagColorCount >= 4 ? 'OUI' : 'NON (Invalide car seulement 3 couleurs : rouge, blanc, bleu)'}\n`);

  // 2. Audit des drapeaux >= 4 couleurs dans toute la base
  const count4Plus = countries.filter(c => (c.flagColorCount || c.flagColors.length) >= 4);
  console.log(`📌 PAYS AVEC 4 COULEURS OU PLUS SUR LE DRAPEAU (${count4Plus.length} pays) :`);
  count4Plus.forEach(c => console.log(`   - ${c.name} (${c.code}): ${c.flagColors.length} couleurs [${c.flagColors.join(', ')}]`));

  // 3. Vérification de la cohérence de tous les champs
  const anomalies = [];

  countries.forEach(c => {
    // Check flagColorCount vs flagColors.length
    if (c.flagColorCount !== c.flagColors.length) {
      anomalies.push(`${c.name} (${c.code}) : flagColorCount=${c.flagColorCount} vs flagColors.length=${c.flagColors.length}`);
    }
    // Check missing fields
    const required = ['code', 'name', 'hemisphere', 'region', 'borders', 'languages', 'currencies', 'area', 'population', 'landlocked', 'equator', 'oecd', 'peak4000', 'symbolOnFlag', 'flagColors', 'capital'];
    required.forEach(field => {
      if (c[field] === undefined || c[field] === null) {
        anomalies.push(`${c.name} (${c.code}) : champ manquant '${field}'`);
      }
    });
  });

  if (anomalies.length === 0) {
    console.log(`\n✅ AUCUNE ANOMALIE DE STRUCTURE DÉTECTÉE SUR LES 193 PAYS.`);
  } else {
    console.log(`\n⚠️ ANOMALIES TROUVÉES (${anomalies.length}) :`);
    anomalies.forEach(a => console.log(`   - ${a}`));
  }
}

verifyAll().catch(console.error);
