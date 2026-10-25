// Triples de qualité : pas de critère-parapluie, chaque critère compresse fortement.
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
const comp = (r, s) => 1 - s.size / r.set.size;
const BAN = (r) => r.set.size > 90; // parapluies : hémisphère, accès à la mer, non-OCDE...

const triples = [];
for (let i = 0; i < sets.length; i++) {
  if (BAN(sets[i])) continue;
  for (let j = i + 1; j < sets.length; j++) {
    if (BAN(sets[j])) continue;
    const ij = inter(sets[i].set, sets[j].set);
    if (ij.size < 10) continue;
    for (let k = j + 1; k < sets.length; k++) {
      if (BAN(sets[k])) continue;
      const s = inter(ij, sets[k].set);
      if (s.size < 10 || s.size > 22) continue;
      const pairSizes = [
        inter(sets[i].set, sets[j].set).size,
        inter(sets[i].set, sets[k].set).size,
        inter(sets[j].set, sets[k].set).size,
      ];
      if (pairSizes.includes(s.size)) continue; // un des critères est redondant
      if (comp(sets[i], s) < 0.35 || comp(sets[j], s) < 0.35 || comp(sets[k], s) < 0.35) continue;
      triples.push({ rules: [sets[i], sets[j], sets[k]], set: s });
    }
  }
}

const m = new Map();
for (const x of triples) {
  const k = key(x.set);
  if (!m.has(k)) m.set(k, { ...x, count: 0 });
  m.get(k).count++;
}
const uniq = [...m.values()].sort((a, b) => a.set.size - b.set.size);
console.log('Triples qualité :', triples.length, '| ensembles uniques :', uniq.length);

const exactSingles = (s) => sets.filter((r) => r.set.size === s.size && [...s].every((c) => r.set.has(c)));
const show = (x) => {
  console.log('\n###', x.set.size, 'pays —', x.rules.map((r) => r.label).join('  ∩  '));
  console.log('  types:', x.rules.map((r) => r.type).join(' + '), '| réponse 1 critère:', exactSingles(x.set).length);
  console.log('  pays:', C.filter((c) => x.set.has(c.code)).map((c) => c.name).join(', ').slice(0, 620));
};

console.log('\n=== 20 meilleurs triples (diversité de types) ===');
for (const x of uniq.filter((x) => new Set(x.rules.map((r) => r.type)).size >= 2).slice(0, 20)) show(x);

// Distribution des tailles
const dist = {};
for (const x of uniq) dist[x.set.size] = (dist[x.set.size] || 0) + 1;
console.log('\nTailles :', dist);
