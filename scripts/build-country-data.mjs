import { readFile, writeFile, mkdir } from 'node:fs/promises';

const readJson = async (path) => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const sourceDocument = await readJson('data-restcountries.json');
const source = sourceDocument.value || sourceDocument;
const legacy = await readJson('legacy-countries.json');
const legacyByCode = new Map(legacy.map((country) => [country.alpha3Code, country]));
const unMembers = source.filter((country) => country.unMember && country.name.common !== 'Vatican City');
const nameByCode = new Map(unMembers.map((country) => [country.cca3, country.translations?.fra?.common || country.name.common]));
const currencyOverrides = {
  FSM: [{ code: 'USD', name: 'United States dollar', symbol: '$' }],
};

const namedColors = {
  black: '#000000', white: '#ffffff', red: '#d21034', blue: '#005eb8', green: '#007a3d',
  yellow: '#ffd100', gold: '#ffd100', orange: '#f58220', brown: '#8b5a2b', purple: '#6a1b9a',
};

function normaliseColor(value) {
  const color = value.trim().toLowerCase();
  if (namedColors[color]) return namedColors[color];
  if (/^#[0-9a-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((char) => char + char).join('')}`;
  return /^#[0-9a-f]{6}$/i.test(color) ? color : null;
}

async function flagColors(cca2) {
  try {
    const response = await fetch(`https://flagcdn.com/${cca2.toLowerCase()}.svg`);
    if (!response.ok) throw new Error(response.statusText);
    const svg = await response.text();
    const colors = [...svg.matchAll(/(?:fill|stop-color)=["']([^"']+)["']/gi)]
      .map((match) => normaliseColor(match[1])).filter(Boolean);
    return [...new Set(colors)].slice(0, 8);
  } catch {
    return [];
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const output = []; let cursor = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const index = cursor++; output[index] = await mapper(items[index]);
    }
  }));
  return output;
}

const countries = await mapWithConcurrency(unMembers, 12, async (country) => {
  const historic = legacyByCode.get(country.cca3);
  const latitude = country.latlng?.[0] ?? 0;
  const currencies = Object.entries(country.currencies || {}).map(([code, value]) => ({ code, name: value.name, symbol: value.symbol || '' }));
  return {
    code: country.cca3,
    iso2: country.cca2,
    name: country.translations?.fra?.common || country.name.common,
    nameEnglish: country.name.common,
    flag: country.flag,
    flagUrl: `https://flagcdn.com/w80/${country.cca2.toLowerCase()}.png`,
    flagColors: await flagColors(country.cca2),
    hemisphere: latitude >= 0 ? 'Nord' : 'Sud',
    latitude,
    region: country.region,
    subregion: country.subregion,
    borders: (country.borders || []).map((code) => ({ code, name: nameByCode.get(code) || code })),
    languages: Object.values(country.languages || {}),
    population: historic?.population ?? null,
    currencies: currencies.length ? currencies : (currencyOverrides[country.cca3] || []),
  };
});

await mkdir('data', { recursive: true });
await writeFile('data/countries.json', `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'REST Countries / mledoze countries (UN membership, frontières, langues, devises) et instantané REST Countries historique (population).',
  count: countries.length,
  countries: countries.sort((a, b) => a.name.localeCompare(b.name, 'fr')),
}, null, 2)}\n`);
console.log(`${countries.length} pays écrits dans data/countries.json`);
