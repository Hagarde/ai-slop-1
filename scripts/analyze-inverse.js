// Analyse de faisabilité du mode inversé (set de pays -> point commun).
// Usage : node scripts/analyze-inverse.js
import { buildCriteria } from '../js/criteria.js';
import fs from 'node:fs';

const C = JSON.parse(fs.readFileSync(new URL('../data/countries.json', import.meta.url), 'utf8')).countries;
const crits = buildCriteria(C);
const R = [];
const add = (id, label, list, family) =>
  R.push({ id, label, family, set: new Set(list.map((c) => c.code)), size: list.length });

for (const c of crits) {
  const l = C.filter((x) => { try { return c.test(x); } catch { return false; } });
  if (l.length >= 10 && l.length <= 30) add('crit:' + c.labelFr, c.labelFr, l, 'critere/' + c.type);
}

const by = (fn) => {
  const m = new Map();
  for (const c of C) for (const k of fn(c)) {
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(c);
  }
  return m;
};

for (const [s, l] of by((c) => [c.subregion]))
  if (l.length >= 10 && l.length <= 30) add('sub:' + s, 'Sous-région ' + s, l, 'subregion');
for (const [lang, l] of by((c) => c.languages.map((x) => x.trim())))
  if (l.length >= 10 && l.length <= 30) add('lang:' + lang, 'Langue ' + lang, l, 'langue');
for (const [cur, l] of by((c) => c.currencies.map((x) => x.code)))
  if (l.length >= 10 && l.length <= 30) add('cur:' + cur, 'Monnaie ' + cur, l, 'monnaie');

const bc = new Map(C.map((c) => [c.code, c]));
for (const c of C) {
  const l = c.borders.map((b) => bc.get(b.code)).filter(Boolean);
  if (l.length >= 10 && l.length <= 30) add('neigh:' + c.code, 'Voisins de ' + c.name, l, 'voisins');
}

for (const lang of ['name', 'nameEnglish']) {
  const m = by((c) => [c[lang][0].toUpperCase()]);
  for (const [ch, l] of m)
    if (l.length >= 10 && l.length <= 30) add('init:' + lang + ':' + ch, 'Nom commence par ' + ch, l, 'initiale');
}

const bools = Object.keys(C[0]).filter((k) => typeof C[0][k] === 'boolean');
for (const r of [...new Set(C.map((c) => c.region))])
  for (const b of bools) {
    const l = C.filter((c) => c.region === r && c[b]);
    if (l.length >= 10 && l.length <= 30) add('rx:' + r + ':' + b, r + ' + ' + b, l, 'croise');
  }

console.log('Règles pool :', R.length);

let exact = 0;
let supPairs = 0;
for (let i = 0; i < R.length; i++)
  for (let j = 0; j < R.length; j++) {
    if (i === j) continue;
    const a = R[i].set;
    const b = R[j].set;
    if (a.size === b.size && [...a].every((x) => b.has(x))) exact++;
    const inter = [...a].filter((x) => b.has(x)).length;
    if (inter === a.size && a.size < b.size && b.size - a.size <= 5) supPairs++;
  }
console.log('Paires d\'extensions identiques :', exact / 2);
console.log('Inclusions strictes (diff <= 5) :', supPairs);

const risky = R.map((a) => {
  let n = 0;
  for (const b of R) {
    if (b === a) continue;
    const inter = [...a.set].filter((x) => b.set.has(x)).length;
    if (inter === a.size && b.size > a.size && b.size - a.size <= 5) n++;
  }
  return { a, n };
}).filter((x) => x.n >= 3).sort((x, y) => y.n - x.n);

console.log('--- Sets avec >= 3 sur-ensembles proches (ambiguïté potentielle) ---');
for (const { a, n } of risky.slice(0, 25)) console.log(n, a.size, a.label);

const fam = {};
for (const r of R) fam[r.family] = (fam[r.family] || 0) + 1;
console.log('--- Familles ---');
console.log(fam);

const dist = {};
for (const r of R) dist[r.size] = (dist[r.size] || 0) + 1;
console.log('--- Tailles ---');
console.log(dist);
