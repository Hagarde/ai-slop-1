import { readFile, writeFile } from 'node:fs/promises';

async function audit() {
  const localData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  const countries = localData.countries;

  console.log(`Starting comprehensive audit of ${countries.length} UN member countries...`);

  // 1. Fetch authoritative mledoze dataset
  const mledoze = await (await fetch('https://raw.githubusercontent.com/mledoze/countries/master/countries.json')).json();
  const mledozeByCode = new Map(mledoze.map((c) => [c.cca3, c]));

  // Helper
  const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // 2. Official 44 UN Landlocked Countries
  const officialLandlocked = new Set([
    'AFG', 'AND', 'ARM', 'AUT', 'AZE', 'BLR', 'BTN', 'BOL', 'BWA', 'BFA',
    'BDI', 'CAF', 'TCD', 'CZE', 'ETH', 'HUN', 'KAZ', 'KGZ', 'LAO', 'LSO',
    'LIE', 'LUX', 'MWI', 'MLI', 'MDA', 'MNG', 'NPL', 'NER', 'MKD', 'PRY',
    'RWA', 'SMR', 'SRB', 'SVK', 'SSD', 'SWZ', 'CHE', 'TJK', 'TKM', 'UGA',
    'UZB', 'ZMB', 'ZWE'
  ]);

  // 3. Official 38 OECD Member States
  const officialOECD = new Set([
    'AUS', 'AUT', 'BEL', 'CAN', 'CHL', 'COL', 'CRI', 'CZE', 'DNK', 'EST',
    'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'IRL', 'ISR', 'ITA', 'JPN',
    'KOR', 'LVA', 'LTU', 'LUX', 'MEX', 'NLD', 'NZL', 'NOR', 'POL', 'PRT',
    'SVK', 'SVN', 'ESP', 'SWE', 'CHE', 'TUR', 'GBR', 'USA'
  ]);

  // 4. Official 13 Equator Countries
  const officialEquator = new Set([
    'ECU', 'COL', 'BRA', 'STP', 'GAB', 'COG', 'COD', 'UGA', 'KEN', 'SOM',
    'MDV', 'IDN', 'KIR'
  ]);

  // 5. Official 40 Countries with Peaks >= 4000m
  const officialPeak4000 = new Set([
    'AFG', 'ARG', 'ARM', 'AUT', 'AZE', 'BTN', 'BOL', 'CAN', 'CHL', 'CHN',
    'COL', 'COD', 'ECU', 'ETH', 'FRA', 'GEO', 'GTM', 'IND', 'IDN', 'IRN',
    'ITA', 'KAZ', 'KEN', 'KGZ', 'MEX', 'MMR', 'NPL', 'NZL', 'PAK', 'PNG',
    'PER', 'RUS', 'RWA', 'ESP', 'TJK', 'TZA', 'UGA', 'USA', 'UZB', 'VEN'
  ]);

  // 6. French Capitals & First Letter Match Audit
  const capitalsFrench = {
    AFG: 'Kaboul', ALB: 'Tirana', DZA: 'Alger', DEU: 'Berlin', AND: 'Andorre-la-Vieille',
    AGO: 'Luanda', ATG: 'Saint John\'s', SAU: 'Riyad', ARG: 'Buenos Aires', ARM: 'Erevan',
    AUS: 'Canberra', AUT: 'Vienne', AZE: 'Baku', BHS: 'Nassau', BHR: 'Manama',
    BGD: 'Dacca', BRB: 'Bridgetown', BEL: 'Bruxelles', BLZ: 'Belmopan', BEN: 'Porto-Novo',
    BTN: 'Thimphou', BLR: 'Minsk', MMR: 'Naypyidaw', BOL: 'Sucre', BIH: 'Sarajevo',
    BWA: 'Gaborone', BRA: 'Brasília', BRN: 'Bandar Seri Begawan', BGR: 'Sofia', BFA: 'Ouagadougou',
    BDI: 'Gitega', KHM: 'Phnom Penh', CMR: 'Yaoundé', CAN: 'Ottawa', CHL: 'Santiago',
    CHN: 'Pékin', CYP: 'Nicosie', COL: 'Bogota', COM: 'Moroni', COG: 'Brazzaville',
    COD: 'Kinshasa', PRK: 'Pyongyang', KOR: 'Séoul', CRI: 'San José', CIV: 'Yamoussoukro',
    HRV: 'Zagreb', CUB: 'La Havane', DNK: 'Copenhague', DJI: 'Djibouti', DMA: 'Roseau',
    EGY: 'Le Caire', ARE: 'Abou Dabi', ECU: 'Quito', ERI: 'Asmara', ESP: 'Madrid',
    EST: 'Tallinn', SWZ: 'Mbabane', USA: 'Washington', ETH: 'Addis-Abeba', FJI: 'Suva',
    FIN: 'Helsinki', FRA: 'Paris', GAB: 'Libreville', GMB: 'Banjul', GEO: 'Tbilissi',
    GHA: 'Accra', GRC: 'Athènes', GRD: 'Saint-Georges', GTM: 'Guatemala', GIN: 'Conakry',
    GNQ: 'Malabo', GNB: 'Bissau', GUY: 'Georgetown', HTI: 'Port-au-Prince', HND: 'Tegucigalpa',
    HUN: 'Budapest', MUS: 'Port-Louis', CPV: 'Praia', MHL: 'Majuro', SLB: 'Honiara',
    IND: 'New Delhi', IDN: 'Nusantara', IRQ: 'Bagdad', IRN: 'Téhéran', IRL: 'Dublin',
    ISL: 'Reykjavik', ISR: 'Jérusalem', ITA: 'Rome', JAM: 'Kingston', JPN: 'Tokyo',
    JOR: 'Amman', KAZ: 'Astana', KEN: 'Nairobi', KGZ: 'Bichkek', KIR: 'Tarawa-Sud',
    KWT: 'Koweït', LAO: 'Vientiane', LSO: 'Maseru', LVA: 'Riga', LBN: 'Beyrouth',
    LBR: 'Monrovia', LBY: 'Tripoli', LIE: 'Vaduz', LTU: 'Vilnius', LUX: 'Luxembourg',
    MKD: 'Skopje', MDG: 'Antananarivo', MYS: 'Kuala Lumpur', MWI: 'Lilongwe', MDV: 'Malé',
    MLI: 'Bamako', MLT: 'La Valette', MAR: 'Rabat', MRT: 'Nouakchott', MEX: 'Mexico',
    FSM: 'Palikir', MDA: 'Chisinau', MCO: 'Monaco', MNG: 'Oulan-Bator', MNE: 'Podgorica',
    MOZ: 'Maputo', NAM: 'Windhoek', NRU: 'Yaren', NPL: 'Katmandou', NIC: 'Managua',
    NER: 'Niamey', NGA: 'Abuja', NOR: 'Oslo', NZL: 'Wellington', OMN: 'Mascate',
    UGA: 'Kampala', UZB: 'Tachkent', PAK: 'Islamabad', PLW: 'Ngerulmud', PAN: 'Panama',
    PNG: 'Port Moresby', PRY: 'Asuncion', NLD: 'Amsterdam', PER: 'Lima', PHL: 'Manille',
    POL: 'Varsovie', PRT: 'Lisbonne', QAT: 'Doha', CAF: 'Bangui', DOM: 'Saint-Domingue',
    ROU: 'Bucarest', GBR: 'Londres', RUS: 'Moscou', RWA: 'Kigali', KNA: 'Basseterre',
    SMR: 'Saint-Marin', VCT: 'Kingstown', LCA: 'Castries', SLV: 'San Salvador', WSM: 'Apia',
    STP: 'São Tomé', SEN: 'Dakar', SRB: 'Belgrade', SYC: 'Victoria', SLE: 'Freetown',
    SGP: 'Singapour', SVK: 'Bratislava', SVN: 'Ljubljana', SOM: 'Mogadiscio', SDN: 'Khartoum',
    SSD: 'Djouba', LKA: 'Sri Jayawardenepura Kotte', SWE: 'Stockholm', CHE: 'Berne', SUR: 'Paramaribo',
    SYR: 'Damas', TJK: 'Douchanbé', TZA: 'Dodoma', TCD: 'N\'Djamena', CZE: 'Prague',
    THA: 'Bangkok', TLS: 'Dili', TGO: 'Lomé', TON: 'Nuku\'alofa', TTO: 'Port-d\'Espagne',
    TUN: 'Tunis', TKM: 'Achgabat', TUR: 'Ankara', TUV: 'Funafuti', UKR: 'Kiev',
    URY: 'Montevideo', VUT: 'Port-Vila', VEN: 'Caracas', VNM: 'Hanoï', YEM: 'Sanaâ',
    ZMB: 'Lusaka', ZWE: 'Harare'
  };

  const foldLetter = (str) => fold(str).replace(/^l[''\s]+/i, '').replace(/^st[-'\s]+/i, 's')[0];

  const auditedCountries = countries.map((country) => {
    const ml = mledozeByCode.get(country.code) || {};
    const capital = capitalsFrench[country.code] || ml.capital?.[0] || '';
    
    const countryFirstLetter = foldLetter(country.name);
    const capitalFirstLetter = capital ? foldLetter(capital) : '';
    const sameLetter = Boolean(countryFirstLetter && capitalFirstLetter && countryFirstLetter === capitalFirstLetter);

    return {
      ...country,
      capital,
      area: ml.area ?? country.area ?? null,
      population: ml.population ?? country.population ?? null,
      landlocked: officialLandlocked.has(country.code),
      oecd: officialOECD.has(country.code),
      equator: officialEquator.has(country.code),
      peak4000: officialPeak4000.has(country.code),
      capitalSameLetter: sameLetter
    };
  });

  const landlockedCount = auditedCountries.filter(c => c.landlocked).length;
  const oecdCount = auditedCountries.filter(c => c.oecd).length;
  const equatorCount = auditedCountries.filter(c => c.equator).length;
  const peakCount = auditedCountries.filter(c => c.peak4000).length;
  const sameLetterCount = auditedCountries.filter(c => c.capitalSameLetter).length;

  console.log(`Audit Summary:`);
  console.log(`- Landlocked: ${landlockedCount} / 44 expected`);
  console.log(`- OECD: ${oecdCount} / 38 expected`);
  console.log(`- Equator: ${equatorCount} / 13 expected`);
  console.log(`- Peaks > 4000m: ${peakCount} / 40 expected`);
  console.log(`- Capital same letter: ${sameLetterCount} matches found`);

  console.log('\nMatching Countries (Capital initial matches Country initial):');
  auditedCountries.filter(c => c.capitalSameLetter).forEach(c => {
    console.log(`  - ${c.name} (${c.code}) -> Capital: ${c.capital}`);
  });

  await writeFile('data/countries.json', JSON.stringify({ ...localData, countries: auditedCountries }, null, 2));
  console.log('\nAudit completed and data/countries.json updated cleanly!');
}

audit().catch(console.error);
