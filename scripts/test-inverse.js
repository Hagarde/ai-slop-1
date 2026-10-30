// Vérifications du mode Fil Rouge : catalogue, par, validation et économie.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCriteria } from '../js/criteria.js';
import { buildRuleLibrary, maskFromRule, maskKey, maskAnd, maskCount, scoreRules, searchRules } from '../js/inverse_rules.js';
import { buildPuzzleCatalog, InverseEngine, ROUND_PLAN } from '../js/inverse.js';

const C = JSON.parse(fs.readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8')).countries;
const criteria = buildCriteria(C);
const { rules, indexByCode } = buildRuleLibrary(C, criteria);
const words = Math.ceil(C.length / 32);
for (const rule of rules) rule.mask = maskFromRule(rule, words, indexByCode);

const catalog = buildPuzzleCatalog(C, rules, words);

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const ruleByLabel = (label) => {
  const rule = rules.find((item) => item.labelFr === label);
  assert.ok(rule, `Critère introuvable : ${label}`);
  return rule;
};

console.log(`Critères jouables : ${rules.length}`);
console.log(`Ensembles au catalogue : ${catalog.length}`);
check(rules.length >= 60, 'la bibliothèque doit rester riche');
check(catalog.length > 2000, 'le catalogue doit contenir des milliers d’ensembles');

for (const plan of ROUND_PLAN) {
  const count = catalog.filter((item) => item.par === plan.par && item.size >= plan.min && item.size <= plan.max).length;
  console.log(`Manche ${plan.round} (par ${plan.par}, ${plan.min}-${plan.max}) : ${count} ensembles`);
  check(count > 50, `le réservoir de la manche ${plan.round} doit être suffisant`);
}

for (const item of catalog) {
  check(item.size >= 2 && item.size <= 20, 'taille hors bornes');
  check(item.coverages.length > 0, 'ensemble sans couverture');
  for (const coverage of item.coverages) {
    for (const country of C) {
      const satisfiesAll = coverage.every((index) => rules[index].set.has(country.code));
      check(
        satisfiesAll === item.codeSet.has(country.code),
        `la couverture n’isole pas exactement l’ensemble ${item.key}`
      );
    }
  }
}

// Le par déclaré doit être exact.
const singleKeys = new Set();
for (const rule of rules) {
  if (rule.size >= 2 && rule.size <= 20) singleKeys.add(maskKey(rule.mask));
}
const pairKeys = new Set();
const tmp = new Uint32Array(words);
for (let i = 0; i < rules.length; i++) {
  for (let j = i + 1; j < rules.length; j++) {
    maskAnd(rules[i].mask, rules[j].mask, tmp);
    const size = maskCount(tmp);
    if (size < 2 || size > 20) continue;
    if (size === rules[i].size || size === rules[j].size) continue;
    pairKeys.add(maskKey(tmp));
  }
}
for (const item of catalog) {
  check(!singleKeys.has(item.key), 'un ensemble à 1 critère ne doit pas être proposé en par 2/3');
  if (item.par === 2) check(pairKeys.has(item.key), 'une énigme par 2 doit avoir une couverture par 2 critères');
  if (item.par === 3) check(!pairKeys.has(item.key), 'une énigme par 3 ne doit pas être soluble en 2 critères');
}

// ---------------------------------------------------------------------------
// Comportement du moteur sur une énigme forcée : hémisphère Sud ∩ dollar = 10.
// ---------------------------------------------------------------------------
const engine = new InverseEngine({ countryList: C, rules, catalog, roundPlan: ROUND_PLAN });
const south = ruleByLabel('Dans l’hémisphère Sud');
const dollar = ruleByLabel('Devise : Dollar ($)');
const symbol = ruleByLabel('Symbole sur le drapeau');
const targetCodes = [...south.set].filter((code) => dollar.set.has(code));
const targetSet = new Set(targetCodes);
check(targetCodes.length === 10, 'hémisphère Sud ∩ dollar doit donner 10 pays');

const makePuzzle = (codes, coverageRules, par, regions = { Monde: codes.length }) => ({
  key: [...codes].sort().join(','),
  codes,
  codeSet: new Set(codes),
  size: codes.length,
  par,
  regions,
  coverages: [coverageRules.map((rule) => rule.index)],
});

const loadPuzzle = (instance, puzzle, plan = { round: 1, par: 2, min: 2, max: 20 }) => {
  instance.puzzle = puzzle;
  instance.plan = plan;
  instance.poolMask = instance.allMask.slice();
  instance.poolSize = C.length;
  instance.selected = [];
  instance.implied = [];
  instance.usedRuleIds = new Set();
  instance.wrongCount = 0;
  instance.hintUsed = false;
  instance.roundDone = false;
  instance.roundWon = false;
  instance.roundSummary = null;
  instance.currentPoolCodes = new Set(C.map((country) => country.code));
};

loadPuzzle(engine, makePuzzle(targetCodes, [south, dollar], 2));

// « Symbole sur le drapeau » est vrai pour les 10 pays mais absent de la
// couverture minimale : il doit néanmoins être accepté et réduire le vivier.
check(targetCodes.every((code) => symbol.set.has(code)), 'le critère non prévu doit être vrai sur la cible');
check([...south.set].some((code) => !symbol.set.has(code)), 'le critère non prévu doit être utile après l’hémisphère Sud');

let result = engine.submitRule(south.id);
check(result.status === 'useful', 'hémisphère Sud doit être accepté');
check(engine.poolSize === 39, 'le vivier doit passer à 39 pays');
const livesAfterFirst = engine.lives;

// Doublon : aucune pénalité.
result = engine.submitRule(south.id);
check(result.status === 'duplicate', 'un critère déjà utilisé est un doublon');
check(engine.lives === livesAfterFirst, 'un doublon ne coûte pas de vie');

result = engine.submitRule(symbol.id);
check(result.status === 'useful', 'un critère valide non prévu doit être accepté comme utile');
check(engine.poolSize === 32, 'le critère non prévu doit réduire le vivier à 32 pays');
check(engine.lives >= livesAfterFirst, 'aucune vie ne doit être perdue sur un critère valide');

result = engine.submitRule(dollar.id);
check(result.status === 'win', 'hémisphère Sud ∩ dollar doit gagner la manche');
check(engine.poolSize === 10, 'le vivier final doit être exactement l’ensemble affiché');
check(engine.selected.some((entry) => entry.rule.id === symbol.id), 'la solution non prévue doit rester dans les critères validés');
check(engine.puzzle.codes.every((code) => engine.selected.every((entry) => entry.rule.set.has(code))), 'tous les critères validés doivent être vrais sur la cible');

// Critère faux et critère inconnu : sur une manche fraîche.
const engine3 = new InverseEngine({ countryList: C, rules, catalog, roundPlan: ROUND_PLAN });
loadPuzzle(engine3, makePuzzle(targetCodes, [south, dollar], 2));

const livesBeforeUnknown = engine3.lives;
const scoreBeforeUnknown = engine3.score;
result = engine3.submitRule('inexistant');
check(result.status === 'not-found', 'un identifiant inconnu n’est pas un critère faux');
check(engine3.lives === livesBeforeUnknown && engine3.score === scoreBeforeUnknown, 'un critère inconnu ne pénalise pas');

const wrong = rules.find((rule) => targetCodes.some((code) => !rule.set.has(code)));
const livesBeforeWrong = engine3.lives;
result = engine3.submitRule(wrong.id);
check(result.status === 'wrong', 'un critère faux doit être refusé');
check(engine3.lives === livesBeforeWrong - 1, 'un critère faux coûte une vie');
check(result.examples.length > 0, 'un critère faux doit afficher un contre-exemple');

// Les contre-exemples doivent être exactement des pays de la cible qui ne
// vérifient PAS le critère (et non l'inverse).
const expectedFailures = targetCodes.filter((code) => !wrong.set.has(code));
check(
  result.counterExampleCount === expectedFailures.length,
  'le nombre de contre-exemples doit correspondre aux pays de la cible qui échouent'
);
const expectedNames = expectedFailures
  .slice(0, 3)
  .map((code) => C.find((country) => country.code === code)?.name);
check(
  JSON.stringify(result.examples) === JSON.stringify(expectedNames),
  'les contre-exemples affichés doivent être les pays qui ne vérifient pas le critère'
);

// Recherche : les mots courts ne doivent pas matcher au milieu d'un mot.
const topLabel = (query) => searchRules(rules, query, 1)[0]?.labelFr;
check(topLabel('ile') === 'Sans frontière terrestre', '« ile » doit proposer le critère des pays sans frontière terrestre');
check(topLabel('île') === 'Sans frontière terrestre', '« île » doit proposer le critère des îles');
check(topLabel('iles') === 'Sans frontière terrestre', '« iles » doit proposer le critère des îles');
check(
  !searchRules(rules, 'ile', 8).some((rule) => rule.labelFr === 'Au moins une étoile sur le drapeau'),
  '« ile » ne doit pas matcher « étoile »'
);
check(topLabel('symbole') === 'Symbole sur le drapeau', '« symbole » doit proposer le critère du symbole sur le drapeau');
check(topLabel('sans accès à la mer') === 'Pays enclavé (sans mer)', 'une requête niée doit proposer le pays enclavé');
check(topLabel('accès à la mer') === 'Possède un accès à la mer', 'une requête affirmative doit proposer l’accès à la mer');

// Requête ambiguë : plusieurs critères à égalité, l'interface doit demander un choix.
const currencyScores = scoreRules(rules, 'monnaie', 8);
check(currencyScores.length > 1, '« monnaie » doit proposer plusieurs critères');
check(
  currencyScores.filter((item) => item.score === currencyScores[0].score).length > 1,
  '« monnaie » doit rester ambigu (plusieurs scores identiques)'
);
const islandScores = scoreRules(rules, 'ile', 8);
check(islandScores.length === 1 && islandScores[0].score >= 60, '« ile » doit avoir une seule correspondance forte');

// Données : cohérence îles / enclavement / symboles.
check(
  C.every((country) => !(country.borders.length === 0 && country.landlocked === true)),
  'aucune île ne doit être marquée comme pays enclavé'
);
check(
  C.every((country) => !(country.flagStar === true && country.symbolOnFlag !== true)),
  'un drapeau avec étoile doit être marqué comme portant un symbole'
);

// Critère vrai mais sans effet : aucune pénalité.
// En Océanie (14) ⊆ Possède un accès à la mer (150).
const engine2 = new InverseEngine({ countryList: C, rules, catalog, roundPlan: ROUND_PLAN });
const oceania = ruleByLabel('En Océanie');
const seaAccess = ruleByLabel('Possède un accès à la mer');
check([...oceania.set].every((code) => seaAccess.set.has(code)), 'toute l’Océanie doit avoir un accès à la mer');
const oceanSubset = [...oceania.set].slice(0, 6);
loadPuzzle(engine2, makePuzzle(oceanSubset, [oceania, seaAccess], 2));
result = engine2.submitRule(oceania.id);
check(result.status === 'useful', 'Océanie doit être accepté seul');
const beforeImplied = engine2.poolSize;
const livesBeforeImplied = engine2.lives;
result = engine2.submitRule(seaAccess.id);
check(result.status === 'implied', 'un critère déjà impliqué doit être signalé sans pénalité');
check(engine2.poolSize === beforeImplied && engine2.lives === livesBeforeImplied, 'un critère impliqué ne change ni vivier ni vie');
check(engine2.implied.some((rule) => rule.id === seaAccess.id), 'le critère impliqué doit être conservé pour l’affichage');

// ---------------------------------------------------------------------------
// Aide « révéler un contre-exemple » : pays du vivier qui satisfait tous les
// critères déjà énoncés mais qui ne fait pas partie de l'ensemble à isoler.
// ---------------------------------------------------------------------------
const makeRevealEngine = () => {
  const instance = new InverseEngine({ countryList: C, rules, catalog, roundPlan: ROUND_PLAN });
  loadPuzzle(instance, makePuzzle(targetCodes, [south, dollar], 2));
  instance.revealedCodes = new Set();
  instance.revealed = [];
  return instance;
};

const engine4 = makeRevealEngine();
engine4.score = 100;
const poolBeforeReveal = engine4.poolSize;
const livesBeforeReveal = engine4.lives;
let reveal = engine4.revealCounterExample();
check(reveal.status === 'ok', 'un contre-exemple doit être proposé');
check(!targetSet.has(reveal.code), 'le pays révélé ne doit jamais appartenir à l’ensemble');
check(engine4.revealedCodes.has(reveal.code), 'le pays révélé doit être mémorisé');
check(engine4.score === 80, 'un contre-exemple coûte 20 points');
check(engine4.poolSize === poolBeforeReveal && engine4.lives === livesBeforeReveal, 'un contre-exemple ne touche ni au vivier ni aux vies');

const engine5 = makeRevealEngine();
result = engine5.submitRule(south.id);
check(result.status === 'useful', 'hémisphère Sud doit réduire le vivier avant la révélation');
const revealedAfterSouth = engine5.revealCounterExample();
check(revealedAfterSouth.status === 'ok', 'un contre-exemple doit exister après un critère');
check(south.set.has(revealedAfterSouth.code), 'le contre-exemple doit satisfaire le critère déjà énoncé');
check(!targetSet.has(revealedAfterSouth.code), 'le contre-exemple ne doit pas être dans l’ensemble');
check(engine5.currentPoolCodes.has(revealedAfterSouth.code), 'le contre-exemple doit encore être dans le vivier');

// Aucun doublon, et épuisement propre quand tous les pays hors ensemble ont
// été révélés.
let exhausted = engine5.revealCounterExample();
while (exhausted.status === 'ok') {
  check(!targetSet.has(exhausted.code), 'un contre-exemple révélé ne doit pas être dans l’ensemble');
  exhausted = engine5.revealCounterExample();
}
check(exhausted.status === 'none', 'la révélation doit s’arrêter quand tous les candidats sont épuisés');
check(engine5.revealed.length === new Set(engine5.revealed).size, 'les contre-exemples révélés doivent être uniques');
check(
  engine5.revealed.length === engine5.currentPoolCodes.size - targetSet.size,
  'tous les pays du vivier hors ensemble doivent pouvoir être révélés'
);


console.log(`✅ ${checks} vérifications réussies.`);
