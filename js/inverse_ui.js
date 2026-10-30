// Mode Fil Rouge — interface du jeu d'isolation d'ensemble.

import { allCriteria, countries } from './data.js';
import { escapeHtml } from './utils.js';
import { getCountryName, getLanguage, onLanguageChange, t } from './i18n.js';
import {
  buildRuleLibrary,
  getRuleDescription,
  getRuleLabel,
  getTypeIcon,
  getTypeLabel,
  maskFromRule,
  searchRules,
} from './inverse_rules.js';
import { buildPuzzleCatalog, InverseEngine, ROUND_PLAN } from './inverse.js';

const BEST_KEY = 'cdoku_inverse_best';
const SECTION_ID = 'inverse-section';

let rules = [];
let catalog = null;
let engine = null;
let ready = false;
let building = false;
let feedbackState = { render: () => '', kind: 'info' };
let active = false;

const TYPE_ORDER = ['geography', 'economy', 'linguistic', 'flag', 'history'];

const $ = (selector) => document.querySelector(selector);

function setFeedback(render, kind = 'info') {
  feedbackState = { render, kind };
  renderFeedback();
}

function setFeedbackKey(key, params = {}, kind = 'info') {
  setFeedback(() => t(key, params), kind);
}

function renderFeedback() {
  const element = $('#inverse-feedback');
  if (!element) return;
  element.textContent = feedbackState.render();
  element.className = `inverse-feedback ${feedbackState.kind}`;
}

function getBestScore() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (error) {
    return 0;
  }
}

function saveBestScore(score) {
  const best = getBestScore();
  if (score <= best) return false;
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch (error) {
    // localStorage indisponible : on continue sans persistance.
  }
  return true;
}

function countryChip(country) {
  // Pas de drapeau ici : il donnerait des indices sur les critères « drapeau ».
  return `<span class="inverse-country-chip">${escapeHtml(getCountryName(country))}</span>`;
}

function ruleChip(rule, extraClass = '') {
  return `<span class="inverse-rule-chip ${extraClass}"><span aria-hidden="true">${escapeHtml(getTypeIcon(rule.type))}</span><span>${escapeHtml(getRuleLabel(rule))}</span></span>`;
}

function renderHud() {
  if (!engine) return;
  const roundEl = $('#inverse-round');
  const livesEl = $('#inverse-lives');
  const scoreEl = $('#inverse-score');
  if (roundEl) {
    roundEl.textContent = t('inverse.round_of', {
      current: Math.min(engine.roundIndex + 1, engine.roundPlan.length),
      total: engine.roundPlan.length,
    });
  }
  if (livesEl) {
    const lives = Math.max(0, engine.lives);
    livesEl.textContent = `${'❤️'.repeat(lives)}${'🖤'.repeat(Math.max(0, engine.maxLives - lives))}`;
    livesEl.setAttribute('aria-label', t('inverse.lives_value', { count: lives, max: engine.maxLives }));
  }
  if (scoreEl) scoreEl.textContent = String(engine.score);
}

function renderTarget() {
  if (!engine?.puzzle) return;
  const countEl = $('#inverse-target-count');
  const grid = $('#inverse-target-countries');
  const countriesSorted = engine.puzzle.codes
    .map((code) => countries.find((country) => country.code === code))
    .filter(Boolean)
    .sort((a, b) => getCountryName(a).localeCompare(getCountryName(b), getLanguage() === 'en' ? 'en' : 'fr'));

  if (countEl) countEl.textContent = t('inverse.target_count', { count: engine.puzzle.size });
  if (grid) grid.innerHTML = countriesSorted.map(countryChip).join('');
}

function renderPool() {
  if (!engine?.puzzle) return;
  const total = engine.countries.length;
  const target = engine.puzzle.size;
  const poolCount = $('#inverse-pool-count');
  const remaining = $('#inverse-remaining');
  const fill = $('#inverse-progress-fill');

  if (poolCount) {
    poolCount.textContent = t('inverse.pool_count', { count: engine.poolSize, total });
  }
  const denominator = Math.max(1, total - target);
  const progress = Math.max(0, Math.min(1, (total - engine.poolSize) / denominator));
  if (fill) fill.style.width = `${Math.round(progress * 100)}%`;

  if (remaining) {
    if (engine.remainingToExclude === 0) {
      remaining.textContent = t('inverse.remaining_none');
    } else {
      remaining.textContent = t('inverse.remaining', { count: engine.remainingToExclude });
    }
  }
}

