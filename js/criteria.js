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

function criterion(labelFr, labelEn, type, descriptionFr, descriptionEn, test, icon = '') {
  return {
    labelFr,
    labelEn,
    descriptionFr,
    descriptionEn,
    type,
    test,
    icon,
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
    ,
      '🧭'),
    criterion(
      'Dans l’hémisphère Sud', 'In the Southern Hemisphere',
      'geography',
      'Le territoire du pays se situe dans l’hémisphère Sud (latitude < 0).',
      'The country’s territory lies in the Southern Hemisphere (latitude < 0).',
      (c) => c.hemisphere === 'Sud'
    ,
      '🧭'),
    criterion(
      'En Afrique', 'In Africa',
      'geography',
      'Le pays se situe ou s’étend sur le continent africain.',
      'The country is located or extends into the African continent.',
      (c) => inRegion(c, 'Africa')
    ,
      '🌍'),
    criterion(
      'En Europe', 'In Europe',
      'geography',
      'Le pays se situe ou s’étend en Europe.',
      'The country is located or extends into Europe.',
      (c) => inRegion(c, 'Europe')
    ,
      '🇪🇺'),
    criterion(
      'En Asie', 'In Asia',
      'geography',
      'Le pays se situe ou s’étend en Asie.',
      'The country is located or extends into Asia.',
      (c) => inRegion(c, 'Asia')
    ,
      '⛩️'),
    criterion(
      'En Amérique', 'In the Americas',
      'geography',
      'Le pays se situe sur le continent américain.',
      'The country is located in the Americas.',
      (c) => inRegion(c, 'Americas')
    ,
      '🌎'),
    criterion(
      'En Océanie', 'In Oceania',
      'geography',
      'Le pays se situe en Océanie.',
      'The country is located in Oceania.',
      (c) => inRegion(c, 'Oceania')
    ,
      '🏝️'),
    criterion(
      'Pays enclavé (sans mer)', 'Landlocked country',
      'geography',
      'Le pays n’a aucun accès direct à la mer ou à un océan.',
      'The country has no direct access to a sea or ocean.',
      (c) => c.landlocked === true
    ,
      '🔒'),
    criterion(
      'Possède un accès à la mer', 'Has coastline / access to sea',
      'geography',
      'Le pays possède une côte ou un accès maritime direct.',
      'The country has a coastline or direct maritime access.',
      (c) => c.landlocked === false
    ,
      '🌊'),
    criterion(
      'Traversé par l’Équateur', 'Crossed by the Equator',
      'geography',
      'La ligne imaginaire de l’Équateur traverse le territoire du pays.',
      'The imaginary line of the Equator crosses the country’s territory.',
      (c) => c.equator === true
    ,
      '🌐'),
    criterion(
      'Présence de sommets > 4 000 m', 'Peaks over 4,000 m',
      'geography',
      'Le territoire du pays comprend un ou plusieurs sommets montagneux naturels dépassant 4 000 mètres d’altitude.',
      'The country’s territory includes one or more natural mountain peaks exceeding 4,000 meters in altitude.',
      (c) => c.peak4000 === true
    ,
      '⛰️'),
    criterion(
      'Au moins 3 pays frontaliers', 'At least 3 bordering countries',
      'geography',
      'Le pays partage ses frontières terrestres avec 3 voisins ou plus.',
      'The country shares land borders with 3 or more neighboring countries.',
      (c) => c.borders.length >= 3
    ,
      '🗺️'),
    criterion(
      'Sans frontière terrestre', 'No land borders (island nation)',
      'geography',
      'Le pays est situé sur une ou plusieurs îles (0 frontière terrestre).',
      'The country is situated on islands with no shared land borders.',
      (c) => c.borders.length === 0
    ,
      '🏝️'),
    criterion(
      'Superficie > 1 000 000 km²', 'Area > 1,000,000 km²',
      'economy',
      'La superficie totale du territoire national dépasse 1 000 000 de kilomètres carrés.',
      'Total national land area exceeds 1,000,000 square kilometers.',
      (c) => (c.area || 0) >= 1_000_000
    ,
      '📐'),
    criterion(
      'Superficie < 50 000 km²', 'Area < 50,000 km²',
      'economy',
      'La superficie totale du territoire national est strictement inférieure à 50 000 kilomètres carrés.',
      'Total national land area is strictly under 50,000 square kilometers.',
      (c) => (c.area || 0) > 0 && (c.area || 0) < 50_000
    ,
      '🔍'),
    criterion(
      'Plus de 100M d’habitants', 'Population > 100 million',
      'economy',
      'La population du pays dépasse 100 millions d’habitants.',
      'The country’s population exceeds 100 million people.',
      (c) => c.population >= 100_000_000
    ,
      '🏙️'),
    criterion(
      'Entre 10M et 100M d’habitants', 'Population between 10M and 100M',
      'economy',
      'La population est comprise entre 10 et 100 millions d’habitants.',
      'Population is between 10 and 100 million people.',
      (c) => c.population >= 10_000_000 && c.population < 100_000_000
    ,
      '👥'),
    criterion(
      'Moins de 10M d’habitants', 'Population < 10 million',
      'economy',
      'La population du pays est inférieure à 10 millions d’habitants.',
      'Country population is under 10 million people.',
      (c) => c.population > 0 && c.population < 10_000_000
    ,
      '🏡'),
    criterion(
      'Membre de l’OCDE', 'OECD member state',
      'economy',
      'Le pays est officiellement membre de l’Organisation de coopération et de développement économiques (38 États membres).',
      'The country is one of the 38 developed member states of the OECD.',
      (c) => c.oecd === true
    ,
      '🏛️'),
    criterion(
      'Non-membre de l’OCDE', 'Non-OECD country',
      'economy',
      'Le pays ne fait pas partie des 38 pays membres de l’OCDE.',
      'The country is not a member of the OECD.',
      (c) => c.oecd === false
    ,
      '🌐'),
    criterion(
      'Devise : Euro (€)', 'Currency: Euro (€)',
      'economy',
      'Le pays utilise l’Euro (€) comme monnaie officielle ou légale.',
      'The country uses the Euro (€) as its official currency or legal tender.',
      hasCurrencyCode('EUR')
    ,
      '💶'),
    criterion(
      'Devise : Dollar ($)', 'Currency: Dollar ($)',
      'economy',
      'La monnaie légale du pays porte le nom officiel de Dollar (symbole : $).',
      'The country’s official currency is called Dollar (symbol: $).',
      hasCurrencyName('dollar')
    ,
      '💵'),
    criterion(
      'Devise : Franc (₣)', 'Currency: Franc (₣)',
      'economy',
      'La monnaie légale du pays porte le nom officiel de Franc (symbole : ₣ ou Fr).',
      'The country’s official currency is called Franc (symbol: ₣ or Fr).',
      hasCurrencyName('franc')
    ,
      '₣'),
    criterion(
      'Devise : Dinar (din.)', 'Currency: Dinar (din.)',
      'economy',
      'La monnaie légale du pays porte le nom officiel de Dinar (abréviation : din.).',
      'The country’s official currency is called Dinar (abbreviation: din.).',
      hasCurrencyName('dinar')
    ,
      '🪙'),
    criterion(
      'Devise : Roupie (₹ / ₨)', 'Currency: Rupee (₹ / ₨)',
      'economy',
      'La monnaie légale du pays porte le nom officiel de Roupie (symbole : ₹ ou ₨).',
      'The country’s official currency is called Rupee (symbol: ₹ or ₨).',
      hasCurrencyName('rupee')
    ,
      '₨'),
    criterion(
      'Au moins 2 langues officielles', 'At least 2 official languages',
      'language',
      'La législation ou constitution du pays reconnaît au moins deux langues officielles ou nationales distinctes.',
      'The country legally or constitutionally recognizes at least two distinct official or national languages.',
      (c) => c.languages.length >= 2
    ,
      '💬'),
    criterion(
      'Capitale même initiale que le pays', 'Capital has same initial as country',
      'language',
      'La première lettre du nom de la capitale officielle est identique à la première lettre du nom du pays.',
      'The official capital name begins with the exact same initial letter as the country name in French.',
      (c) => c.capitalSameLetter === true
    ,
      '🔠'),
    ...['English', 'French', 'Spanish', 'Arabic', 'Portuguese', 'Russian', 'Chinese'].map((language) => {
      const nameFr = { English:'l’anglais', French:'le français', Spanish:'l’espagnol', Arabic:'l’arabe', Portuguese:'le portugais', Russian:'le russe', Chinese:'le chinois' }[language];
      const nameEn = { English:'English', French:'French', Spanish:'Spanish', Arabic:'Arabic', Portuguese:'Portuguese', Russian:'Russian', Chinese:'Chinese' }[language];
      const icon = { English:'🇬🇧', French:'🇫🇷', Spanish:'🇪🇸', Arabic:'🇸🇦', Portuguese:'🇵🇹', Russian:'🇷🇺', Chinese:'🇨🇳' }[language];
      return criterion(
        `Langue : ${nameFr}`, `Language: ${nameEn}`,
        'language',
        `Une des langues officielles ou nationales du pays est ${nameFr}.`,
        `One of the country’s official or national languages is ${nameEn}.`,
        hasLanguage(language),
        icon
      );
    }),
    criterion(
      'Symbole sur le drapeau', 'Symbol on flag',
      'history',
      'Le drapeau comporte un symbole particulier (étoile, croissant de lune, soleil ou armoiries).',
      'The flag features a distinctive symbol (star, crescent, sun, or coat of arms).',
      (c) => c.symbolOnFlag === true
    ,
      '⚜️'),
    criterion(
      'Drapeau à bandes verticales', 'Vertical stripes on flag',
      'history',
      'Le motif officiel du drapeau national est principalement composé de bandes verticales.',
      'The official national flag features vertical stripes as its primary pattern.',
      (c) => c.flagStripes === 'vertical'
    ,
      '║'),
    criterion(
      'Drapeau à bandes horizontales', 'Horizontal stripes on flag',
      'history',
      'Le motif officiel du drapeau national est principalement composé de bandes horizontales.',
      'The official national flag features horizontal stripes as its primary pattern.',
      (c) => c.flagStripes === 'horizontal'
    ,
      '═'),
    criterion(
      'Drapeau avec au moins 4 couleurs', 'Flag with at least 4 colors',
      'history',
      'Le drapeau comporte 4 couleurs principales distinctes ou plus.',
      'The flag contains 4 or more distinct main colors.',
      (c) => (c.flagColorCount || 0) >= 4
    ,
      '🌈'),
    criterion(
      'Drapeau avec du rouge', 'Flag contains red',
      'history',
      'Le drapeau officiel comporte de la couleur rouge.',
      'The official flag contains the color red.',
      hasColor('#d21034')
    ,
      '🟥'),
    criterion(
      'Drapeau avec du bleu', 'Flag contains blue',
      'history',
      'Le drapeau officiel comporte de la couleur bleue.',
      'The official flag contains the color blue.',
      hasColor('#005eb8')
    ,
      '🟦'),
    criterion(
      'Drapeau avec du vert', 'Flag contains green',
      'history',
      'Le drapeau officiel comporte de la couleur verte.',
      'The official flag contains the color green.',
      hasColor('#007a3d')
    ,
      '🟩'),
    criterion(
      'Drapeau avec du jaune / or', 'Flag contains yellow / gold',
      'history',
      'Le drapeau officiel comporte de la couleur jaune ou or.',
      'The official flag contains yellow or gold.',
      hasColor('#ffd100')
    ,
      '🟨'),
    criterion(
      'Drapeau avec du noir', 'Flag contains black',
      'history',
      'Le drapeau officiel comporte de la couleur noire.',
      'The official flag contains the color black.',
      hasColor('#000000')
    ,
      '⬛'),
    criterion(
      'Nom en 5 lettres ou moins', 'French name has 5 letters or fewer',
      'history',
      'Le nom courant du pays en français s’écrit avec 5 lettres ou moins (sans compter les espaces).',
      'The country name in French consists of 5 letters or fewer.',
      (c) => c.name.length <= 5
    ,
      '🔤'),
    criterion(
      'Nom se terminant par -ia ou -ie', 'French name ends in -ia or -ie',
      'history',
      'La terminaison du nom courant du pays en français s’achève par les lettres "ia" ou "ie".',
      'The country name in French ends with the letters "ia" or "ie".',
      (c) => /i[ae]$/i.test(c.name)
    ,
      '🔤'),
    criterion(
      'Nom composé (plusieurs mots)', 'Compound name (several words)',
      'language',
      'Le nom officiel ou usuel du pays en français est composé d’au moins deux mots distincts ou comporte un trait d’union.',
      'The country name in French consists of multiple words separated by spaces or hyphens.',
      (c) => /[\s-]/.test(c.name)
    ,
      '✍️'),
    criterion(
      'Présence d’un triangle sur le drapeau', 'Triangle on flag',
      'history',
      'Le dessin officiel du drapeau national intègre au moins une forme géométrique triangulaire ou un chevron.',
      'The official flag design features at least one triangle or chevron element.',
      (c) => c.flagTriangle === true
    ,
      '🔺'),
    criterion(
      'Drapeau sans rouge ni bleu', 'Flag without red or blue',
      'history',
      'Le drapeau national officiel ne comporte aucune nuance de couleur rouge ni de couleur bleue.',
      'The official national flag contains neither the color red nor the color blue.',
      (c) => !(c.flagColors || []).includes('#d21034') && !(c.flagColors || []).includes('#005eb8')
    ,
      '🎨'),
    criterion(
      'Pays en zone intertropicale', 'Intertropical zone country',
      'geography',
      'Le territoire du pays est situé dans la zone intertropicale (entre le Tropique du Cancer et du Capricorne).',
      'The country’s territory is located in the intertropical zone (between the Tropics of Cancer and Capricorn).',
      (c) => c.intertropical === true
    ,
      '🌴'),
    criterion(
      'Climat aride ou désertique', 'Arid or desert climate',
      'geography',
      'Le territoire est majoritairement caractérisé par un climat désertique ou aride avec précipitations annuelles moyennes < 250 mm.',
      'The territory is characterized by an arid or desert climate with average precipitation < 250 mm/year.',
      (c) => c.aridClimate === true
    ,
      '🏜️'),
    criterion(
      'Présence de glaciers / neiges éternelles', 'Glaciers or permanent snow',
      'geography',
      'Le territoire national abrite au moins un glacier naturel actif ou une zone de neiges éternelles répertoriés.',
      'The country hosts at least one documented active natural glacier or permanent snow field.',
      (c) => c.glacier === true
    ,
      '🏔️'),
    criterion(
      'Présence d’une croix sur le drapeau', 'Cross on flag',
      'history',
      'Le drapeau officiel national comporte une croix clairement identifiable (croix scandinave, grecque, sautoir ou latine).',
      'The official national flag features a prominent cross design (Scandinavian, Greek, saltire, or Latin cross).',
      (c) => c.flagCross === true
    ,
      '✝️'),
    criterion(
      'Croissant de lune sur le drapeau', 'Crescent moon on flag',
      'history',
      'Le motif officiel du drapeau national comprend la représentation graphique d’un croissant de lune.',
      'The official national flag includes the graphic representation of a crescent moon.',
      (c) => c.flagCrescent === true
    ,
      '🌙'),
    criterion(
      'Au moins une étoile sur le drapeau', 'At least one star on flag',
      'history',
      'Le drapeau officiel national comporte au moins une étoile dans son dessin (à cinq branches ou plus).',
      'The official national flag features at least one star in its design.',
      (c) => c.flagStar === true
    ,
      '⭐'),
    criterion(
      'Sens de circulation : conduite à gauche', 'Drives on the left',
      'geography',
      'Le code de la route national impose obligatoirement la circulation automobile sur la voie de gauche de la chaussée.',
      'Traffic laws mandate driving on the left-hand side of the road.',
      (c) => c.driveLeft === true
    ,
      '🚗'),
    criterion(
      'Exploite l’énergie nucléaire civile', 'Operates civil nuclear power',
      'economy',
      'Le pays exploite au moins un réacteur électronucléaire commercial en activité sur son sol pour produire de l’électricité (base AIEA PRIS).',
      'The country operates at least one active commercial nuclear power reactor on its territory for electricity generation (IAEA PRIS).',
      (c) => c.nuclearPower === true
    ,
      '⚡'),
    criterion(
      'Union monétaire partagée', 'Shared currency union',
      'economy',
      'Le pays partage sa monnaie officielle avec d’autres États souverains (Zone Euro, Franc CFA, Dollar des Caraïbes, dollarisation...).',
      'The country shares its official currency with other sovereign states (Eurozone, CFA Franc, East Caribbean Dollar, official dollarization...).',
      (c) => c.sharedCurrency === true
    ,
      '🤝'),
    criterion(
      'État indépendant en 1990 ou après', 'Independent in 1990 or later',
      'history',
      'Le pays a accédé à sa pleine souveraineté internationale ou a été constitué comme nouvel État indépendant en 1990 ou ultérieurement.',
      'The country gained full sovereignty or was established as an independent sovereign state in 1990 or later.',
      (c) => c.independent1990 === true
    ,
      '⏳'),
    criterion(
      'État fédéral (fédération d’États)', 'Federal state',
      'history',
      'La constitution nationale établit une organisation politique fédérale composée d’États, provinces ou cantons autonomes.',
      'The national constitution establishes a federal structure comprising autonomous states, provinces, or cantons.',
      (c) => c.federalState === true
    ,
      '🏛️'),
  ].filter((item) => data.filter(item.test).length >= 5);
}

export const foldCountry = fold;
