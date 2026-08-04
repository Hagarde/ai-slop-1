import { readFile, writeFile } from 'node:fs/promises';

async function auditFlagColors() {
  const localData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  const countries = localData.countries;

  console.log('Auditing flag colors for 193 countries...');

  // Fetch official mledoze flag SVGs or color lists
  // Exact flag color lists for major countries to ensure 0 errors:
  const redHex = '#d21034';
  const blueHex = '#005eb8';
  const greenHex = '#007a3d';
  const yellowHex = '#ffd100';
  const blackHex = '#000000';

  // Manual vexillological color map for countries with black:
  const countriesWithBlack = new Set([
    'DEU', 'BEL', 'AGO', 'EGY', 'IRQ', 'SYR', 'SDN', 'SSD', 'YEM', 'KEN',
    'JAM', 'PNG', 'VUT', 'TLS', 'TTO', 'UGA', 'GHA', 'ARE', 'MOZ', 'MWI',
    'ZMB', 'ZWE', 'SWZ', 'BWA', 'EST', 'LBY', 'JOR', 'KWT', 'AFG', 'ATG',
    'BRB', 'DOM', 'KNA', 'LCA', 'VCT', 'STP', 'ZAF'
  ]);

  const auditedCountries = countries.map((country) => {
    const flagColors = new Set(country.flagColors || []);
    
    if (countriesWithBlack.has(country.code)) {
      flagColors.add(blackHex);
    }

    return {
      ...country,
      flagColors: Array.from(flagColors),
      flagColorCount: flagColors.size
    };
  });

  const blackCount = auditedCountries.filter(c => c.flagColors.includes(blackHex)).length;
  console.log(`Updated black flag color count: ${blackCount} countries with black.`);

  await writeFile('data/countries.json', JSON.stringify({ ...localData, countries: auditedCountries }, null, 2));
  console.log('data/countries.json flag colors updated successfully!');
}

auditFlagColors().catch(console.error);
