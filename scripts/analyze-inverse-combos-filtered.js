// Combos 2-3 critères : filtre les combinaisons où chaque critère contraint vraiment.
import { buildCriteria } from '../js/criteria.js';
import fs from 'node:fs';

const C = JSON.parse(fs.readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8')).countries;
const crits = buildCriteria(C);
const sets = crits.map((c) => ({
  id: c.labelFr,
  label: c.labelFr,
  type: c.type,
  set: new Set(C.filter((x) => { try { return c.test(x); } catch { return false; } }).map((x) => x.code)),
}));

const inter = (a, b) => new Set([...a].filter((x) => b.has(x)));
const key = (s) => [...s].sort().join(',');
const sizeOk = (s) => s.size >= 10 && s.size <= 30;
const compression = (r, s) => 1 - s.size / r.set.size;

const pairs = [];
for (let i = 0; i < sets.length; i++) {
  for (let j = i + 1; j < sets.length; j++) {
    const a = sets[i], b = sets[j];
    const s = inter(a.set, b.set);
    if (!sizeOk(s)) continue;
    if (a.set.size === s.size || b.set.size === s.size) continue;
    if (compression(a, s) < 0.30 || compression(b, s) < 0.30) continue;
    pairs.push({ rules: [a, b], set: s });
  }
}

const triples = [];
for (let i = 0; i < sets.length; i++) {
  for (let j = i + 1; j < sets.length; j++) {
    const ij = inter(sets[i].set, sets[j].set);
    if (ij.size < 10) continue;
    for (let k = j + 1; k < sets.length; k++) {
      const s = inter(ij, sets[k].set);
      if (!sizeOk(s)) continue;
      if (ij.size === s.size || inter(sets[i].set, sets[k].set).size === s.size || inter(sets[j].set, sets[k].set).size === s.size) continue;
      if (compression(sets[i], s) < 0.25 || compression(sets[j], s) < 0.25 || compression(sets[k], s) < 0.25) continue;
      triples.push({ rules: [sets[i], sets[j], sets[k]], set: s });
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
console.log('Paires filtrées :', pairs.length, '| ensembles uniques :', up.length);
console.log('Triples filtrés :', triples.length, '| ensembles uniques :', ut.length);

const closure = (s) => sets.filter((r) => [...s].every((code) => r.set.has(code)));
const exactSingles = (s) => sets.filter((r) => r.set.size === s.size && [...s].every((c) => r.set.has(c)));

// Distribution par catégories de critères (pour voir la diversité)
const typeCombos = {};
for (const x of [...up, ...ut]) {
  const k = x.rules.map((r) => r.type).sort().join('+');
  typeCombos[k] = (typeCombos[k] || 0) + 1;
}
console.log('\n--- Types de combos (top 15) ---');
for (const [k, v] of Object.entries(typeCombos).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(v).padStart(4), k);

const show = (x) => {
  const cl = closure(x.set);
  const ex = exactSingles(x.set);
  console.log('\n###', x.set.size, 'pays —', x.rules.map((r) => r.label).join('  ∩  '));
  console.log('  types:', x.rules.map((r) => r.type).join(' + '), '| fermeture:', cl.length, '| réponse 1 critère:', ex.length);
  console.log('  pays:', C.filter((c) => x.set.has(c.code)).map((c) => c.name).join(', ').slice(0, 520));
};

console.log('\n=== PAIRES 12-22 pays, types différents, sans réponse à 1 critère ===');
const goodPairs = up
  .filter((x) => x.set.size >= 12 && x.set.size <= 22)
  .filter((x) => new Set(x.rules.map((r) => r.type)).size > 1)
  .filter((x) => exactSingles(x.set).length === 0)
  .sort((a, b) => a.set.size - b.set.size);
for (const x of goodPairs.slice(0, 20)) show(x);

console.log('\n=== TRIPLES 10-20 pays, types variés, sans réponse à 1 critère ===');
const goodTriples = ut
  .filter((x) => x.set.size >= 10 && x.set.size <= 20)
  .filter((x) => new Set(x.rules.map((r) => r.type)).size >= 2)
  .filter((x) => exactSingles(x.set).length === 0)
  .sort((a, b) => a.set.size - b.set.size);
for (const x of goodTriples.slice(0, 20)) show(x);
