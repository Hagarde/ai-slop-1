// Vérifications du mode Fil Rouge : catalogue, par, validation et économie.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCriteria } from '../js/criteria.js';
import { buildRuleLibrary, maskFromRule, maskKey, maskAnd, maskCount } from '../js/inverse_rules.js';
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

console.log(`✅ ${checks} vérifications réussies.`);