function renderCriteria() {
  const list = $('#inverse-criteria-list');
  const impliedWrap = $('#inverse-implied-wrap');
  const impliedList = $('#inverse-implied-list');
  if (!list) return;

  if (!engine || engine.selected.length === 0) {
    list.innerHTML = `<p class="inverse-muted">${escapeHtml(t('inverse.criteria_empty'))}</p>`;
  } else {
    list.innerHTML = engine.selected.map((entry) => `
      <div class="inverse-criterion-item">
        <span class="inverse-criterion-icon" aria-hidden="true">${escapeHtml(getTypeIcon(entry.rule.type))}</span>
        <div class="inverse-criterion-copy">
          <strong>${escapeHtml(getRuleLabel(entry.rule))}</strong>
          <small>${escapeHtml(t('inverse.removed', { count: entry.removed }))} • ${escapeHtml(getTypeLabel(entry.rule.type))}</small>
        </div>
        ${entry.gainedLife ? '<span class="inverse-life-gain">+1 ❤️</span>' : ''}
      </div>
    `).join('');
  }

  if (impliedWrap && impliedList) {
    if (engine && engine.implied.length > 0) {
      impliedWrap.classList.remove('hidden');
      impliedList.innerHTML = engine.implied.map((rule) => ruleChip(rule, 'muted')).join('');
    } else {
      impliedWrap.classList.add('hidden');
      impliedList.innerHTML = '';
    }
  }
}

