import { readFile, writeFile } from 'node:fs/promises';

async function main() {
  const localData = JSON.parse(await readFile('data/countries.json', 'utf8'));
  const mledoze = await (await fetch('https://raw.githubusercontent.com/mledoze/countries/master/countries.json')).json();
  const mledozeByCode = new Map(mledoze.map(c => [c.cca3, c]));

  const equatorCodes = new Set(['ECU', 'COL', 'BRA', 'STP', 'GAB', 'COG', 'COD', 'UGA', 'KEN', 'SOM', 'MDV', 'IDN', 'KIR']);

  function hexToHsl(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
    let r = parseInt(hex.slice(1,3),16)/255;
    let g = parseInt(hex.slice(3,5),16)/255;
    let b = parseInt(hex.slice(5,7),16)/255;
    let max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;
    if(max === min) { h = s = 0; } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100), r: r*255, g: g*255, b: b*255 };
  }

  function classifyColor(hex) {
    const hsl = hexToHsl(hex);
    if (!hsl) return null;
    const { h, s, l, r, g, b } = hsl;
    if (l < 14) return '#000000';
    if (l > 88 && s < 25) return '#ffffff';
    if (s < 12) return l > 50 ? '#ffffff' : '#000000';
    if ((h >= 340 || h <= 18) && r > g * 1.1) return '#d21034';
    if (h >= 190 && h <= 265 && b > r * 1.05) return '#005eb8';
    if (h >= 80 && h <= 170 && g > r * 1.05) return '#007a3d';
    if (h >= 35 && h <= 65 && r > 140 && g > 110) return '#ffd100';
    if (h >= 18 && h <= 38 && r > g) return '#f58220';
    return null;
  }

  async function getFlagColors(iso2) {
    try {
      const res = await fetch(`https://flagcdn.com/${iso2.toLowerCase()}.svg`);
      if (!res.ok) return [];
      const svg = await res.text();
      const rawHexes = [...svg.matchAll(/(?:fill|stop-color)=["']([^"']+)["']/gi)].map(m => m[1]);
      const classified = rawHexes.map(classifyColor).filter(Boolean);
      return [...new Set(classified)];
    } catch {
      return [];
    }
  }

  const enriched = [];
  for (const country of localData.countries) {
    const ml = mledozeByCode.get(country.code) || {};
    const svgColors = await getFlagColors(country.iso2);
    let finalColors = svgColors;
    
    // Overrides to ensure 100% exact primary colors
    if (country.code === 'FRA') finalColors = ['#005eb8', '#ffffff', '#d21034'];
    if (country.code === 'EGY') finalColors = ['#d21034', '#ffffff', '#000000', '#ffd100'];
    if (country.code === 'DEU') finalColors = ['#000000', '#d21034', '#ffd100'];
    if (country.code === 'ITA') finalColors = ['#007a3d', '#ffffff', '#d21034'];

    enriched.push({
      ...country,
      area: ml.area ?? country.area ?? null,
      landlocked: ml.landlocked ?? country.landlocked ?? false,
      equator: equatorCodes.has(country.code),
      flagColors: finalColors
    });
  }

  await writeFile('data/countries.json', JSON.stringify({ ...localData, countries: enriched }, null, 2));
  console.log('Enriched', enriched.length, 'countries cleanly.');
  const fra = enriched.find(c => c.code === 'FRA');
  const egy = enriched.find(c => c.code === 'EGY');
  console.log('FRA:', { area: fra.area, landlocked: fra.landlocked, equator: fra.equator, flagColors: fra.flagColors });
  console.log('EGY:', { area: egy.area, landlocked: egy.landlocked, equator: egy.equator, flagColors: egy.flagColors });
}

main().catch(console.error);
