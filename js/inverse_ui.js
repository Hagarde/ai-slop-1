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
let suggestions = [];
let suggestionIndex = -1;
let feedbackState = { render: () => '', kind: 'info' };
let active = false;
let catalogOpen = false;

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
  const flagUrl = country?.flagUrl || '';
  const flag = flagUrl
    ? `<img class="inverse-chip-flag" src="${escapeHtml(flagUrl)}" alt="" loading="lazy" />`
    : `<span class="inverse-chip-flag" aria-hidden="true">${escapeHtml(country?.flag || '')}</span>`;
  return `<span class="inverse-country-chip">${flag}<span>${escapeHtml(getCountryName(country))}</span></span>`;
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

function renderAll() {
  renderHud();
  renderTarget();
  renderPool();
  renderCriteria();
  renderFeedback();
  renderResult();
  if (catalogOpen) renderCatalog();
}

function renderSuggestions() {
  const input = $('#inverse-rule-input');
  const list = $('#inverse-suggestions');
  if (!input || !list || !ready) return;

  const query = input.value.trim();
  if (!query) {
    suggestions = [];
    suggestionIndex = -1;
    list.classList.add('hidden');
    list.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
    return;
  }

  suggestions = searchRules(rules, query, 8);
  suggestionIndex = suggestions.length > 0 ? 0 : -1;
  if (suggestions.length === 0) {
    list.innerHTML = `<div class="inverse-suggestion-empty">${escapeHtml(t('inverse.no_match'))}</div>`;
    list.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    return;
  }

  list.innerHTML = suggestions.map((rule, index) => `
    <button type="button" class="inverse-suggestion ${index === suggestionIndex ? 'active' : ''}" data-rule-id="${escapeHtml(rule.id)}" role="option" aria-selected="${index === suggestionIndex ? 'true' : 'false'}">
      <span class="inverse-suggestion-icon" aria-hidden="true">${escapeHtml(getTypeIcon(rule.type))}</span>
      <span class="inverse-suggestion-copy">
        <strong>${escapeHtml(getRuleLabel(rule))}</strong>
        <small>${escapeHtml(getTypeLabel(rule.type))}</small>
      </span>
    </button>
  `).join('');
  list.classList.remove('hidden');
  input.setAttribute('aria-expanded', 'true');
}

function hideSuggestions() {
  const list = $('#inverse-suggestions');
  if (list) {
    list.classList.add('hidden');
    list.innerHTML = '';
  }
  const input = $('#inverse-rule-input');
  if (input) input.setAttribute('aria-expanded', 'false');
  suggestions = [];
  suggestionIndex = -1;
}

function highlightSuggestion(nextIndex) {
  if (suggestions.length === 0) return;
  suggestionIndex = (nextIndex + suggestions.length) % suggestions.length;
  document.querySelectorAll('#inverse-suggestions .inverse-suggestion').forEach((button, index) => {
    button.classList.toggle('active', index === suggestionIndex);
    button.setAttribute('aria-selected', index === suggestionIndex ? 'true' : 'false');
  });
}

function sortRulesByType(ruleList) {
  const locale = getLanguage() === 'en' ? 'en' : 'fr';
  return [...ruleList].sort((a, b) => {
    const typeDelta = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    if (typeDelta !== 0) return typeDelta;
    return getRuleLabel(a).localeCompare(getRuleLabel(b), locale);
  });
}

function groupLabel(count) {
  return count > 1
    ? t('inverse.catalog_count', { count })
    : t('inverse.catalog_count_one', { count });
}

function renderCatalog() {
  const list = $('#inverse-catalog-list');
  const countEl = $('#inverse-browse-count');
  if (countEl) countEl.textContent = ready ? String(rules.length) : '…';
  if (!list) return;

  if (!ready) {
    list.innerHTML = `<p class="inverse-muted">${escapeHtml(t('inverse.loading'))}</p>`;
    return;
  }

  const query = ($('#inverse-catalog-search')?.value || '').trim();
  const matching = query
    ? searchRules(rules, query, rules.length)
    : sortRulesByType(rules);

  if (matching.length === 0) {
    list.innerHTML = `<p class="inverse-catalog-empty">${escapeHtml(t('inverse.catalog_empty'))}</p>`;
    return;
  }

  const usedIds = engine?.usedRuleIds || new Set();
  const groups = new Map();
  matching.forEach((rule) => {
    if (!groups.has(rule.type)) groups.set(rule.type, []);
    groups.get(rule.type).push(rule);
  });

  list.innerHTML = [...groups.entries()].map(([type, items]) => `
    <div class="inverse-catalog-group">
      <h4 class="inverse-catalog-group-title">
        <span aria-hidden="true">${escapeHtml(getTypeIcon(type))}</span>
        <span>${escapeHtml(getTypeLabel(type))}</span>
        <span class="inverse-catalog-group-count">${escapeHtml(groupLabel(items.length))}</span>
      </h4>
      ${items.map((rule) => {
        const used = usedIds.has(rule.id);
        return `
          <button
            type="button"
            class="inverse-catalog-item${used ? ' used' : ''}"
            data-rule-id="${escapeHtml(rule.id)}"
            title="${escapeHtml(getRuleDescription(rule))}"
            ${used ? 'disabled aria-disabled="true"' : ''}
          >
            <span class="inverse-catalog-copy">
              <strong>${escapeHtml(getRuleLabel(rule))}</strong>
              <small>${escapeHtml(getRuleDescription(rule))}</small>
            </span>
            ${used ? `<span class="inverse-catalog-used">${escapeHtml(t('inverse.catalog_used'))}</span>` : ''}
          </button>
        `;
      }).join('')}
    </div>
  `).join('');
}

