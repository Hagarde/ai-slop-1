// Explore les combinaisons de 2 et 3 critères donnant 10 à 30 pays.
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

// paires : exclure les inclusions (l'un implique l'autre) et les ensembles identiques
const pairs = [];
for (let i = 0; i < sets.length; i++) {
  for (let j = i + 1; j < sets.length; j++) {
    const a = sets[i], b = sets[j];
    const s = inter(a.set, b.set);
    if (!sizeOk(s)) continue;
    if (a.set.size === s.size || b.set.size === s.size) continue; // redondant
    pairs.push({ rules: [a, b], set: s });
  }
}

// triples minimaux : aucune paire du trio ne donne déjà l'ensemble
const triples = [];
for (let i = 0; i < sets.length; i++) {
  for (let j = i + 1; j < sets.length; j++) {
    const ij = inter(sets[i].set, sets[j].set);
    if (ij.size < 10) continue;
    for (let k = j + 1; k < sets.length; k++) {
      const s = inter(ij, sets[k].set);
      if (!sizeOk(s)) continue;
      if (ij.size === s.size || inter(sets[i].set, sets[k].set).size === s.size || inter(sets[j].set, sets[k].set).size === s.size) continue;
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

console.log('Paires 10-30 (brutes) :', pairs.length, '| ensembles uniques :', up.length);
console.log('Triples 10-30 (brutes) :', triples.length, '| ensembles uniques :', ut.length);

// Fermeture : critères vrais pour tous les pays de l'ensemble
const closure = (s) => sets.filter((r) => [...s].every((code) => r.set.has(code)));

const show = (x, n = 12) => {
  const cl = closure(x.set);
  console.log('\n###', x.set.size, 'pays —', x.rules.map((r) => r.label).join('  ∩  '));
  console.log('Fermeture (' + cl.length + ') :', cl.map((r) => r.label).join(' | ').slice(0, 600));
  console.log('Pays :', C.filter((c) => x.set.has(c.code)).map((c) => c.name).join(', ').slice(0, 700));
};

console.log('\n=== ÉCHANTILLON PAIRES (ensembles uniques, 10-20 pays) ===');
for (const x of up.filter((x) => x.set.size <= 20).slice(0, 15)) show(x);

console.log('\n=== ÉCHANTILLON TRIPLES (ensembles uniques, 10-20 pays) ===');
for (const x of ut.filter((x) => x.set.size <= 20).slice(0, 15)) show(x);
