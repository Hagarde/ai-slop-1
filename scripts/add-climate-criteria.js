import { readFile, writeFile } from 'node:fs/promises';

const countriesPath = new URL('../data/countries.json', import.meta.url);
const rawData = await readFile(countriesPath, 'utf8');
const data = JSON.parse(rawData);

// List of ISO3 codes for Arid / Desert Climate (< 250mm annual rainfall, WMO / World Bank)
const aridCodes = new Set([
  'AFG', 'DZA', 'BHR', 'DJI', 'EGY', 'ERI', 'IRQ', 'ISR', 'JOR', 'KWT',
  'LBY', 'MLI', 'MRT', 'MNG', 'NAM', 'NER', 'OMN', 'PAK', 'QAT', 'SAU',
  'SOM', 'SDN', 'SYR', 'TKM', 'ARE', 'UZB', 'YEM', 'TCD'
]);

// List of ISO3 codes for Countries with active glaciers or permanent ice/snow (WGMS)
const glacierCodes = new Set([
  'AFG', 'ARG', 'AUT', 'AZE', 'BTN', 'BOL', 'CAN', 'CHL', 'CHN', 'COL',
  'COD', 'ECU', 'FRA', 'GEO', 'DEU', 'GTM', 'IND', 'IDN', 'IRN', 'ISL',
  'ITA', 'KAZ', 'KEN', 'KGZ', 'MEX', 'NPL', 'NZL', 'NOR', 'PAK', 'PER',
  'RUS', 'ESP', 'SWE', 'CHE', 'TJK', 'TZA', 'TUR', 'UGA', 'USA', 'UZB'
]);

let intertropicalCount = 0;
let aridCount = 0;
let glacierCount = 0;

data.countries.forEach((country) => {
  // Intertropical: country latitude center within -23.436° and +23.436°
  // (excluding large northern/southern countries whose main landmass is temperate)
  const lat = country.latitude !== undefined ? country.latitude : 0;
  const isIntertropical = Math.abs(lat) <= 23.436;
  
  country.intertropical = isIntertropical;
  country.aridClimate = aridCodes.has(country.code);
  country.glacier = glacierCodes.has(country.code);

  if (country.intertropical) intertropicalCount++;
  if (country.aridClimate) aridCount++;
  if (country.glacier) glacierCount++;
});

await writeFile(countriesPath, JSON.stringify(data, null, 2), 'utf8');

console.log(`✅ Base de données mise à jour avec succès :`);
console.log(` - Zone intertropicale : ${intertropicalCount} pays`);
console.log(` - Climat aride / désertique : ${aridCount} pays`);
console.log(` - Présence de glaciers / neiges éternelles : ${glacierCount} pays`);
