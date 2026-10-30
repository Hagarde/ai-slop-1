// Mode Fil Rouge — générateur progressif, validation et économie de run.
//
// Principe de validation : l'ensemble affiché S est une cible. Un critère est
// VALIDE si et seulement si TOUS les pays de S le vérifient. On ne compare
// jamais la saisie à une solution prévue. Le joueur gagne quand l'intersection
// de ses critères ne laisse plus que S.

import { getCountryName } from './i18n.js';
import {
  allCountriesMask,
  createMask,
  maskAnd,
  maskCount,
  maskFromRule,
  maskKey,
  maskToCodes,
} from './inverse_rules.js';

export const MAX_LIVES = 5;
export const START_LIVES = 3;

// Difficulté croissante : le « par » est le nombre minimal de critères qui
// isolent exactement l'ensemble. Il est calculé sur toute la bibliothèque.
export const ROUND_PLAN = [
  { round: 1, par: 2, min: 10, max: 20, labelFr: 'Échauffement', labelEn: 'Warm-up' },
  { round: 2, par: 2, min: 6, max: 12, labelFr: 'Normal', labelEn: 'Normal' },
  { round: 3, par: 3, min: 8, max: 18, labelFr: 'Difficile', labelEn: 'Hard' },
  { round: 4, par: 3, min: 4, max: 10, labelFr: 'Très difficile', labelEn: 'Very hard' },
  { round: 5, par: 3, min: 2, max: 6, labelFr: 'Boss', labelEn: 'Boss' },
];

function coverageQuality(rules, indices, size) {
  const used = indices.map((index) => rules[index]);
  const types = new Set(used.map((rule) => rule.type));
  let score = types.size * 14;
  for (const rule of used) {
    if (rule.obscure) score -= 10;
    if (rule.size > 140) score -= 7;
    if (rule.size - size < 2) score -= 5;
  }
  return score;
}

function addCoverage(map, key, mask, size, indices) {
  let entry = map.get(key);
  if (!entry) {
    entry = { mask: mask.slice(), size, coverages: [] };
    map.set(key, entry);
  }
  if (entry.coverages.length >= 24) return;
  entry.coverages.push({
    indices: indices.slice(),
    quality: 0,
  });
}

function regionCounts(codes, countryByCode) {
  const regions = {};
  for (const code of codes) {
    const country = countryByCode.get(code);
    const region = country?.region || 'Autre';
    regions[region] = (regions[region] || 0) + 1;
  }
  return regions;
}

// Construit l'inventaire des ensembles jouables (2–20 pays) avec leur « par »
// exact. Complexité : ~48 000 triples, soit quelques dizaines de millisecondes.
export function buildPuzzleCatalog(countryList, rules, words) {
  const countryByCode = new Map(countryList.map((country) => [country.code, country]));
  const singleKeys = new Set();
  for (const rule of rules) {
    if (rule.size >= 2 && rule.size <= 20) singleKeys.add(maskKey(rule.mask));
  }

  const pairMap = new Map();
  const pairKeys = new Set();
  const tmp = createMask(words);

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      maskAnd(rules[i].mask, rules[j].mask, tmp);
      const size = maskCount(tmp);
      if (size < 2 || size > 20) continue;

      // Un critère implique l'autre : l'ensemble est déjà isolé par un seul
      // critère. Le « par » vaut 1, on ne l'ajoute pas comme paire.
      if (size === rules[i].size || size === rules[j].size) continue;

      const key = maskKey(tmp);
      pairKeys.add(key);

      // Qualité : chaque critère doit éliminer au moins deux pays.
      if (rules[i].size - size < 2 || rules[j].size - size < 2) continue;
      addCoverage(pairMap, key, tmp, size, [i, j]);
    }
  }

  const tripleMap = new Map();
  const scratch = createMask(words);
  const scratch2 = createMask(words);

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      maskAnd(rules[i].mask, rules[j].mask, tmp);
      const ijSize = maskCount(tmp);
      if (ijSize < 2) continue;

      for (let k = j + 1; k < rules.length; k++) {
        maskAnd(tmp, rules[k].mask, scratch);
        const size = maskCount(scratch);
        if (size < 2 || size > 20) continue;

        // Une des paires du trio isole déjà l'ensemble : par = 2.
        maskAnd(rules[i].mask, rules[k].mask, scratch2);
        const ikSize = maskCount(scratch2);
        if (ikSize === size) continue;
        maskAnd(rules[j].mask, rules[k].mask, scratch2);
        const jkSize = maskCount(scratch2);
        if (jkSize === size) continue;
        if (ijSize === size) continue;

        const key = maskKey(scratch);
        if (singleKeys.has(key) || pairKeys.has(key)) continue; // par < 3

        // Chaque critère doit apporter au moins une exclusion supplémentaire.
        if (jkSize - size < 1 || ikSize - size < 1 || ijSize - size < 1) continue;

        addCoverage(tripleMap, key, scratch, size, [i, j, k]);
      }
    }
  }

  const items = [];

  const finalize = (map, par) => {
    for (const [key, entry] of map) {
      if (par === 2 && singleKeys.has(key)) continue;
      if (par === 3 && (singleKeys.has(key) || pairKeys.has(key))) continue;

      // Le score de couverture dépend des règles : on le recalcule proprement.
      entry.coverages.forEach((coverage) => {
        coverage.quality = coverageQuality(rules, coverage.indices, entry.size);
      });
      entry.coverages.sort((a, b) => b.quality - a.quality);

      const codes = maskToCodes(entry.mask, countryList);
      items.push({
        key,
        mask: entry.mask,
        codes,
        codeSet: new Set(codes),
        size: codes.length,
        par,
        regions: regionCounts(codes, countryByCode),
        coverages: entry.coverages.slice(0, 8).map((coverage) => coverage.indices),
      });
    }
  };

  finalize(pairMap, 2);
  finalize(tripleMap, 3);

  return items;
}

