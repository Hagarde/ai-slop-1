import { readFile, writeFile } from 'node:fs/promises';

async function fixFlags() {
  const fileData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  let countries = fileData.countries;

  console.log(`=== CORRECTION DES DRAPEAUX SEYCHELLES (SYC) ET MAURICE (MUS) ===\n`);

  let count = 0;
  countries = countries.map(c => {
    if (c.code === 'SYC' || c.code === 'MUS') {
      console.log(`🔧 Fix symbolOnFlag pour ${c.name} (${c.code}): ${c.symbolOnFlag} -> false`);
      c.symbolOnFlag = false;
      count++;
    }
    return c;
  });

  await writeFile('data/countries.json', JSON.stringify({ ...fileData, countries }, null, 2));
  console.log(`\n✅ Données corrigées dans data/countries.json (${count} modification(s)).`);
}

fixFlags().catch(console.error);
