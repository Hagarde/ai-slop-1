// Triples sans redondance logique : aucun critère n'implique un autre du trio.
import { buildCriteria } from '../js/criteria.js';
import fs from 'node:fs';

const C = JSON.parse(fs.readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8')).countries;
const crits = buildCriteria(C);
const R = crits.map((c) => ({
  label: c.labelFr,
  type: c.type,
  set: new Set(C.filter((x) => { try { return c.test(x); } catch { return false; } }).map((x) => x.code)),
}));

const inter = (a, b) => new Set([...a].filter((x) => b.has(x)));
const isSubset = (a, b) => a.size < b.size && [...a].every((x) => b.has(x));
const key = (s) => [...s].sort().join(',');
const comp = (r, s) => 1 - s.size / r.set.size;
const BAN = (r) => r.set.size > 90;

// paires de qualité (déjà calculées) pour référence
const pairs = [];
for (let i = 0; i < R.length; i++) {
  for (let j = i + 1; j < R.length; j++) {
    if (BAN(R[i]) || BAN(R[j])) continue;
    const s = inter(R[i].set, R[j].set);
    if (s.size < 10 || s.size > 22) continue;
    if (R[i].set.size === s.size || R[j].set.size === s.size) continue;
    if (comp(R[i], s) < 0.35 || comp(R[j], s) < 0.35) continue;
    pairs.push({ rules: [R[i], R[j]], set: s });
  }
}

const triples = [];
for (let i = 0; i < R.length; i++) {
  if (BAN(R[i])) continue;
  for (let j = i + 1; j < R.length; j++) {
    if (BAN(R[j])) continue;
    if (isSubset(R[i].set, R[j].set) || isSubset(R[j].set, R[i].set)) continue;
    const ij = inter(R[i].set, R[j].set);
    if (ij.size < 10) continue;
    for (let k = j + 1; k < R.length; k++) {
      if (BAN(R[k])) continue;
      if (isSubset(R[k].set, R[i].set) || isSubset(R[i].set, R[k].set)) continue;
      if (isSubset(R[k].set, R[j].set) || isSubset(R[j].set, R[k].set)) continue;
      const s = inter(ij, R[k].set);
      if (s.size < 10 || s.size > 22) continue;
      const ps = [inter(R[i].set, R[j].set).size, inter(R[i].set, R[k].set).size, inter(R[j].set, R[k].set).size];
      if (ps.includes(s.size)) continue;
      if (comp(R[i], s) < 0.35 || comp(R[j], s) < 0.35 || comp(R[k], s) < 0.35) continue;
      triples.push({ rules: [R[i], R[j], R[k]], set: s });
    }
  }
}

const uniq = (arr) => {
  const m = new Map();
  for (const x of arr) {
    const k = key(x.set);
    if (!m.has(k)) m.set(k, { ...x, count: 0 });
    m.get(k).count++;
  }
  return [...m.values()];
};

const up = uniq(pairs);
const ut = uniq(triples);
console.log('Paires uniques :', up.length, '| Triples uniques sans implication :', ut.length);

const exactSingles = (s) => R.filter((r) => r.set.size === s.size && [...s].every((c) => r.set.has(c)));
const show = (x) => {
  console.log('\n###', x.set.size, 'pays —', x.rules.map((r) => r.label).join('  ∩  '));
  console.log('  types:', x.rules.map((r) => r.type).join(' + '), '| singles:', exactSingles(x.set).length);
  console.log('  pays:', C.filter((c) => x.set.has(c.code)).map((c) => c.name).join(', ').slice(0, 560));
};

console.log('\n=== TRIPLES 12-20, types variés ===');
for (const x of ut.filter((x) => x.set.size >= 12 && x.set.size <= 20 && new Set(x.rules.map((r) => r.type)).size >= 2).slice(0, 25)) show(x);

// Répartition des ensembles par taille et par "par" (2 ou 3)
// Un ensemble peut être à la fois paire et triple : par = 2.
const pairsKeys = new Set(up.map((x) => key(x.set)));
const triplesOnly = ut.filter((x) => !pairsKeys.has(key(x.set)));
console.log('\nTriples non réalisables en 2 critères :', triplesOnly.length, '/', ut.length);
console.log('Exemples triples-only :');
for (const x of triplesOnly.filter((x) => x.set.size >= 12 && x.set.size <= 20 && new Set(x.rules.map((r) => r.type)).size >= 2).slice(0, 12)) show(x);