function jaccard(a, b) {
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function candidateScore(item, plan, options) {
  const coverage = item.coverages[0] || [];
  const usedRules = coverage.map((index) => options.rules[index]);
  const types = new Set(usedRules.map((rule) => rule.type));
  const mid = (plan.min + plan.max) / 2;

  let score = 0;
  score -= Math.abs(item.size - mid) * 1.4;
  score += types.size * 9;
  score -= usedRules.filter((rule) => rule.obscure).length * (plan.par === 2 ? 24 : 9);
  score -= usedRules.filter((rule) => rule.size > 140).length * (plan.par === 2 ? 9 : 4);

  for (const rule of usedRules) {
    score -= (options.ruleUse.get(rule.id) || 0) * 7;
  }

  // Évite de refaire trois manches de suite sur le même continent.
  if (options.regionUse) {
    const dominant = Object.entries(item.regions).sort((a, b) => b[1] - a[1])[0];
    if (dominant) score -= (options.regionUse.get(dominant[0]) || 0) * 9;
  }

  let maxSimilarity = 0;
  for (const previous of options.previousSets || []) {
    maxSimilarity = Math.max(maxSimilarity, jaccard(item.codeSet, previous));
  }
  if (maxSimilarity > 0.5) score -= (maxSimilarity - 0.5) * 130;

  return score + Math.random() * 12;
}

export function selectPuzzle(catalog, plan, options = {}) {
  const opts = {
    rules: options.rules || [],
    ruleUse: options.ruleUse || new Map(),
    regionUse: options.regionUse || new Map(),
    previousSets: options.previousSets || [],
    seenKeys: options.seenKeys || new Set(),
  };

  const inRange = (item) => item.size >= plan.min && item.size <= plan.max;
  let pool = catalog.filter((item) => item.par === plan.par && inRange(item) && !opts.seenKeys.has(item.key));
  if (pool.length === 0) pool = catalog.filter((item) => item.par === plan.par && inRange(item));
  if (pool.length === 0) pool = catalog.filter((item) => inRange(item));
  if (pool.length === 0) pool = catalog.filter((item) => item.par === plan.par);
  if (pool.length === 0) pool = catalog.slice();
  if (pool.length === 0) return null;

  const ranked = pool
    .map((item) => ({ item, score: candidateScore(item, plan, opts) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, Math.min(8, ranked.length));
  return top[Math.floor(Math.random() * top.length)].item;
}

export class InverseEngine {
  constructor({ countryList, rules, catalog, roundPlan = ROUND_PLAN }) {
    this.countries = countryList;
    this.rules = rules;
    this.catalog = catalog;
    this.roundPlan = roundPlan;
    this.ruleById = new Map(rules.map((rule) => [rule.id, rule]));
    this.words = Math.ceil(countryList.length / 32);
    this.allMask = allCountriesMask(this.words, countryList.length);
    this.maxLives = MAX_LIVES;
    this.startLives = START_LIVES;
    this.revealedCodes = new Set();
    this.revealed = [];
    this.resetRun();
  }

  resetRun() {
    this.roundIndex = -1;
    this.lives = this.startLives;
    this.score = 0;
    this.roundHistory = [];
    this.seenKeys = new Set();
    this.ruleUse = new Map();
    this.regionUse = new Map();
    this.previousSets = [];
    this.runOver = false;
    this.completed = false;
    this.finalBonus = 0;
    this.startNextRound();
  }

  startNextRound() {
    this.roundIndex += 1;
    if (this.roundIndex >= this.roundPlan.length) {
      this.finishRun(true);
      return null;
    }

    const plan = this.roundPlan[this.roundIndex];
    const puzzle = selectPuzzle(this.catalog, plan, {
      rules: this.rules,
      ruleUse: this.ruleUse,
      regionUse: this.regionUse,
      previousSets: this.previousSets,
      seenKeys: this.seenKeys,
    });

    if (!puzzle) {
      this.finishRun(false);
      return null;
    }

    this.plan = plan;
    this.puzzle = puzzle;
    this.poolMask = this.allMask.slice();
    this.poolSize = this.countries.length;
    this.selected = [];
    this.implied = [];
    this.usedRuleIds = new Set();
    this.wrongCount = 0;
    this.hintUsed = false;
    this.revealedCodes = new Set();
    this.revealed = [];
    this.roundDone = false;
    this.roundWon = false;
    this.roundSummary = null;
    this.currentPoolCodes = new Set(this.countries.map((country) => country.code));
    return puzzle;
  }

  get targetCodes() {
    return this.puzzle ? this.puzzle.codes : [];
  }

  get remainingToExclude() {
    return Math.max(0, this.poolSize - (this.puzzle?.size || 0));
  }

  get canonicalCoverage() {
    if (!this.puzzle) return [];
    return (this.puzzle.coverages[0] || []).map((index) => this.rules[index]);
  }

  get alternativeSolutionCount() {
    if (!this.puzzle) return 0;
    return Math.max(0, this.puzzle.coverages.length - 1);
  }

  getRule(ruleId) {
    return this.ruleById.get(ruleId) || null;
  }

  submitRule(ruleId) {
    if (!this.puzzle || this.roundDone) return { status: 'round-done' };
    const rule = this.getRule(ruleId);
    if (!rule) return { status: 'not-found' };

    if (this.usedRuleIds.has(rule.id)) {
      return { status: 'duplicate', rule };
    }
    this.usedRuleIds.add(rule.id);
    this.ruleUse.set(rule.id, (this.ruleUse.get(rule.id) || 0) + 1);

    // Règle absolue : le critère doit être vrai pour TOUS les pays affichés.
    const counterExamples = this.puzzle.codes.filter((code) => !rule.set.has(code));
    if (counterExamples.length > 0) {
      this.wrongCount += 1;
      this.lives = Math.max(0, this.lives - 1);
      this.score = Math.max(0, this.score - 25);
      const examples = counterExamples.slice(0, 3).map((code) => {
        const country = this.countries.find((item) => item.code === code);
        return getCountryName(country) || code;
      });
      const over = this.lives <= 0;
      if (over) {
        this.roundDone = true;
        this.roundWon = false;
        this.failed = true;
        this.roundSummary = this.buildRoundSummary(false);
      }
      return {
        status: 'wrong',
        rule,
        examples,
        counterExampleCount: counterExamples.length,
        lives: this.lives,
        score: this.score,
        over,
      };
    }

    const before = this.poolSize;
    const nextMask = maskAnd(this.poolMask, rule.mask);
    const after = maskCount(nextMask);

    // Cas rare et anormal : l'ensemble affiché doit toujours être inclus.
    if (after < this.puzzle.size) return { status: 'not-found' };

    this.poolMask = nextMask;
    this.poolSize = after;

    if (after === before) {
      this.implied.push(rule);
      return {
        status: 'implied',
        rule,
        before,
        after,
        lives: this.lives,
        score: this.score,
      };
    }

    const previousPoolCodes = this.currentPoolCodes;
    this.currentPoolCodes = new Set();
    for (const code of previousPoolCodes) {
      if (rule.set.has(code)) this.currentPoolCodes.add(code);
    }

    const usefulCount = this.selected.length + 1;
    const gainedLife = usefulCount <= this.puzzle.par ? 1 : 0;
    if (gainedLife) this.lives = Math.min(this.maxLives, this.lives + 1);
    this.score += 15;
    this.selected.push({
      rule,
      before,
      after,
      removed: before - after,
      gainedLife,
    });

    if (after === this.puzzle.size) {
      this.completeRound();
      return {
        status: 'win',
        rule,
        before,
        after,
        removed: before - after,
        lives: this.lives,
        score: this.score,
        summary: this.roundSummary,
      };
    }

    return {
      status: 'useful',
      rule,
      before,
      after,
      removed: before - after,
      remaining: after - this.puzzle.size,
      lives: this.lives,
      score: this.score,
    };
  }

  completeRound() {
    const par = this.puzzle.par;
    const used = this.selected.length;
    let bonus = 0;
    if (used === par) bonus = 50;
    else if (used === par + 1) bonus = 25;

    let perfectLife = 0;
    if (this.wrongCount === 0 && this.lives < this.maxLives) {
      perfectLife = 1;
      this.lives = Math.min(this.maxLives, this.lives + 1);
    }

    this.score += bonus;
    this.roundDone = true;
    this.roundWon = true;
    this.failed = false;
    this.roundSummary = this.buildRoundSummary(true, bonus, perfectLife);
  }

  buildRoundSummary(won, bonus = 0, perfectLife = 0) {
    return {
      won,
      round: this.roundIndex + 1,
      size: this.puzzle.size,
      par: this.puzzle.par,
      used: this.selected.length,
      wrong: this.wrongCount,
      bonus,
      perfectLife,
      lives: this.lives,
      score: this.score,
      canonicalCoverage: this.canonicalCoverage,
      alternativeSolutions: this.alternativeSolutionCount,
      playerCoverage: this.selected.map((entry) => entry.rule),
      playerEntries: this.selected.map(({ rule, removed }) => ({ rule, removed })),
    };
  }

  recordRound() {
    if (!this.puzzle) return;
    this.seenKeys.add(this.puzzle.key);
    this.previousSets.push(this.puzzle.codeSet);
    const dominant = Object.entries(this.puzzle.regions).sort((a, b) => b[1] - a[1])[0];
    if (dominant) this.regionUse.set(dominant[0], (this.regionUse.get(dominant[0]) || 0) + 1);
    this.roundHistory.push({
      round: this.roundIndex + 1,
      size: this.puzzle.size,
      par: this.puzzle.par,
      used: this.selected.length,
      wrong: this.wrongCount,
      won: this.roundWon,
      score: this.score,
      canonicalCoverage: this.canonicalCoverage,
      playerCoverage: this.selected.map((entry) => entry.rule),
      playerEntries: this.selected.map(({ rule, removed }) => ({ rule, removed })),
    });
  }

  // Passe la manche : coûte une vie, révèle la solution.
  passRound() {
    if (this.roundDone) return { status: 'round-done' };
    this.lives = Math.max(0, this.lives - 1);
    this.score = Math.max(0, this.score - 40);
    this.roundDone = true;
    this.roundWon = false;
    this.failed = true;
    this.roundSummary = this.buildRoundSummary(false);
    return { status: 'passed', lives: this.lives, summary: this.roundSummary };
  }

  hint() {
    if (!this.puzzle || this.roundDone || this.hintUsed) {
      return { status: 'unavailable' };
    }
    this.hintUsed = true;
    this.score = Math.max(0, this.score - 30);
    // L'indice ne révèle plus le critère exact : uniquement sa catégorie.
    // On vise un critère de la solution que le joueur n'a pas encore trouvé.
    const foundIds = new Set(this.selected.map((entry) => entry.rule.id));
    const coverage = this.canonicalCoverage;
    const missing = coverage.find((rule) => !foundIds.has(rule.id)) || coverage[0] || null;
    return { status: 'ok', type: missing ? missing.type : null, score: this.score };
  }

  // Révèle un pays qui satisfait tous les critères déjà énoncés mais qui ne
  // fait pas partie de l'ensemble à isoler. C'est une aide « par l'extérieur » :
  // elle ne dévoile aucun critère, seulement un pays encore présent dans le
  // vivier, donc à exclure pour isoler l'ensemble.
  revealCounterExample() {
    if (!this.puzzle || this.roundDone) {
      return { status: 'unavailable' };
    }

    const candidates = [];
    for (const code of this.currentPoolCodes) {
      if (this.puzzle.codeSet.has(code)) continue;
      if (this.revealedCodes.has(code)) continue;
      candidates.push(code);
    }

    if (candidates.length === 0) {
      return { status: 'none', remaining: 0 };
    }

    const code = candidates[Math.floor(Math.random() * candidates.length)];
    this.revealedCodes.add(code);
    this.revealed.push(code);
    this.score = Math.max(0, this.score - 20);
    const country = this.countries.find((item) => item.code === code) || null;

    return {
      status: 'ok',
      code,
      country,
      // Pays encore à exclure, hors contre-exemples déjà révélés.
      remaining: candidates.length - 1,
      score: this.score,
    };
  }

  continueAfterRound() {
    this.recordRound();
    if (this.lives <= 0) {
      this.finishRun(false);
      return { finished: true, completed: false };
    }
    if (this.roundIndex + 1 >= this.roundPlan.length) {
      this.finishRun(true);
      return { finished: true, completed: true };
    }
    this.startNextRound();
    return { finished: false, completed: null };
  }

  finishRun(completed) {
    if (this.runOver) return;
    this.runOver = true;
    this.completed = completed;
    if (completed) {
      this.finalBonus = this.lives * 50;
      this.score += this.finalBonus;
    }
  }
}
