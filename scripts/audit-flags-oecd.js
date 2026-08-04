import { readFile, writeFile } from 'node:fs/promises';

async function auditFlagsAndOECD() {
  const localData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  const countries = localData.countries;

  console.log(`Analyzing OECD and Flag attributes for ${countries.length} UN member states...`);

  // 1. Official 38 OECD Member States (CCA3 ISO Codes)
  const officialOECD = new Set([
    'AUS', 'AUT', 'BEL', 'CAN', 'CHL', 'COL', 'CRI', 'CZE', 'DNK', 'EST',
    'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'IRL', 'ISR', 'ITA', 'JPN',
    'KOR', 'LVA', 'LTU', 'LUX', 'MEX', 'NLD', 'NZL', 'NOR', 'POL', 'PRT',
    'SVK', 'SVN', 'ESP', 'SWE', 'CHE', 'TUR', 'GBR', 'USA'
  ]);

  // 2. Exact Vexillological Vertical Stripes Flags (Motif principal à bandes verticales)
  const verticalStripesFlags = new Set([
    'FRA', 'ITA', 'IRL', 'MLI', 'GIN', 'ROU', 'TCD', 'SEN', 'CIV', 'BEL',
    'MDA', 'AND', 'GTM', 'PER', 'BRB', 'MNE', 'NGA', 'VCT', 'STP', 'CMR',
    'AFG', 'MEX', 'CAN', 'MCO' // MCO: 2 vertical bands / bicolor
  ]);

  // 3. Exact Vexillological Horizontal Stripes Flags (Motif principal à bandes horizontales)
  const horizontalStripesFlags = new Set([
    'DEU', 'ESP', 'NLD', 'AUT', 'RUS', 'BGR', 'HUN', 'EST', 'LVA', 'LTU',
    'LUX', 'COL', 'ECU', 'VEN', 'GAB', 'YEM', 'EGY', 'SYR', 'IRQ', 'NER',
    'SLE', 'ARM', 'BOL', 'UKR', 'POL', 'IDN', 'THA', 'CRC', 'ARG', 'PRY',
    'URY', 'CUB', 'GHA', 'BEN', 'BFA', 'TGO', 'MWI', 'ETH', 'SSD', 'SDN',
    'KEN', 'UGA', 'RWA', 'BDI', 'BWA', 'LSO', 'SWZ', 'MOZ', 'GNB', 'SUR',
    'GUY', 'HND', 'NIC', 'SLV', 'PAN', 'LAO', 'KHM', 'MMR', 'MNG', 'UZB',
    'TKM', 'TJK', 'KGZ', 'KAZ', 'AZE', 'GEO', 'JOR', 'ARE', 'OMN', 'KWT'
  ]);

  // 4. Exact Flags WITH a Emblem / Symbol / Coat of Arms / Crescent / Star / Sun / Seal
  // Flag symbol is TRUE if flag contains stars, crescent, emblem, coat of arms, sun, cross, etc.
  const flagWithSymbol = new Set([
    'AFG', 'ALB', 'DZA', 'AND', 'AGO', 'ATG', 'ARG', 'ARM', 'AUS', 'AZE',
    'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BLZ', 'BEN', 'BTN', 'BOL', 'BIH',
    'BRA', 'BRN', 'BGR', 'BFA', 'BDI', 'KHM', 'CMR', 'CAN', 'CPV', 'CAF',
    'TCD', 'CHL', 'CHN', 'COL', 'COM', 'COG', 'COD', 'PRK', 'KOR', 'CRI',
    'HRV', 'CUB', 'CYP', 'CZE', 'DNK', 'DJI', 'DMA', 'DOM', 'ECU', 'EGY',
    'SLV', 'GNQ', 'ERI', 'SWZ', 'ETH', 'FJI', 'FIN', 'GAB', 'GMB', 'GEO',
    'GHA', 'GRC', 'GRD', 'GTM', 'GIN', 'GNB', 'GUY', 'HTI', 'HND', 'IND',
    'IDN', 'IRN', 'IRQ', 'ISR', 'ITA', 'JAM', 'JPN', 'JOR', 'KAZ', 'KEN',
    'KIR', 'KWT', 'KGZ', 'LAO', 'LBN', 'LSO', 'LBR', 'LBY', 'LIE', 'LTU',
    'MKD', 'MDG', 'MWI', 'MYS', 'MDV', 'MLI', 'MLT', 'MHL', 'MRT', 'MUS',
    'MEX', 'FSM', 'MDA', 'MNG', 'MNE', 'MAR', 'MOZ', 'MMR', 'NAM', 'NRU',
    'NPL', 'NZL', 'NIC', 'NER', 'NGA', 'NOR', 'OMN', 'PAK', 'PWL', 'PAN',
    'PNG', 'PRY', 'PER', 'PHL', 'PRT', 'QAT', 'ROU', 'RUS', 'RWA', 'KNA',
    'LCA', 'VCT', 'WSM', 'SMR', 'STP', 'SAU', 'SEN', 'SRB', 'SYC', 'SLE',
    'SGP', 'SVK', 'SVN', 'SLB', 'SOM', 'ZAF', 'SSD', 'ESP', 'LKA', 'SDN',
    'SUR', 'SWE', 'CHE', 'SYR', 'TJK', 'TZA', 'THA', 'TLS', 'TGO', 'TON',
    'TTO', 'TUN', 'TUR', 'TKM', 'TUV', 'UGA', 'ARE', 'GBR', 'USA', 'URY',
    'UZB', 'VUT', 'VEN', 'VNM', 'YEM', 'ZMB', 'ZWE'
  ]);

  let oecdFixes = 0;
  let flagFixes = 0;

  const auditedCountries = countries.map((country) => {
    const isOECD = officialOECD.has(country.code);
    if (country.oecd !== isOECD) {
      console.log(`Fix OECD for ${country.name} (${country.code}): ${country.oecd} -> ${isOECD}`);
      oecdFixes += 1;
    }

    let stripes = null;
    if (verticalStripesFlags.has(country.code)) stripes = 'vertical';
    else if (horizontalStripesFlags.has(country.code)) stripes = 'horizontal';

    const hasSymbol = flagWithSymbol.has(country.code);

    if (country.flagStripes !== stripes || country.symbolOnFlag !== hasSymbol) {
      flagFixes += 1;
    }

    return {
      ...country,
      oecd: isOECD,
      flagStripes: stripes,
      symbolOnFlag: hasSymbol
    };
  });

  console.log(`\nAudit Complete:`);
  console.log(`- OECD Corrections: ${oecdFixes}`);
  console.log(`- Flag Attributes Corrections: ${flagFixes}`);
  console.log(`- Total OECD Members: ${auditedCountries.filter(c => c.oecd).length} / 38 expected`);

  await writeFile('data/countries.json', JSON.stringify({ ...localData, countries: auditedCountries }, null, 2));
  console.log('\ndata/countries.json updated with pristine OECD and flag data!');
}

auditFlagsAndOECD().catch(console.error);
