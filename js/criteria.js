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

function criterion(label, type, description, test) {
  return { label, type, description, test };
}

export function buildCriteria(data) {
  const hasLanguage = (language) => (country) => country.languages.some((value) => fold(value) === fold(language));
  const hasCurrencyCode = (code) => (country) => country.currencies.some((item) => item.code === code);
  const hasCurrencyName = (namePart) => (country) => country.currencies.some((item) => fold(item.name).includes(fold(namePart)));
  const hasColor = (hex) => (country) => (country.flagColors || []).includes(hex);

  return [
    criterion('Dans l’hémisphère Nord', 'geography', 'Le territoire du pays se situe dans l’hémisphère Nord (latitude >= 0).', (c) => c.hemisphere === 'Nord'),
    criterion('Dans l’hémisphère Sud', 'geography', 'Le territoire du pays se situe dans l’hémisphère Sud (latitude < 0).', (c) => c.hemisphere === 'Sud'),
    criterion('En Afrique', 'geography', 'Le pays se situe ou s’étend sur le continent africain.', (c) => inRegion(c, 'Africa')),
    criterion('En Europe', 'geography', 'Le pays se situe ou s’étend en Europe.', (c) => inRegion(c, 'Europe')),
    criterion('En Asie', 'geography', 'Le pays se situe ou s’étend en Asie.', (c) => inRegion(c, 'Asia')),
    criterion('En Amérique', 'geography', 'Le pays se situe sur le continent américain.', (c) => inRegion(c, 'Americas')),
    criterion('En Océanie', 'geography', 'Le pays se situe en Océanie.', (c) => inRegion(c, 'Oceania')),
    criterion('Pays enclavé (sans mer)', 'geography', 'Le pays n’a aucun accès direct à la mer ou à un océan.', (c) => c.landlocked === true),
    criterion('Possède un accès à la mer', 'geography', 'Le pays possède une côte ou un accès maritime direct.', (c) => c.landlocked === false),
    criterion('Traversé par l’Équateur', 'geography', 'La ligne imaginaire de l’Équateur traverse le territoire du pays.', (c) => c.equator === true),
    criterion('Présence de sommets > 4 000 m', 'geography', 'Le territoire du pays comprend des sommets montagneux dépassant 4 000 mètres d’altitude (ex: France, Népal, Chili...).', (c) => c.peak4000 === true),
    criterion('Au moins 3 pays frontaliers', 'geography', 'Le pays partage ses frontières terrestres avec 3 voisins ou plus.', (c) => c.borders.length >= 3),
    criterion('Sans frontière terrestre', 'geography', 'Le pays est situé sur une ou plusieurs îles (0 frontière terrestre).', (c) => c.borders.length === 0),
    criterion('Superficie > 1 000 000 km²', 'economy', 'La superficie totale du pays dépasse 1 million de km² (ex: Canada, Chine, Algérie, Brésil...).', (c) => (c.area || 0) >= 1_000_000),
    criterion('Superficie < 50 000 km²', 'economy', 'La superficie totale du pays est inférieure à 50 000 km² (ex: Belgique, Suisse, Luxembourg...).', (c) => (c.area || 0) > 0 && (c.area || 0) < 50_000),
    criterion('Plus de 100M d’habitants', 'economy', 'La population du pays dépasse 100 millions d’habitants.', (c) => c.population >= 100_000_000),
    criterion('Entre 10M et 100M d’habitants', 'economy', 'La population est comprise entre 10 et 100 millions d’habitants.', (c) => c.population >= 10_000_000 && c.population < 100_000_000),
    criterion('Moins de 10M d’habitants', 'economy', 'La population du pays est inférieure à 10 millions d’habitants.', (c) => c.population > 0 && c.population < 10_000_000),
    criterion('Membre de l’OCDE', 'economy', 'Le pays fait partie des 38 États membres développés de l’OCDE (ex: France, Japon, Mexique, Allemagne...).', (c) => c.oecd === true),
    criterion('Non-membre de l’OCDE', 'economy', 'Le pays ne fait pas partie des 38 pays membres de l’OCDE.', (c) => c.oecd === false),
    criterion('Devise : Euro (€)', 'economy', 'Le pays utilise l’Euro (€) comme monnaie officielle.', hasCurrencyCode('EUR')),
    criterion('Devise : Dollar ($)', 'economy', 'Le pays utilise une monnaie appelée Dollar (USD, CAD, AUD, etc.).', hasCurrencyName('dollar')),
    criterion('Devise : Franc', 'economy', 'Le pays utilise une monnaie appelée Franc (CFA, CFP, CHF, etc.).', hasCurrencyName('franc')),
    criterion('Devise : Dinar', 'economy', 'Le pays utilise une monnaie appelée Dinar (Algérie, Koweït, Tunisie, etc.).', hasCurrencyName('dinar')),
    criterion('Devise : Roupie', 'economy', 'Le pays utilise une monnaie appelée Roupie (Inde, Pakistan, Maurice, etc.).', hasCurrencyName('rupee')),
    criterion('Au moins 2 langues officielles', 'language', 'Le pays possède 2 langues officielles ou nationales ou plus (ex: Canada, Suisse, Cameroun...).', (c) => c.languages.length >= 2),
    criterion('Capitale même initiale que le pays', 'language', 'Le nom de la capitale commence par la même lettre que le nom du pays (ex: Algérie ➔ Alger, Brésil ➔ Brasília, Mexique ➔ Mexico...).', (c) => c.capitalSameLetter === true),
    ...['English', 'French', 'Spanish', 'Arabic', 'Portuguese', 'Russian', 'Chinese'].map((language) => {
      const nameFr = { English:'l’anglais', French:'le français', Spanish:'l’espagnol', Arabic:'l’arabe', Portuguese:'le portugais', Russian:'le russe', Chinese:'le chinois' }[language];
      return criterion(`Langue : ${nameFr}`, 'language', `Une des langues officielles ou nationales du pays est ${nameFr}.`, hasLanguage(language));
    }),
    criterion('Symbole sur le drapeau', 'history', 'Le drapeau comporte un symbole particulier (étoile, croissant de lune, soleil ou armoiries).', (c) => c.symbolOnFlag === true),
    criterion('Drapeau à bandes verticales', 'history', 'Le motif principal du drapeau est composé de bandes verticales (ex: France, Italie, Mali...).', (c) => c.flagStripes === 'vertical'),
    criterion('Drapeau à bandes horizontales', 'history', 'Le motif principal du drapeau est composé de bandes horizontales (ex: Allemagne, Espagne, Pays-Bas...).', (c) => c.flagStripes === 'horizontal'),
    criterion('Drapeau avec au moins 4 couleurs', 'history', 'Le drapeau comporte 4 couleurs principales distinctes ou plus.', (c) => (c.flagColorCount || 0) >= 4),
    criterion('Drapeau avec du rouge', 'history', 'Le drapeau officiel comporte de la couleur rouge.', hasColor('#d21034')),
    criterion('Drapeau avec du bleu', 'history', 'Le drapeau officiel comporte de la couleur bleue.', hasColor('#005eb8')),
    criterion('Drapeau avec du vert', 'history', 'Le drapeau officiel comporte de la couleur verte.', hasColor('#007a3d')),
    criterion('Drapeau avec du jaune / or', 'history', 'Le drapeau officiel comporte de la couleur jaune ou or.', hasColor('#ffd100')),
    criterion('Drapeau avec du noir', 'history', 'Le drapeau officiel comporte de la couleur noire.', hasColor('#000000')),
    criterion('Nom en 5 lettres ou moins', 'history', 'Le nom du pays en français comporte 5 lettres ou moins (ex: Cuba, Mali, Pérou, Inde...).', (c) => c.name.length <= 5),
    criterion('Nom se terminant par -ia ou -ie', 'history', 'Le nom courant du pays en français se termine par les lettres "ia" ou "ie" (ex: Algérie, Italie, Australie...).', (c) => /i[ae]$/i.test(c.name)),
    criterion('Nom composé (plusieurs mots)', 'language', 'Le nom du pays en français comporte plusieurs mots ou un trait d’union (ex: Afrique du Sud, Costa Rica, Royaume-Uni...).', (c) => /[\s-]/.test(c.name)),
    criterion('Présence d’un triangle sur le drapeau', 'history', 'Le motif du drapeau comporte un chevron ou au moins un triangle (ex: Jordanie, Tchéquie, Cuba, Zimbabwe, Bahamas...).', (c) => c.flagTriangle === true),
    criterion('Drapeau sans rouge ni bleu', 'history', 'Le drapeau officiel ne comporte ni couleur rouge ni couleur bleue (ex: Nigeria, Irlande, Jamaïque, Arabie Saoudite...).', (c) => !(c.flagColors || []).includes('#d21034') && !(c.flagColors || []).includes('#005eb8')),
    criterion('Pays en zone intertropicale', 'geography', 'Le territoire du pays est situé dans la zone intertropicale (entre le Tropique du Cancer et du Capricorne).', (c) => c.intertropical === true),
    criterion('Climat aride ou désertique', 'geography', 'Le pays possède un climat désertique ou aride avec précipitations < 250 mm/an (ex: Égypte, Arabie Saoudite, Algérie...).', (c) => c.aridClimate === true),
    criterion('Présence de glaciers / neiges éternelles', 'geography', 'Le pays abrite au moins un glacier ou des neiges éternelles répertoriés (ex: Suisse, France, Chili, Népal, Tanzanie...).', (c) => c.glacier === true),
  ].filter((item) => data.filter(item.test).length >= 5);
}

export const foldCountry = fold;