function renderRevealed() {
  const wrap = $('#inverse-revealed-wrap');
  const list = $('#inverse-revealed-list');
  if (!wrap || !list) return;

  const codes = engine?.revealed || [];
  if (codes.length === 0) {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  wrap.classList.remove('hidden');
  list.innerHTML = codes.map((code) => {
    const country = countries.find((item) => item.code === code);
    return `<span class="inverse-country-chip inverse-revealed-chip">${escapeHtml(country ? getCountryName(country) : code)}</span>`;
  }).join('');
}

function renderAll() {
  renderHud();
  renderTarget();
  renderPool();
  renderCriteria();
  renderRevealed();
  renderRuleTable();
  renderFeedback();
  renderResult();
}

function ruleCell(rule, used, locked) {
  const disabled = used || locked;
  return `
    <button
      type="button"
      class="inverse-rule-cell${used ? ' used' : ''}"
      data-rule-id="${escapeHtml(rule.id)}"
      title="${escapeHtml(getRuleDescription(rule))}"
      ${disabled ? 'disabled aria-disabled="true"' : ''}
    >
      <span class="inverse-rule-cell-label">${escapeHtml(getRuleLabel(rule))}</span>
      ${used ? `<span class="inverse-rule-cell-mark" aria-hidden="true">✓</span>` : ''}
    </button>
  `;
}

// Tableau des critères : une colonne par catégorie de contrainte.
// Avec un filtre actif, on bascule sur une liste plate triée par pertinence.
function renderRuleTable() {
  const table = $('#inverse-rule-table');
  const countEl = $('#inverse-rule-count');
  if (!table) return;

  if (!ready) {
    table.classList.remove('filtered');
    table.innerHTML = `<p class="inverse-muted">${escapeHtml(t('inverse.loading'))}</p>`;
    return;
  }

  const query = ($('#inverse-rule-filter')?.value || '').trim();
  const usedIds = engine?.usedRuleIds || new Set();
  const locked = !engine || engine.roundDone || Boolean(engine.runOver);

  if (query) {
    const matching = searchRules(rules, query, rules.length);
    if (countEl) countEl.textContent = t('inverse.rule_count', { count: matching.length });
    table.classList.add('filtered');
    if (matching.length === 0) {
      table.innerHTML = `<p class="inverse-rule-empty">${escapeHtml(t('inverse.rule_none'))}</p>`;
      return;
    }
    table.innerHTML = `<div class="inverse-rule-results">${matching
      .map((rule) => ruleCell(rule, usedIds.has(rule.id), locked))
      .join('')}</div>`;
    return;
  }

  table.classList.remove('filtered');
  if (countEl) countEl.textContent = t('inverse.rule_count', { count: rules.length });

  const byType = new Map(TYPE_ORDER.map((type) => [type, []]));
  sortRulesByType(rules).forEach((rule) => {
    if (!byType.has(rule.type)) byType.set(rule.type, []);
    byType.get(rule.type).push(rule);
  });

  table.innerHTML = [...byType.entries()]
    .filter(([, items]) => items.length > 0)
    .map(([type, items]) => `
      <div class="inverse-rule-column">
        <div class="inverse-rule-column-head">
          <span class="inverse-rule-column-icon" aria-hidden="true">${escapeHtml(getTypeIcon(type))}</span>
          <span class="inverse-rule-column-name">${escapeHtml(getTypeLabel(type))}</span>
          <span class="inverse-rule-column-count">${items.length}</span>
        </div>
        <div class="inverse-rule-column-list">
          ${items.map((rule) => ruleCell(rule, usedIds.has(rule.id), locked)).join('')}
        </div>
      </div>
    `)
    .join('');
}

function applyRuleFromTable(ruleId) {
  if (!engine || engine.roundDone) return;
  const rule = rules.find((item) => item.id === ruleId);
  if (!rule || engine.usedRuleIds.has(rule.id)) return;
  applyRule(rule);
}

function sortRulesByType(ruleList) {
  const locale = getLanguage() === 'en' ? 'en' : 'fr';
  return [...ruleList].sort((a, b) => {
    const typeDelta = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    if (typeDelta !== 0) return typeDelta;
    return getRuleLabel(a).localeCompare(getRuleLabel(b), locale);
  });
}

// Sur mobile, le tableau occupe presque tout l'écran : on remonte le retour
// d'action pour qu'il soit visible juste après le clic.
function bringFeedbackIntoView() {
  if (!window.matchMedia('(max-width: 900px)').matches) return;
  $('#inverse-feedback')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setControlsEnabled(enabled) {
  ['#inverse-rule-filter', '#inverse-hint-btn', '#inverse-reveal-btn', '#inverse-pass-btn'].forEach((selector) => {
    const element = $(selector);
    if (!element) return;
    if (selector === '#inverse-hint-btn') {
      element.disabled = !enabled || Boolean(engine?.hintUsed);
    } else {
      element.disabled = !enabled;
    }
  });
}

function focusFilter() {
  const input = $('#inverse-rule-filter');
  if (input && !input.disabled) {
    input.focus({ preventScroll: true });
  }
}

function submitCurrentRule() {
  if (!ready || !engine || engine.roundDone || engine.runOver) return;
  const input = $('#inverse-rule-filter');
  if (!input) return;

  const query = input.value.trim();
  if (!query) return;

  const matching = searchRules(rules, query, rules.length);
  if (matching.length === 0) {
    setFeedbackKey('inverse.no_match', {}, 'info');
    return;
  }
  if (matching.length > 1) {
    // Pas de devinette : le joueur clique le critère exact dans la liste filtrée.
    setFeedbackKey('inverse.multiple_matches', {}, 'info');
    renderRuleTable();
    return;
  }

  input.value = '';
  applyRule(matching[0]);
  focusFilter();
}

function applyRule(rule) {
  const result = engine.submitRule(rule.id);

  switch (result.status) {
    case 'wrong': {
      const examples = result.examples.join(', ');
      const label = getRuleLabel(rule);
      if (result.counterExampleCount > result.examples.length) {
        setFeedback(
          () => t('inverse.feedback_wrong_many', { rule: label, count: result.counterExampleCount, countries: examples }),
          'wrong'
        );
      } else {
        setFeedback(
          () => t('inverse.feedback_wrong', { rule: label, countries: examples }),
          'wrong'
        );
      }
      break;
    }
    case 'implied':
      setFeedback(() => t('inverse.feedback_implied', { rule: getRuleLabel(rule) }), 'info');
      break;
    case 'useful':
      setFeedback(
        () => t('inverse.feedback_useful', {
          rule: getRuleLabel(rule),
          count: result.removed,
          remaining: result.remaining,
        }),
        'correct'
      );
      break;
    case 'win':
      setFeedback(
        () => t('inverse.feedback_win', { used: engine.selected.length }),
        'correct'
      );
      break;
    case 'duplicate':
      setFeedbackKey('inverse.feedback_duplicate', {}, 'info');
      break;
    case 'round-done':
      break;
    case 'not-found':
    default:
      setFeedbackKey('inverse.no_match', {}, 'info');
      break;
  }

  renderAll();
  if (engine.roundDone) {
    setControlsEnabled(false);
    const resultCard = $('#inverse-round-result');
    if (resultCard) {
      setTimeout(() => resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 40);
    }
    return;
  }
  bringFeedbackIntoView();
}

function coverageChips(coverage) {
  return `<div class="inverse-rule-chip-list">${coverage.map((rule) => ruleChip(rule)).join('')}</div>`;
}

function playerEntryChips(entries) {
  return `<div class="inverse-rule-chip-list">${entries.map(({ rule, removed }) => `
    <span class="inverse-rule-chip">
      <span aria-hidden="true">${escapeHtml(getTypeIcon(rule.type))}</span>
      <span>${escapeHtml(getRuleLabel(rule))}</span>
      ${Number.isFinite(removed) ? `<span class="inverse-rule-chip-meta">−${removed}</span>` : ''}
    </span>
  `).join('')}</div>`;
}

function getPlayerEntries(summary) {
  if (Array.isArray(summary.playerEntries)) return summary.playerEntries;
  return (summary.playerCoverage || []).map((rule) => ({ rule }));
}

function renderResult() {
  const card = $('#inverse-round-result');
  if (!card) return;

  if (!engine || engine.runOver) {
    renderRunOver(card);
    return;
  }
  if (!engine.roundDone || !engine.roundSummary) {
    card.classList.add('hidden');
    card.innerHTML = '';
    return;
  }

  const summary = engine.roundSummary;
  const won = summary.won;
  const playerEntries = getPlayerEntries(summary);
  card.classList.remove('hidden');
  card.classList.toggle('won', won);
  card.classList.toggle('lost', !won);

  const canonicalIds = summary.canonicalCoverage.map((rule) => rule.id).sort().join(',');
  const playerIds = playerEntries.map(({ rule }) => rule.id).sort().join(',');
  const showPlayer = playerEntries.length > 0 && (!won || playerIds !== canonicalIds);

  const solutionTitle = won
    ? t('inverse.result_canonical', { par: summary.par })
    : t('inverse.result_solution');

  const nextLabel = engine.lives <= 0 ? t('inverse.see_results') : t('inverse.next_round');

  card.innerHTML = `
    <div class="inverse-result-head">
      <span class="inverse-result-kicker">${escapeHtml(t('inverse.result_round', { round: summary.round }))}</span>
      <h2>${escapeHtml(won ? t('inverse.result_won_title') : t('inverse.result_failed_title'))}</h2>
      <p>${escapeHtml(t('inverse.result_stats', {
        used: summary.used,
        wrong: summary.wrong,
      }))}</p>
    </div>
    ${won ? `<p class="inverse-result-note">${escapeHtml(t('inverse.result_par_won', { par: summary.par }))}</p>` : ''}
    <div class="inverse-result-block inverse-solution-block">
      <h3>${escapeHtml(solutionTitle)}</h3>
      ${coverageChips(summary.canonicalCoverage)}
      ${won ? '' : `<p class="inverse-muted">${escapeHtml(t('inverse.result_solution_note', { count: summary.canonicalCoverage.length }))}</p>`}
      ${summary.alternativeSolutions > 0
        ? `<p class="inverse-muted">${escapeHtml(t('inverse.result_alternatives', { count: summary.alternativeSolutions }))}</p>`
        : ''}
    </div>
    ${showPlayer ? `
      <div class="inverse-result-block">
        <h3>${escapeHtml(t(won ? 'inverse.result_your_solution' : 'inverse.result_good_answers'))}</h3>
        ${playerEntryChips(playerEntries)}
      </div>
    ` : (!won ? `
      <div class="inverse-result-block">
        <h3>${escapeHtml(t('inverse.result_good_answers'))}</h3>
        <p class="inverse-muted">${escapeHtml(t('inverse.result_no_good_answers'))}</p>
      </div>
    ` : '')}
    ${summary.perfectLife ? `<div class="inverse-result-bonuses"><span>${escapeHtml(t('inverse.result_perfect'))}</span></div>` : ''}
    <button type="button" class="primary-button inverse-next-btn" data-inverse-action="next">${escapeHtml(nextLabel)}</button>
  `;
  setControlsEnabled(false);
}

function renderRunRound(entry) {
  const won = entry.won;
  const solution = won
    ? (entry.playerCoverage || [])
    : (entry.canonicalCoverage || []);
  const playerEntries = Array.isArray(entry.playerEntries)
    ? entry.playerEntries
    : (entry.playerCoverage || []).map((rule) => ({ rule }));

  return `
    <div class="inverse-run-round ${won ? 'won' : 'lost'}">
      <div class="inverse-run-round-head">
        <strong>${escapeHtml(t('inverse.run_round', { round: entry.round }))}</strong>
        <span class="inverse-run-round-status">${escapeHtml(t(won ? 'inverse.run_round_won' : 'inverse.run_round_lost'))}</span>
        <span class="inverse-run-round-count">${escapeHtml(t('inverse.result_stats', { used: entry.used, wrong: entry.wrong }))}</span>
      </div>
      <div class="inverse-run-round-line">
        <span class="inverse-run-round-label">${escapeHtml(t(won ? 'inverse.run_round_your_solution' : 'inverse.run_round_solution'))}</span>
        ${coverageChips(solution)}
      </div>
      ${!won && playerEntries.length > 0 ? `
        <div class="inverse-run-round-line">
          <span class="inverse-run-round-label">${escapeHtml(t('inverse.run_round_good_answers'))}</span>
          ${playerEntryChips(playerEntries)}
        </div>
      ` : ''}
    </div>
  `;
}

function renderRunOver(card) {
  if (!engine?.runOver) {
    card.classList.add('hidden');
    card.innerHTML = '';
    return;
  }

  const bestBefore = getBestScore();
  const isNewBest = saveBestScore(engine.score);
  const best = Math.max(bestBefore, engine.score);
  const history = engine.roundHistory || [];
  const roundsWon = history.filter((entry) => entry.won).length;

  card.classList.remove('hidden');
  card.classList.remove('lost');
  card.classList.add(engine.completed ? 'won' : 'lost');
  card.innerHTML = `
    <div class="inverse-result-head">
      <span class="inverse-result-kicker">${escapeHtml(t('inverse.run_kicker'))}</span>
      <h2>${escapeHtml(engine.completed ? t('inverse.run_win_title') : t('inverse.run_over_title'))}</h2>
      <p>${escapeHtml(t('inverse.run_rounds', { won: roundsWon, total: engine.roundPlan.length }))}</p>
    </div>
    <div class="inverse-run-recap">
      <h3>${escapeHtml(t('inverse.run_recap_title'))}</h3>
      ${history.map(renderRunRound).join('')}
    </div>
    <p class="inverse-muted">${escapeHtml(t('inverse.run_best', { score: best }))}${isNewBest ? ` • ${escapeHtml(t('inverse.run_new_best'))}` : ''}</p>
    <button type="button" class="primary-button inverse-next-btn" data-inverse-action="again">${escapeHtml(t('inverse.play_again'))}</button>
  `;
  setControlsEnabled(false);
}

function setInitialFeedback() {
  if (!engine?.puzzle) return;
  setFeedbackKey('inverse.feedback_goal', { count: engine.puzzle.size }, 'info');
}

function startNewRun() {
  if (!engine) return;
  engine.resetRun();
  const filter = $('#inverse-rule-filter');
  if (filter) filter.value = '';
  setInitialFeedback();
  renderAll();
  setControlsEnabled(!engine.roundDone);
  focusFilter();
}

function buildMode() {
  if (ready || building) return;
  building = true;
  setFeedbackKey('inverse.loading', {}, 'info');

  setTimeout(() => {
    try {
      const library = buildRuleLibrary(countries, allCriteria);
      const words = Math.ceil(countries.length / 32);
      for (const rule of library.rules) {
        rule.mask = maskFromRule(rule, words, library.indexByCode);
      }
      rules = library.rules;
      catalog = buildPuzzleCatalog(countries, rules, words);
      engine = new InverseEngine({ countryList: countries, rules, catalog, roundPlan: ROUND_PLAN });
      ready = true;
      building = false;
      setInitialFeedback();
      renderAll();
      setControlsEnabled(true);
      focusFilter();
    } catch (error) {
      building = false;
      console.error('Mode Fil Rouge : impossible de construire le vivier.', error);
      setFeedbackKey('inverse.build_error', {}, 'wrong');
    }
  }, 30);
}

export function openInverseMode() {
  const section = document.getElementById(SECTION_ID);
  if (!section) return;

  active = true;
  section.classList.remove('hidden');
  document.querySelector('.intro-section')?.classList.add('hidden');
  document.querySelector('.game-section')?.classList.add('hidden');
  document.querySelector('#hardcore-banner')?.classList.add('hidden');

  const tabs = ['mode-solo-tab', 'mode-hardcore-tab', 'mode-multi-tab', 'mode-br-tab'];
  tabs.forEach((id) => document.getElementById(id)?.classList.remove('active'));
  document.getElementById('mode-inverse-tab')?.classList.add('active');

  if (!ready) {
    setFeedbackKey('inverse.loading', {}, 'info');
    buildMode();
    return;
  }

  renderAll();
  setControlsEnabled(!engine.roundDone);
  if (!engine.roundDone) focusFilter();
}

export function closeInverseMode() {
  if (!active) return;
  active = false;
  document.getElementById(SECTION_ID)?.classList.add('hidden');
  document.querySelector('.intro-section')?.classList.remove('hidden');
  document.querySelector('.game-section')?.classList.remove('hidden');
  document.getElementById('mode-inverse-tab')?.classList.remove('active');

  const hardcoreTab = document.getElementById('mode-hardcore-tab');
  const hardcoreBanner = document.getElementById('hardcore-banner');
  if (hardcoreBanner) {
    hardcoreBanner.classList.toggle('hidden', !hardcoreTab?.classList.contains('active'));
  }
}

export function isInverseModeOpen() {
  return active;
}

export function initInverseMode() {
  if (!$(`#${SECTION_ID}`)) return;

  $('#inverse-rule-filter')?.addEventListener('input', renderRuleTable);
  $('#inverse-rule-filter')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCurrentRule();
    } else if (event.key === 'Escape') {
      const input = $('#inverse-rule-filter');
      if (input) input.value = '';
      renderRuleTable();
    }
  });

  $('#inverse-rule-table')?.addEventListener('click', (event) => {
    const button = event.target.closest('.inverse-rule-cell');
    if (!button || button.disabled) return;
    applyRuleFromTable(button.dataset.ruleId);
  });

  $('#inverse-hint-btn')?.addEventListener('click', () => {
    if (!engine || engine.roundDone) return;
    const result = engine.hint();
    if (result.status !== 'ok' || !result.type) {
      setFeedbackKey('inverse.feedback_hint_empty', {}, 'info');
      return;
    }
    const category = `${getTypeIcon(result.type)} ${getTypeLabel(result.type)}`;
    setFeedback(() => t('inverse.feedback_hint', { category }), 'info');
    renderHud();
    setControlsEnabled(true);
    focusFilter();
  });

  $('#inverse-reveal-btn')?.addEventListener('click', () => {
    if (!engine || engine.roundDone) return;
    const result = engine.revealCounterExample();
    if (result.status === 'ok') {
      const name = getCountryName(result.country) || result.code;
      setFeedback(
        () => t('inverse.feedback_reveal', {
          country: name,
          count: Math.max(0, engine.remainingToExclude),
        }),
        'info'
      );
    } else if (result.status === 'none') {
      setFeedbackKey('inverse.feedback_reveal_none', {}, 'info');
    } else {
      return;
    }
    renderAll();
    setControlsEnabled(true);
    focusFilter();
  });

  $('#inverse-pass-btn')?.addEventListener('click', () => {
    if (!engine || engine.roundDone) return;
    engine.passRound();
    setFeedbackKey('inverse.feedback_pass', {}, 'wrong');
    renderAll();
    setControlsEnabled(false);
    const resultCard = $('#inverse-round-result');
    if (resultCard) {
      setTimeout(() => resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 40);
    }
  });

  $('#inverse-restart-btn')?.addEventListener('click', () => {
    if (!engine) return;
    if (!engine.runOver && (engine.score > 0 || engine.selected.length > 0)) {
      if (!window.confirm(t('inverse.confirm_restart'))) return;
    }
    startNewRun();
  });

  $('#inverse-round-result')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-inverse-action]');
    if (!button) return;
    if (button.dataset.inverseAction === 'again') {
      startNewRun();
      return;
    }
    if (button.dataset.inverseAction === 'next') {
      const outcome = engine.continueAfterRound();
      if (outcome.finished) {
        renderAll();
        return;
      }
      const filter = $('#inverse-rule-filter');
      if (filter) filter.value = '';
      setInitialFeedback();
      renderAll();
      setControlsEnabled(true);
      focusFilter();
    }
  });

  onLanguageChange(() => {
    if (!ready) return;
    renderAll();
  });

  // Si l'utilisateur arrive directement sur l'onglet (rechargement avec hash).
  if (window.location.hash === '#fil-rouge') {
    setTimeout(() => openInverseMode(), 300);
  }
}
