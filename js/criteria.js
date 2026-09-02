import { getLanguage } from './i18n.js';

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const TRANSCONTINENTAL = {
  RUS: ['Europe', 'Asia'],
  TUR: ['Europe', 'Asia'],
  KAZ: ['Asia', 'Europe'],
  EGY: ['Africa', 'Asia'],
  GEO: ['Asia', 'Europe'],
  AZE: ['Asia', 'Europe'],
  ARM: ['Asia', 'Europe'],
  CYP: ['Asia', 'Europe'],
};

function inRegion(country, targetRegion) {
  if (country.region === targetRegion) return true;
  const extra = TRANSCONTINENTAL[country.code];
  return extra ? extra.includes(targetRegion) : false;
}

function criterion(labelFr, labelEn, type, descriptionFr, descriptionEn, test) {
  return {
    labelFr,
    labelEn,
    descriptionFr,
    descriptionEn,
    type,
    test,
    get label() {
      return getLanguage() === 'en' ? this.labelEn : this.labelFr;
    },
    get description() {
      return getLanguage() === 'en' ? this.descriptionEn : this.descriptionFr;
    }
  };
}

export function buildCriteria(data) {
  const hasLanguage = (language) => (country) => country.languages.some((value) => fold(value) === fold(language));
  const hasCurrencyCode = (code) => (country) => country.currencies.some((item) => item.code === code);
  const hasCurrencyName = (namePart) => (country) => country.currencies.some((item) => fold(item.name).includes(fold(namePart)));
  const hasColor = (hex) => (country) => (country.flagColors || []).includes(hex);

  return [
    criterion(
      'Dans l’hémisphère Nord', 'In the Northern Hemisphere',
      'geography',
      'Le territoire du pays se situe dans l’hémisphère Nord (latitude >= 0).',
      'The country’s territory lies in the Northern Hemisphere (latitude >= 0).',
      (c) => c.hemisphere === 'Nord'
    ),
    criterion(
      'Dans l’hémisphère Sud', 'In the Southern Hemisphere',
      'geography',
      'Le territoire du pays se situe dans l’hémisphère Sud (latitude < 0).',
      'The country’s territory lies in the Southern Hemisphere (latitude < 0).',
      (c) => c.hemisphere === 'Sud'
    ),
    criterion(
      'En Afrique', 'In Africa',
      'geography',
      'Le pays se situe ou s’étend sur le continent africain.',
      'The country is located or extends into the African continent.',
      (c) => inRegion(c, 'Africa')
    ),
    criterion(
      'En Europe', 'In Europe',
      'geography',
      'Le pays se situe ou s’étend en Europe.',
      'The country is located or extends into Europe.',
      (c) => inRegion(c, 'Europe')
    ),
    criterion(
      'En Asie', 'In Asia',
      'geography',
      'Le pays se situe ou s’étend en Asie.',
      'The country is located or extends into Asia.',
      (c) => inRegion(c, 'Asia')
    ),
    criterion(
      'En Amérique', 'In the Americas',
      'geography',
      'Le pays se situe sur le continent américain.',
      'The country is located in the Americas.',
      (c) => inRegion(c, 'Americas')
    ),
    criterion(
      'En Océanie', 'In Oceania',
      'geography',
      'Le pays se situe en Océanie.',
      'The country is located in Oceania.',
      (c) => inRegion(c, 'Oceania')
    ),
    criterion(
      'Pays enclavé (sans mer)', 'Landlocked country',
      'geography',
      'Le pays n’a aucun accès direct à la mer ou à un océan.',
      'The country has no direct access to a sea or ocean.',
      (c) => c.landlocked === true
    ),
    criterion(
      'Possède un accès à la mer', 'Has coastline / access to sea',
      'geography',
      'Le pays possède une côte ou un accès maritime direct.',
      'The country has a coastline or direct maritime access.',
      (c) => c.landlocked === false
    ),
    criterion(
      'Traversé par l’Équateur', 'Crossed by the Equator',
      'geography',
      'La ligne imaginaire de l’Équateur traverse le territoire du pays.',
      'The imaginary line of the Equator crosses the country’s territory.',
      (c) => c.equator === true
    ),
    criterion(
      'Présence de sommets > 4 000 m', 'Peaks over 4,000 m',
      'geography',
      'Le territoire du pays comprend des sommets montagneux dépassant 4 000 mètres d’altitude (ex: France, Népal, Chili...).',
      'The country includes mountain peaks exceeding 4,000 meters in altitude (e.g. France, Nepal, Chile...).',
      (c) => c.peak4000 === true
    ),
    criterion(
      'Au moins 3 pays frontaliers', 'At least 3 bordering countries',
      'geography',
      'Le pays partage ses frontières terrestres avec 3 voisins ou plus.',
      'The country shares land borders with 3 or more neighboring countries.',
      (c) => c.borders.length >= 3
    ),
    criterion(
      'Sans frontière terrestre', 'No land borders (island nation)',
      'geography',
      'Le pays est situé sur une ou plusieurs îles (0 frontière terrestre).',
      'The country is situated on islands with no shared land borders.',
      (c) => c.borders.length === 0
    ),
    criterion(
      'Superficie > 1 000 000 km²', 'Area > 1,000,000 km²',
      'economy',
      'La superficie totale du pays dépasse 1 million de km² (ex: Canada, Chine, Algérie, Brésil...).',
      'Total land area exceeds 1 million km² (e.g. Canada, China, Algeria, Brazil...).',
      (c) => (c.area || 0) >= 1_000_000
    ),
    criterion(
      'Superficie < 50 000 km²', 'Area < 50,000 km²',
      'economy',
      'La superficie totale du pays est inférieure à 50 000 km² (ex: Belgique, Suisse, Luxembourg...).',
      'Total land area is under 50,000 km² (e.g. Belgium, Switzerland, Luxembourg...).',
      (c) => (c.area || 0) > 0 && (c.area || 0) < 50_000
    ),
    criterion(
      'Plus de 100M d’habitants', 'Population > 100 million',
      'economy',
      'La population du pays dépasse 100 millions d’habitants.',
      'The country’s population exceeds 100 million people.',
      (c) => c.population >= 100_000_000
    ),
    criterion(
      'Entre 10M et 100M d’habitants', 'Population between 10M and 100M',
      'economy',
      'La population est comprise entre 10 et 100 millions d’habitants.',
      'Population is between 10 and 100 million people.',
      (c) => c.population >= 10_000_000 && c.population < 100_000_000
    ),
    criterion(
      'Moins de 10M d’habitants', 'Population < 10 million',
      'economy',
      'La population du pays est inférieure à 10 millions d’habitants.',
      'Country population is under 10 million people.',
      (c) => c.population > 0 && c.population < 10_000_000
    ),
    criterion(
      'Membre de l’OCDE', 'OECD member state',
      'economy',
      'Le pays fait partie des 38 États membres développés de l’OCDE (ex: France, Japon, Mexique, Allemagne...).',
      'The country is one of the 38 developed member states of the OECD.',
      (c) => c.oecd === true
    ),
    criterion(
      'Non-membre de l’OCDE', 'Non-OECD country',
      'economy',
      'Le pays ne fait pas partie des 38 pays membres de l’OCDE.',
      'The country is not a member of the OECD.',
      (c) => c.oecd === false
    ),
    criterion(
      'Devise : Euro (€)', 'Currency: Euro (€)',
      'economy',
      'Le pays utilise l’Euro (€) comme monnaie officielle.',
      'The country uses the Euro (€) as its official currency.',
      hasCurrencyCode('EUR')
    ),
    criterion(
      'Devise : Dollar ($)', 'Currency: Dollar ($)',
      'economy',
      'Le pays utilise une monnaie appelée Dollar (USD, CAD, AUD, etc.).',
      'The country uses a currency called Dollar (USD, CAD, AUD, etc.).',
      hasCurrencyName('dollar')
    ),
    criterion(
      'Devise : Franc', 'Currency: Franc',
      'economy',
      'Le pays utilise une monnaie appelée Franc (CFA, CFP, CHF, etc.).',
      'The country uses a currency called Franc (CFA, CFP, CHF, etc.).',
      hasCurrencyName('franc')
    ),
    criterion(
      'Devise : Dinar', 'Currency: Dinar',
      'economy',
      'Le pays utilise une monnaie appelée Dinar (Algérie, Koweït, Tunisie, etc.).',
      'The country uses a currency called Dinar (Algeria, Kuwait, Tunisia, etc.).',
      hasCurrencyName('dinar')
    ),
    criterion(
      'Devise : Roupie', 'Currency: Rupee',
      'economy',
      'Le pays utilise une monnaie appelée Roupie (Inde, Pakistan, Maurice, etc.).',
      'The country uses a currency called Rupee (India, Pakistan, Mauritius, etc.).',
      hasCurrencyName('rupee')
    ),
    criterion(
      'Au moins 2 langues officielles', 'At least 2 official languages',
      'language',
      'Le pays possède 2 langues officielles ou nationales ou plus (ex: Canada, Suisse, Cameroun...).',
      'The country has 2 or more official or national languages (e.g. Canada, Switzerland, Cameroon...).',
      (c) => c.languages.length >= 2
    ),
    criterion(
      'Capitale même initiale que le pays', 'Capital has same initial as country',
      'language',
      'Le nom de la capitale commence par la même lettre que le nom du pays (ex: Algérie ➔ Alger, Brésil ➔ Brasília, Mexique ➔ Mexico...).',
      'The capital starts with the same letter as the country name in French (e.g. Algérie ➔ Alger, Brésil ➔ Brasília...).',
      (c) => c.capitalSameLetter === true
    ),
    ...['English', 'French', 'Spanish', 'Arabic', 'Portuguese', 'Russian', 'Chinese'].map((language) => {
      const nameFr = { English:'l’anglais', French:'le français', Spanish:'l’espagnol', Arabic:'l’arabe', Portuguese:'le portugais', Russian:'le russe', Chinese:'le chinois' }[language];
      const nameEn = { English:'English', French:'French', Spanish:'Spanish', Arabic:'Arabic', Portuguese:'Portuguese', Russian:'Russian', Chinese:'Chinese' }[language];
      return criterion(
        `Langue : ${nameFr}`, `Language: ${nameEn}`,
        'language',
        `Une des langues officielles ou nationales du pays est ${nameFr}.`,
        `One of the country’s official or national languages is ${nameEn}.`,
        hasLanguage(language)
      );
    }),
    criterion(
      'Symbole sur le drapeau', 'Symbol on flag',
      'history',
      'Le drapeau comporte un symbole particulier (étoile, croissant de lune, soleil ou armoiries).',
      'The flag features a distinctive symbol (star, crescent, sun, or coat of arms).',
      (c) => c.symbolOnFlag === true
    ),
    criterion(
      'Drapeau à bandes verticales', 'Vertical stripes on flag',
      'history',
      'Le motif principal du drapeau est composé de bandes verticales (ex: France, Italie, Mali...).',
      'The flag features vertical stripes as its main pattern (e.g. France, Italy, Mali...).',
      (c) => c.flagStripes === 'vertical'
    ),
    criterion(
      'Drapeau à bandes horizontales', 'Horizontal stripes on flag',
      'history',
      'Le motif principal du drapeau est composé de bandes horizontales (ex: Allemagne, Espagne, Pays-Bas...).',
      'The flag features horizontal stripes as its main pattern (e.g. Germany, Spain, Netherlands...).',
      (c) => c.flagStripes === 'horizontal'
    ),
    criterion(
      'Drapeau avec au moins 4 couleurs', 'Flag with at least 4 colors',
      'history',
      'Le drapeau comporte 4 couleurs principales distinctes ou plus.',
      'The flag contains 4 or more distinct main colors.',
      (c) => (c.flagColorCount || 0) >= 4
    ),
    criterion(
      'Drapeau avec du rouge', 'Flag contains red',
      'history',
      'Le drapeau officiel comporte de la couleur rouge.',
      'The official flag contains the color red.',
      hasColor('#d21034')
    ),
    criterion(
      'Drapeau avec du bleu', 'Flag contains blue',
      'history',
      'Le drapeau officiel comporte de la couleur bleue.',
      'The official flag contains the color blue.',
      hasColor('#005eb8')
    ),
    criterion(
      'Drapeau avec du vert', 'Flag contains green',
      'history',
      'Le drapeau officiel comporte de la couleur verte.',
      'The official flag contains the color green.',
      hasColor('#007a3d')
    ),
    criterion(
      'Drapeau avec du jaune / or', 'Flag contains yellow / gold',
      'history',
      'Le drapeau officiel comporte de la couleur jaune ou or.',
      'The official flag contains yellow or gold.',
      hasColor('#ffd100')
    ),
    criterion(
      'Drapeau avec du noir', 'Flag contains black',
      'history',
      'Le drapeau officiel comporte de la couleur noire.',
      'The official flag contains the color black.',
      hasColor('#000000')
    ),
    criterion(
      'Nom en 5 lettres ou moins', 'French name has 5 letters or fewer',
      'history',
      'Le nom du pays en français comporte 5 lettres ou moins (ex: Cuba, Mali, Pérou, Inde...).',
      'The country name in French has 5 letters or fewer (e.g. Cuba, Mali, Pérou, Inde...).',
      (c) => c.name.length <= 5
    ),
    criterion(
      'Nom se terminant par -ia ou -ie', 'French name ends in -ia or -ie',
      'history',
      'Le nom courant du pays en français se termine par les lettres "ia" ou "ie" (ex: Algérie, Italie, Australie...).',
      'The country name in French ends with "ia" or "ie" (e.g. Algérie, Italie, Australie...).',
      (c) => /i[ae]$/i.test(c.name)
    ),
    criterion(
      'Nom composé (plusieurs mots)', 'Compound name (several words)',
      'language',
      'Le nom du pays en français comporte plusieurs mots ou un trait d’union (ex: Afrique du Sud, Costa Rica, Royaume-Uni...).',
      'The country name in French consists of multiple words or hyphens (e.g. Afrique du Sud, Costa Rica...).',
      (c) => /[\s-]/.test(c.name)
    ),
    criterion(
      'Présence d’un triangle sur le drapeau', 'Triangle on flag',
      'history',
      'Le motif du drapeau comporte un chevron ou au moins un triangle (ex: Jordanie, Tchéquie, Cuba, Zimbabwe, Bahamas...).',
      'The flag design includes a chevron or at least one triangle (e.g. Jordan, Czechia, Cuba, South Africa...).',
      (c) => c.flagTriangle === true
    ),
    criterion(
      'Drapeau sans rouge ni bleu', 'Flag without red or blue',
      'history',
      'Le drapeau officiel ne comporte ni couleur rouge ni couleur bleue (ex: Nigeria, Irlande, Jamaïque, Arabie Saoudite...).',
      'The official flag contains neither red nor blue (e.g. Nigeria, Jamaica, Saudi Arabia...).',
      (c) => !(c.flagColors || []).includes('#d21034') && !(c.flagColors || []).includes('#005eb8')
    ),
    criterion(
      'Pays en zone intertropicale', 'Intertropical zone country',
      'geography',
      'Le territoire du pays est situé dans la zone intertropicale (entre le Tropique du Cancer et du Capricorne).',
      'The country’s territory is located in the intertropical zone (between the Tropics of Cancer and Capricorn).',
      (c) => c.intertropical === true
    ),
    criterion(
      'Climat aride ou désertique', 'Arid or desert climate',
      'geography',
      'Le pays possède un climat désertique ou aride avec précipitations < 250 mm/an (ex: Égypte, Arabie Saoudite, Algérie...).',
      'The country has an arid or desert climate with precipitation < 250 mm/year (e.g. Egypt, Saudi Arabia, Algeria...).',
      (c) => c.aridClimate === true
    ),
    criterion(
      'Présence de glaciers / neiges éternelles', 'Glaciers or permanent snow',
      'geography',
      'Le pays abrite au moins un glacier ou des neiges éternelles répertoriés (ex: Suisse, France, Chili, Népal, Tanzanie...).',
      'The country hosts at least one documented glacier or permanent snow field (e.g. Switzerland, France, Chile, Nepal...).',
      (c) => c.glacier === true
    ),
  ].filter((item) => data.filter(item.test).length >= 5);
}

export const foldCountry = fold;
