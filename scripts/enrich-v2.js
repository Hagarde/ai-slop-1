import { readFile, writeFile } from 'node:fs/promises';

async function main() {
  const localData = JSON.parse(await readFile('data/countries.json', 'utf8'));

  const oecdCodes = new Set([
    'AUS', 'AUT', 'BEL', 'CAN', 'CHL', 'COL', 'CRI', 'CZE', 'DNK', 'EST',
    'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'IRL', 'ISR', 'ITA', 'JPN',
    'KOR', 'LVA', 'LTU', 'LUX', 'MEX', 'NLD', 'NZL', 'NOR', 'POL', 'PRT',
    'SVK', 'SVN', 'ESP', 'SWE', 'CHE', 'TUR', 'GBR', 'USA'
  ]);

  const peak4000Codes = new Set([
    'AFG', 'ARG', 'AUT', 'AZE', 'BTN', 'BOL', 'CAN', 'CHL', 'CHN', 'COL',
    'COD', 'DOM', 'ECU', 'ETH', 'FRA', 'GEO', 'GTM', 'IND', 'IDN', 'IRN',
    'ITA', 'KAZ', 'KEN', 'KGZ', 'MEX', 'NPL', 'NZL', 'PAK', 'PNG', 'PER',
    'RUS', 'RWA', 'ESP', 'TJK', 'TZA', 'UGA', 'USA', 'UZB', 'VEN'
  ]);

  // Specific capital names for same-letter matching
  const capitalSameLetterCodes = new Set([
    'DZA', 'AND', 'BRA', 'DJI', 'GTM', 'LUX', 'MEX', 'MCO', 'PAN', 'SMR',
    'SGP', 'TUN', 'STP', 'STV', 'KNA', 'LCA'
  ]);

  // Flags with symbols (stars, crescent, emblem, sun, cross)
  const symbolFlagCodes = new Set([
    'AFG', 'ALB', 'DZA', 'AND', 'AGO', 'ATG', 'ARG', 'ARM', 'AUS', 'AZE',
    'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BLZ', 'BEN', 'BTN', 'BOL', 'BIH',
    'BRA', 'BRN', 'BGR', 'BDI', 'KHM', 'CMR', 'CAN', 'CHL', 'CHN', 'COL',
    'COM', 'COG', 'COD', 'PRK', 'KOR', 'CRI', 'HRV', 'CUB', 'CYP', 'DJI',
    'DMA', 'DOM', 'ECU', 'EGY', 'SLV', 'GNQ', 'ERI', 'ETH', 'FJI', 'GAB',
    'GEO', 'GHA', 'GRD', 'GTM', 'GIN', 'GNB', 'GUY', 'HTI', 'HND', 'IND',
    'IDN', 'IRN', 'IRQ', 'ISR', 'ITA', 'JAM', 'JPN', 'JOR', 'KAZ', 'KEN',
    'KIR', 'KWT', 'KGZ', 'LAO', 'LBN', 'LBR', 'LBY', 'LIE', 'MKD', 'MWI',
    'MYS', 'MDV', 'MLI', 'MHL', 'MRT', 'MUS', 'MEX', 'FSM', 'MDA', 'MNG',
    'MNE', 'MAR', 'MOZ', 'MMR', 'NAM', 'NRU', 'NPL', 'NZL', 'NIC', 'NER',
    'NGA', 'OMN', 'PAK', 'PLW', 'PAN', 'PNG', 'PRY', 'PER', 'PHL', 'PRT',
    'QAT', 'MDA', 'ROU', 'RUS', 'RWA', 'KNA', 'LCA', 'VCT', 'WSM', 'SMR',
    'STP', 'SAU', 'SEN', 'SRB', 'SYC', 'SGP', 'SVK', 'SVN', 'SLB', 'SOM',
    'ZAF', 'SSD', 'ESP', 'LKA', 'SDN', 'SUR', 'SWZ', 'SYR', 'TJK', 'TZA',
    'TLS', 'TGO', 'TON', 'TTO', 'TUN', 'TUR', 'TKM', 'TUV', 'UGA', 'UKR',
    'ARE', 'GBR', 'USA', 'URY', 'UZB', 'VUT', 'VEN', 'VNM', 'YEM', 'ZMB', 'ZWE'
  ]);

  const verticalStripeCodes = new Set([
    'AND', 'BEL', 'BEN', 'CMR', 'TCD', 'CIV', 'FRA', 'GAB', 'GTM', 'GIN',
    'ITA', 'MLI', 'MEX', 'MDA', 'MCO', 'NGA', 'ROU', 'SEN', 'SLE'
  ]);

  const horizontalStripeCodes = new Set([
    'AUT', 'BHS', 'BGD', 'BLR', 'BOL', 'BWA', 'BUL', 'BFA', 'DEU', 'EST',
    'GMB', 'GRC', 'HUN', 'IND', 'IDN', 'IRL', 'ISR', 'LVA', 'LTU', 'LUX',
    'MWI', 'MYS', 'NLD', 'NER', 'PRY', 'POL', 'RUS', 'RWA', 'SLE', 'SVK',
    'SVN', 'ESP', 'SDN', 'SUR', 'SWE', 'TJK', 'THA', 'TGO', 'UGA', 'UKR',
    'ARE', 'URY', 'UZB', 'YEM'
  ]);

  const enriched = localData.countries.map((country) => {
    const flagColors = country.flagColors || [];
    return {
      ...country,
      oecd: oecdCodes.has(country.code),
      peak4000: peak4000Codes.has(country.code),
      symbolOnFlag: symbolFlagCodes.has(country.code),
      flagStripes: verticalStripeCodes.has(country.code) ? 'vertical' : (horizontalStripeCodes.has(country.code) ? 'horizontal' : 'other'),
      flagColorCount: flagColors.length,
      capitalSameLetter: capitalSameLetterCodes.has(country.code),
    };
  });

  await writeFile('data/countries.json', JSON.stringify({ ...localData, countries: enriched }, null, 2));
  console.log('Enriched v2 completed cleanly for', enriched.length, 'countries.');
}

main().catch(console.error);