function setCatalogOpen(open) {
  catalogOpen = open;
  const panel = $('#inverse-catalog');
  const button = $('#inverse-browse-btn');
  if (panel) panel.classList.toggle('hidden', !open);
  if (button) {
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.classList.toggle('active', open);
  }
  // La colonne latérale est sticky : avec le catalogue ouvert elle peut
  // dépasser la hauteur de l'écran et devenir inaccessible.
  $('.inverse-side-column')?.classList.toggle('catalog-open', open);
  if (open) {
    hideSuggestions();
    renderCatalog();
    requestAnimationFrame(() => {
      panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

function chooseRuleFromCatalog(rule) {
  if (!engine || engine.roundDone || engine.usedRuleIds.has(rule.id)) return;
  const input = $('#inverse-rule-input');
  if (!input) return;
  input.value = getRuleLabel(rule);
  hideSuggestions();
  setCatalogOpen(false);
  input.focus();
  input.select();
}

function setControlsEnabled(enabled) {
  ['#inverse-rule-input', '#inverse-submit-btn', '#inverse-hint-btn', '#inverse-pass-btn'].forEach((selector) => {
    const element = $(selector);
    if (!element) return;
    if (selector === '#inverse-hint-btn') {
      element.disabled = !enabled || Boolean(engine?.hintUsed);
    } else {
      element.disabled = !enabled;
    }
  });
}

function focusInput() {
  const input = $('#inverse-rule-input');
  if (input && !input.disabled) {
    input.focus({ preventScroll: true });
  }
}

function submitCurrentRule() {
  if (!ready || !engine || engine.roundDone || engine.runOver) return;
  const input = $('#inverse-rule-input');
  if (!input) return;

  const query = input.value.trim();
  if (!query) return;

  const selected = suggestionIndex >= 0 ? suggestions[suggestionIndex] : null;
  const rule = selected || searchRules(rules, query, 1)[0] || null;
  if (!rule) {
    setFeedbackKey('inverse.no_match', {}, 'info');
    return;
  }

  input.value = '';
  hideSuggestions();
  applyRule(rule);
  focusInput();
}

function applyRule(rule) {
  const result = engine.submitRule(rule.id);

  switch (result.status) {
    case 'wrong': {
      const examples = result.examples.join(', ');
      if (result.counterExampleCount > result.examples.length) {
        setFeedback(
          () => t('inverse.feedback_wrong_many', { count: result.counterExampleCount, countries: examples }),
          'wrong'
        );
      } else {
        setFeedback(
          () => t('inverse.feedback_wrong', { countries: examples }),
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
  }
}

function coverageChips(coverage) {
  return `<div class="inverse-rule-chip-list">${coverage.map((rule) => ruleChip(rule)).join('')}</div>`;
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
  card.classList.remove('hidden');
  card.classList.toggle('won', won);
  card.classList.toggle('lost', !won);

  const canonicalIds = summary.canonicalCoverage.map((rule) => rule.id).sort().join(',');
  const playerIds = summary.playerCoverage.map((rule) => rule.id).sort().join(',');
  const showPlayer = won && playerIds && playerIds !== canonicalIds;

  const bonusLines = [];
  if (summary.bonus === 50) bonusLines.push(t('inverse.result_bonus_par'));
  else if (summary.bonus === 25) bonusLines.push(t('inverse.result_bonus_extra'));
  if (summary.perfectLife) bonusLines.push(t('inverse.result_perfect'));

  const nextLabel = engine.lives <= 0 ? t('inverse.see_results') : t('inverse.next_round');

  card.innerHTML = `
    <div class="inverse-result-head">
      <span class="inverse-result-kicker">${escapeHtml(t('inverse.result_round', { round: summary.round }))}</span>
      <h2>${escapeHtml(won ? t('inverse.result_won_title') : t('inverse.result_failed_title'))}</h2>
      <p>${escapeHtml(t('inverse.result_stats', {
        used: summary.used,
        wrong: summary.wrong,
        score: summary.score,
      }))}</p>
    </div>
    ${won ? `<p class="inverse-result-note">${escapeHtml(t('inverse.result_par_won', { par: summary.par }))}</p>` : ''}
    <div class="inverse-result-block">
      <h3>${escapeHtml(t('inverse.result_canonical', { par: summary.par }))}</h3>
      ${coverageChips(summary.canonicalCoverage)}
      ${summary.alternativeSolutions > 0
        ? `<p class="inverse-muted">${escapeHtml(t('inverse.result_alternatives', { count: summary.alternativeSolutions }))}</p>`
        : ''}
    </div>
    ${showPlayer ? `
      <div class="inverse-result-block">
        <h3>${escapeHtml(t('inverse.result_your_solution'))}</h3>
        ${coverageChips(summary.playerCoverage)}
      </div>
    ` : ''}
    ${bonusLines.length > 0 ? `<div class="inverse-result-bonuses">${bonusLines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</div>` : ''}
    <button type="button" class="primary-button inverse-next-btn" data-inverse-action="next">${escapeHtml(nextLabel)}</button>
  `;
  setControlsEnabled(false);
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
  const roundsWon = engine.roundHistory.filter((entry) => entry.won).length;

  card.classList.remove('hidden');
  card.classList.remove('lost');
  card.classList.add(engine.completed ? 'won' : 'lost');
  card.innerHTML = `
    <div class="inverse-result-head">
      <span class="inverse-result-kicker">${escapeHtml(t('inverse.run_kicker'))}</span>
      <h2>${escapeHtml(engine.completed ? t('inverse.run_win_title') : t('inverse.run_over_title'))}</h2>
      <p>${escapeHtml(t('inverse.run_rounds', { won: roundsWon, total: engine.roundPlan.length }))}</p>
    </div>
    <div class="inverse-final-score">
      <span>${escapeHtml(t('inverse.run_score'))}</span>
      <strong>${engine.score}</strong>
    </div>
    ${engine.finalBonus > 0 ? `<p class="inverse-muted">${escapeHtml(t('inverse.run_bonus', { count: engine.finalBonus }))}</p>` : ''}
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
  setInitialFeedback();
  renderAll();
  setControlsEnabled(!engine.roundDone);
  focusInput();
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
      focusInput();
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
  if (!engine.roundDone) focusInput();
}

export function closeInverseMode() {
  if (!active) return;
  active = false;
  setCatalogOpen(false);
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

  $('#inverse-submit-btn')?.addEventListener('click', submitCurrentRule);
  $('#inverse-rule-input')?.addEventListener('input', renderSuggestions);
  $('#inverse-rule-input')?.addEventListener('focus', renderSuggestions);
  $('#inverse-rule-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlightSuggestion(suggestionIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlightSuggestion(suggestionIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submitCurrentRule();
    } else if (event.key === 'Escape') {
      hideSuggestions();
    }
  });

  $('#inverse-suggestions')?.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const button = event.target.closest('.inverse-suggestion');
    if (!button) return;
    const rule = rules.find((item) => item.id === button.dataset.ruleId);
    if (!rule) return;
    const input = $('#inverse-rule-input');
    if (input) input.value = '';
    hideSuggestions();
    applyRule(rule);
    focusInput();
  });

  $('#inverse-browse-btn')?.addEventListener('click', () => {
    setCatalogOpen(!catalogOpen);
  });

  $('#inverse-catalog-close')?.addEventListener('click', () => {
    setCatalogOpen(false);
    focusInput();
  });

  $('#inverse-catalog-search')?.addEventListener('input', renderCatalog);
  $('#inverse-catalog')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setCatalogOpen(false);
      focusInput();
    }
  });

  $('#inverse-catalog-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('.inverse-catalog-item');
    if (!button || button.disabled) return;
    const rule = rules.find((item) => item.id === button.dataset.ruleId);
    if (rule) chooseRuleFromCatalog(rule);
  });

  $('#inverse-hint-btn')?.addEventListener('click', () => {
    if (!engine || engine.roundDone) return;
    const result = engine.hint();
    if (result.status !== 'ok' || !result.rule) {
      setFeedbackKey('inverse.feedback_hint_empty', {}, 'info');
      return;
    }
    setFeedback(() => t('inverse.feedback_hint', { rule: getRuleLabel(result.rule) }), 'info');
    const input = $('#inverse-rule-input');
    if (input) {
      input.value = getRuleLabel(result.rule);
      input.focus();
      input.select();
    }
    renderHud();
    setControlsEnabled(true);
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
      setInitialFeedback();
      renderAll();
      setControlsEnabled(true);
      focusInput();
    }
  });

  // Fermer les suggestions au clic extérieur.
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.inverse-input-card')) hideSuggestions();
  });

  onLanguageChange(() => {
    if (!ready) return;
    renderAll();
    if (suggestions.length > 0) renderSuggestions();
  });

  // Si l'utilisateur arrive directement sur l'onglet (rechargement avec hash).
  if (window.location.hash === '#fil-rouge') {
    setTimeout(() => openInverseMode(), 300);
  }
}
