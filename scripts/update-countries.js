const fs = require('fs');
const https = require('https');

const DATA_FILE = '../data/countries.json';

// Petit script utilitaire pour récupérer des infos d'une API distante (ex: RestCountries)
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } 
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function updateCountriesData() {
  console.log('Lecture du fichier local countries.json...');
  const localData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  
  console.log('Récupération des données depuis l\'API publique (ex: RestCountries)...');
  try {
    const remoteData = await fetchJSON('https://restcountries.com/v3.1/all?fields=cca3,population,area');
    
    let updatedCount = 0;
    
    localData.countries.forEach(country => {
      const remoteMatch = remoteData.find(r => r.cca3 === country.code);
      if (remoteMatch) {
        if (remoteMatch.population && country.population !== remoteMatch.population) {
          country.population = remoteMatch.population;
          updatedCount++;
        }
        if (remoteMatch.area && country.area !== remoteMatch.area) {
          country.area = remoteMatch.area;
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(localData, null, 2));
      console.log(`✅ Mise à jour réussie. ${updatedCount} données modifiées (population/superficie).`);
    } else {
      console.log(`✅ Données déjà à jour, aucune modification requise.`);
    }
  } catch (err) {
    console.error('❌ Erreur lors de la mise à jour des données:', err.message);
  }
}

updateCountriesData();
