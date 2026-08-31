/* Itemsouq Trading — static localStorage demo */
(function () {
  'use strict';

  const fruits = Array.isArray(window.ITEMSOUQ_FRUITS) ? window.ITEMSOUQ_FRUITS : [];
  const STORAGE = {
    trades: 'itemsouq:trading:v3:listings',
    saved: 'itemsouq:trading:v3:saved'
  };
  const MAX_FRUITS = 4;
  const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

  const rarityLabels = {
    Common: 'Commun',
    Uncommon: 'Peu commun',
    Rare: 'Rare',
    Legendary: 'Légendaire',
    Mythical: 'Mythique'
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = (id) => document.getElementById(id);
  const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const fruitById = new Map(fruits.map((fruit) => [slugify(fruit.name), fruit]));

  const state = {
    trades: [],
    saved: new Set(),
    view: 'all',
    search: '',
    side: 'both',
    mode: 'all',
    status: 'open',
    sort: 'newest',
    create: {
      offered: new Set(),
      wanted: new Set()
    },
    counter: new Set(),
    activeTradeId: null
  };

  let activeModal = null;
  let returnFocus = null;
  let toastTimer = null;
  let isSubmitting = false;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeJsonRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function safeJsonWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showToast('Le stockage local est indisponible. Tes changements restent temporaires.', 'warning');
      return false;
    }
  }

  function uniqueId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function demoTrades() {
    const now = Date.now();
    const minutesAgo = (minutes) => new Date(now - minutes * 60 * 1000).toISOString();

    return [
      {
        id: 'demo-dragon-kitsune',
        username: 'SamirRBLX',
        mode: 'physical',
        status: 'open',
        owned: false,
        offered: [{ fruitId: 'dragon', quantity: 1 }],
        wanted: [{ fruitId: 'kitsune', quantity: 1 }, { fruitId: 'dough', quantity: 1 }],
        note: 'Disponible ce soir. Je vérifie tous les fruits dans la fenêtre d’échange.',
        createdAt: minutesAgo(18),
        responses: [
          { id: 'counter-demo-1', username: 'CasaFruit', offered: [{ fruitId: 'kitsune', quantity: 1 }], note: 'Kitsune disponible maintenant.', createdAt: minutesAgo(8) }
        ]
      },
      {
        id: 'demo-dough-spirit',
        username: 'Aya_Blox',
        mode: 'physical',
        status: 'open',
        owned: false,
        offered: [{ fruitId: 'dough', quantity: 1 }, { fruitId: 'spirit', quantity: 1 }],
        wanted: [{ fruitId: 'kitsune', quantity: 1 }],
        note: 'Je cherche surtout Kitsune. Une contre-offre proche peut aussi m’intéresser.',
        createdAt: minutesAgo(74),
        responses: [
          { id: 'counter-demo-2', username: 'MarrakechPro', offered: [{ fruitId: 'control', quantity: 1 }], note: '', createdAt: minutesAgo(42) },
          { id: 'counter-demo-3', username: 'NoraPlayz', offered: [{ fruitId: 'kitsune', quantity: 1 }], note: 'On peut vérifier ensemble en jeu.', createdAt: minutesAgo(31) }
        ]
      },
      {
        id: 'demo-buddha-portal',
        username: 'RachidPro',
        mode: 'physical',
        status: 'open',
        owned: false,
        offered: [{ fruitId: 'buddha', quantity: 1 }, { fruitId: 'portal', quantity: 1 }],
        wanted: [{ fruitId: 'dough', quantity: 1 }],
        note: 'Échange simple entre joueurs, sans paiement.',
        createdAt: minutesAgo(190),
        responses: []
      },
      {
        id: 'demo-permanent-buddha',
        username: 'ImanePlays',
        mode: 'permanent',
        status: 'open',
        owned: false,
        offered: [{ fruitId: 'buddha', quantity: 1 }],
        wanted: [{ fruitId: 'dough', quantity: 1 }],
        note: 'Offre permanente de démonstration. Tout doit être confirmé dans le jeu.',
        createdAt: minutesAgo(410),
        responses: []
      },
      {
        id: 'demo-tiger-yeti',
        username: 'FesTrader',
        mode: 'physical',
        status: 'completed',
        owned: false,
        offered: [{ fruitId: 'tiger', quantity: 1 }],
        wanted: [{ fruitId: 'yeti', quantity: 1 }],
        note: 'Exemple d’une offre déjà clôturée.',
        createdAt: minutesAgo(1440),
        responses: [
          { id: 'counter-demo-4', username: 'AtlasGaming', offered: [{ fruitId: 'yeti', quantity: 1 }], note: '', createdAt: minutesAgo(1320) }
        ]
      }
    ];
  }

  function sanitizeLine(line, mode) {
    if (!line || typeof line !== 'object') return null;
    const fruitId = typeof line.fruitId === 'string' ? line.fruitId : '';
    if (!fruitById.has(fruitId)) return null;
    const parsed = Number.parseInt(line.quantity, 10);
    const maximum = mode === 'permanent' ? 1 : 4;
    const quantity = Number.isFinite(parsed) ? Math.min(maximum, Math.max(1, parsed)) : 1;
    return { fruitId, quantity };
  }

  function sanitizeLines(lines, mode) {
    if (!Array.isArray(lines)) return [];
    const seen = new Set();
    const result = [];
    for (const line of lines) {
      const clean = sanitizeLine(line, mode);
      if (!clean || seen.has(clean.fruitId)) continue;
      seen.add(clean.fruitId);
      result.push(clean);
      if (result.length === MAX_FRUITS) break;
    }
    return result;
  }

  function sanitizeUsername(value) {
    const username = typeof value === 'string' ? value.trim().slice(0, 20) : '';
    return USERNAME_PATTERN.test(username) ? username : '';
  }

  function sanitizeResponse(response, mode) {
    if (!response || typeof response !== 'object') return null;
    const id = typeof response.id === 'string' && /^[A-Za-z0-9_-]{1,90}$/.test(response.id) ? response.id : '';
    const username = sanitizeUsername(response.username);
    const offered = sanitizeLines(response.offered, mode);
    const date = new Date(response.createdAt);
    if (!id || !username || !offered.length || Number.isNaN(date.getTime())) return null;
    return {
      id,
      username,
      offered,
      note: typeof response.note === 'string' ? response.note.trim().slice(0, 160) : '',
      createdAt: date.toISOString()
    };
  }

  function sanitizeTrade(trade) {
    if (!trade || typeof trade !== 'object') return null;
    const id = typeof trade.id === 'string' && /^[A-Za-z0-9_-]{1,90}$/.test(trade.id) ? trade.id : '';
    const username = sanitizeUsername(trade.username);
    const mode = trade.mode === 'permanent' ? 'permanent' : trade.mode === 'physical' ? 'physical' : '';
    const status = trade.status === 'completed' ? 'completed' : trade.status === 'open' ? 'open' : '';
    const date = new Date(trade.createdAt);
    if (!id || !username || !mode || !status || Number.isNaN(date.getTime())) return null;

    const offered = sanitizeLines(trade.offered, mode);
    const wanted = sanitizeLines(trade.wanted, mode);
    if (!offered.length || !wanted.length) return null;
    const offeredIds = new Set(offered.map((line) => line.fruitId));
    if (wanted.some((line) => offeredIds.has(line.fruitId))) return null;

    const responseIds = new Set();
    const responses = [];
    if (Array.isArray(trade.responses)) {
      for (const response of trade.responses) {
        const clean = sanitizeResponse(response, mode);
        if (!clean || responseIds.has(clean.id)) continue;
        clean.offered = clean.offered.filter((line) => !offeredIds.has(line.fruitId));
        if (!clean.offered.length) continue;
        responseIds.add(clean.id);
        responses.push(clean);
        if (responses.length === 50) break;
      }
    }

    return {
      id,
      username,
      mode,
      status,
      owned: Boolean(trade.owned),
      offered,
      wanted,
      note: typeof trade.note === 'string' ? trade.note.trim().slice(0, 180) : '',
      createdAt: date.toISOString(),
      responses
    };
  }

  function sanitizeTrades(input) {
    if (!Array.isArray(input)) return [];
    const ids = new Set();
    const result = [];
    for (const trade of input) {
      const clean = sanitizeTrade(trade);
      if (!clean || ids.has(clean.id)) continue;
      ids.add(clean.id);
      result.push(clean);
      if (result.length === 100) break;
    }
    return result;
  }

  function hydrateState() {
    const storedTrades = safeJsonRead(STORAGE.trades, null);
    const cleanTrades = sanitizeTrades(storedTrades);
    state.trades = cleanTrades.length ? cleanTrades : demoTrades();

    const storedSaved = safeJsonRead(STORAGE.saved, []);
    const validIds = new Set(state.trades.map((trade) => trade.id));
    state.saved = new Set(Array.isArray(storedSaved)
      ? storedSaved.filter((id) => typeof id === 'string' && validIds.has(id))
      : []);

    persistTrades();
    persistSaved();
  }

  function persistTrades() {
    safeJsonWrite(STORAGE.trades, state.trades);
  }

  function persistSaved() {
    safeJsonWrite(STORAGE.saved, [...state.saved]);
  }

  function fruitImagePath(fruit) {
    return `assets/images/fruits/${slugify(fruit.name)}.webp`;
  }

  function modeCopy(mode) {
    return mode === 'permanent'
      ? { label: 'Permanent', icon: 'fa-infinity', unit: 'Robux' }
      : { label: 'Physique', icon: 'fa-box-open', unit: 'Beli' };
  }

  function valueFor(fruit, mode) {
    return mode === 'permanent' ? fruit.robux : fruit.beli;
  }

  function linesValue(lines, mode) {
    return lines.reduce((total, line) => {
      const fruit = fruitById.get(line.fruitId);
      return fruit ? total + valueFor(fruit, mode) * line.quantity : total;
    }, 0);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  function formatValue(value, mode) {
    return `${formatNumber(value)} ${modeCopy(mode).unit}`;
  }

  function initials(username) {
    const clean = String(username).replace(/[^A-Za-z0-9]/g, '');
    return clean.slice(0, 2).toUpperCase() || 'TR';
  }

  function formatRelative(isoDate) {
    const date = new Date(isoDate);
    const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return 'à l’instant';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  }

  function fullDate(isoDate) {
    return new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoDate));
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function showToast(message, type = 'success') {
    const toast = byId('trade-toast');
    if (!toast) return;
    byId('trade-toast-message').textContent = message;
    const icon = $('.toast-icon i', toast);
    icon.className = `fa-solid ${type === 'warning' ? 'fa-triangle-exclamation' : 'fa-check'}`;
    toast.classList.toggle('warning', type === 'warning');
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function announce(message) {
    const region = byId('trade-live-region');
    region.textContent = '';
    window.requestAnimationFrame(() => { region.textContent = message; });
  }

  function fruitRows(lines, mode) {
    return lines.map((line) => {
      const fruit = fruitById.get(line.fruitId);
      if (!fruit) return '';
      const quantity = line.quantity > 1 ? `<b aria-label="Quantité ${line.quantity}">×${line.quantity}</b>` : '';
      return `
        <div class="trade-fruit-mini">
          <span class="trade-fruit-mini-img"><img src="${fruitImagePath(fruit)}" alt="" width="512" height="512" loading="lazy" decoding="async">${quantity}</span>
          <span><strong>${escapeHtml(fruit.name)}</strong><small>${escapeHtml(rarityLabels[fruit.rarity] || fruit.rarity)} · ${formatValue(valueFor(fruit, mode) * line.quantity, mode)}</small></span>
        </div>`;
    }).join('');
  }

  function sideMarkup(lines, mode, side) {
    const offered = side === 'give';
    return `
      <div class="trade-side">
        <span class="trade-side-label ${offered ? 'give' : 'want'}"><i class="fa-solid ${offered ? 'fa-arrow-up' : 'fa-arrow-down'}" aria-hidden="true"></i>${offered ? 'Propose' : 'Recherche'}</span>
        <div class="trade-fruit-stack">${fruitRows(lines, mode)}</div>
        <div class="trade-side-value"><span>Valeur wiki</span><strong>${formatValue(linesValue(lines, mode), mode)}</strong></div>
      </div>`;
  }

  function filteredTrades() {
    const query = state.search.trim().toLocaleLowerCase('fr');
    let result = state.trades.filter((trade) => {
      if (state.view === 'mine' && !trade.owned) return false;
      if (state.view === 'saved' && !state.saved.has(trade.id)) return false;
      if (state.mode !== 'all' && trade.mode !== state.mode) return false;
      if (state.status !== 'all' && trade.status !== state.status) return false;
      if (!query) return true;

      const offeredNames = trade.offered.map((line) => fruitById.get(line.fruitId)?.name || '').join(' ');
      const wantedNames = trade.wanted.map((line) => fruitById.get(line.fruitId)?.name || '').join(' ');
      const haystack = state.side === 'offered'
        ? offeredNames
        : state.side === 'wanted'
          ? wantedNames
          : `${trade.username} ${offeredNames} ${wantedNames} ${trade.note}`;
      return haystack.toLocaleLowerCase('fr').includes(query);
    });

    result = [...result].sort((a, b) => {
      if (state.sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id);
      if (state.sort === 'response-desc') return b.responses.length - a.responses.length || new Date(b.createdAt) - new Date(a.createdAt);
      if (state.sort === 'value-desc') return linesValue(b.offered, b.mode) - linesValue(a.offered, a.mode) || new Date(b.createdAt) - new Date(a.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt) || a.id.localeCompare(b.id);
    });

    return result;
  }

  function tradeCard(trade) {
    const mode = modeCopy(trade.mode);
    const saved = state.saved.has(trade.id);
    const responses = trade.responses.length;
    return `
      <article class="trade-card${trade.owned ? ' is-owned' : ''}" data-trade-card="${escapeHtml(trade.id)}">
        <header class="trade-card-head">
          <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(trade.username))}</span>
          <span class="trade-card-user"><strong>${escapeHtml(trade.username)}</strong><small title="${escapeHtml(fullDate(trade.createdAt))}">${escapeHtml(formatRelative(trade.createdAt))}</small></span>
          <span class="trade-card-head-meta">
            <span class="trade-card-format"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.label}</span>
            <span class="trade-status${trade.status === 'completed' ? ' completed' : ''}"><i class="fa-solid fa-circle" aria-hidden="true"></i>${trade.status === 'completed' ? 'Terminée' : 'Ouverte'}</span>
          </span>
          <button class="trade-save-button${saved ? ' active' : ''}" type="button" data-save-trade="${escapeHtml(trade.id)}" aria-label="${saved ? 'Retirer' : 'Ajouter'} l'offre de ${escapeHtml(trade.username)} ${saved ? 'des' : 'aux'} sauvegardées" aria-pressed="${saved}">
            <i class="fa-${saved ? 'solid' : 'regular'} fa-bookmark" aria-hidden="true"></i>
          </button>
        </header>
        <div class="trade-card-exchange">
          ${sideMarkup(trade.offered, trade.mode, 'give')}
          <div class="trade-card-swap" aria-hidden="true"><span><i class="fa-solid fa-arrow-right-arrow-left"></i></span></div>
          ${sideMarkup(trade.wanted, trade.mode, 'want')}
        </div>
        ${trade.note ? `<p class="trade-card-note"><i class="fa-regular fa-message" aria-hidden="true"></i>${escapeHtml(trade.note)}</p>` : ''}
        <footer class="trade-card-footer">
          <span class="trade-response-count"><i class="fa-regular fa-comments" aria-hidden="true"></i>${pluralize(responses, 'contre-offre', 'contre-offres')}</span>
          <button class="btn btn-secondary" type="button" data-share-trade="${escapeHtml(trade.id)}" aria-label="Partager l'offre de ${escapeHtml(trade.username)}"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Partager</button>
          <button class="btn btn-primary" type="button" data-view-trade="${escapeHtml(trade.id)}" aria-haspopup="dialog" aria-controls="trade-detail-modal">${trade.owned ? 'Gérer' : trade.status === 'open' ? 'Préparer une offre' : 'Voir'} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        </footer>
      </article>`;
  }

  function updateCounts(filteredCount) {
    const mine = state.trades.filter((trade) => trade.owned).length;
    const open = state.trades.filter((trade) => trade.status === 'open').length;
    const counteroffers = state.trades.reduce((total, trade) => total + trade.responses.length, 0);
    byId('all-trades-count').textContent = state.trades.length;
    byId('my-trades-count').textContent = mine;
    byId('saved-trades-count').textContent = state.saved.size;
    byId('open-trades-stat').textContent = open;
    byId('counteroffers-stat').textContent = counteroffers;
    byId('trade-results-count').textContent = `${pluralize(filteredCount, 'offre affichée', 'offres affichées')} · données locales`;
  }

  function hasActiveFilters() {
    return Boolean(state.search) || state.side !== 'both' || state.mode !== 'all' || state.status !== 'open' || state.sort !== 'newest' || state.view !== 'all';
  }

  function updateValueSortAvailability() {
    const option = $('#trade-sort option[value="value-desc"]');
    if (!option) return;
    const mixedUnits = state.mode === 'all';
    option.disabled = mixedUnits;
    option.textContent = mixedUnits ? 'Valeur (choisir un format)' : 'Plus grande valeur';
    if (mixedUnits && state.sort === 'value-desc') {
      state.sort = 'newest';
      byId('trade-sort').value = 'newest';
    }
  }

  function renderTrades() {
    const result = filteredTrades();
    byId('trade-grid').innerHTML = result.map(tradeCard).join('');
    byId('trade-grid').hidden = !result.length;
    byId('trade-empty').hidden = Boolean(result.length);
    byId('clear-trade-filters').hidden = !hasActiveFilters();
    updateCounts(result.length);

    if (!result.length) {
      const emptyCopy = byId('trade-empty-copy');
      const emptyAction = byId('trade-empty-action');
      if (state.view === 'mine') {
        emptyCopy.textContent = 'Tu n’as encore publié aucune offre sur cet appareil.';
        emptyAction.textContent = 'Publier une offre';
        emptyAction.dataset.emptyMode = 'create';
      } else if (state.view === 'saved') {
        emptyCopy.textContent = 'Sauvegarde une offre avec l’icône marque-page pour la retrouver ici.';
        emptyAction.textContent = 'Voir toutes les offres';
        emptyAction.dataset.emptyMode = 'reset';
      } else {
        emptyCopy.textContent = 'Essaie une autre recherche ou réinitialise les filtres.';
        emptyAction.textContent = 'Réinitialiser les filtres';
        emptyAction.dataset.emptyMode = 'reset';
      }
    }
  }

  function resetFilters() {
    state.view = 'all';
    state.search = '';
    state.side = 'both';
    state.mode = 'all';
    state.status = 'open';
    state.sort = 'newest';
    byId('trade-search').value = '';
    byId('trade-side-filter').value = 'both';
    byId('trade-mode-filter').value = 'all';
    byId('trade-status-filter').value = 'open';
    byId('trade-sort').value = 'newest';
    updateValueSortAvailability();
    $$('.trade-tab').forEach((tab) => {
      const active = tab.dataset.view === 'all';
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
    renderTrades();
  }

  function pickerSelection(kind) {
    if (kind === 'counter') return state.counter;
    return state.create[kind];
  }

  function pickerContainer(kind) {
    return byId(kind === 'counter' ? 'counter-picker' : `${kind}-picker`);
  }

  function renderSelected(kind) {
    const container = byId(kind === 'counter' ? 'counter-selected' : `${kind}-selected`);
    if (!container) return;
    const selected = pickerSelection(kind);
    if (!selected.size) {
      container.innerHTML = '<span>Aucun fruit sélectionné</span>';
      return;
    }
    container.innerHTML = [...selected].map((fruitId) => {
      const fruit = fruitById.get(fruitId);
      if (!fruit) return '';
      return `<button class="selected-fruit-chip" type="button" data-picker-remove="${kind}" data-fruit-id="${escapeHtml(fruitId)}" aria-label="Retirer ${escapeHtml(fruit.name)}"><img src="${fruitImagePath(fruit)}" alt="" width="512" height="512">${escapeHtml(fruit.name)} <i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
    }).join('');
  }

  function renderPicker(kind, query = '') {
    const container = pickerContainer(kind);
    if (!container) return;
    const selected = pickerSelection(kind);
    const activeTrade = kind === 'counter' ? state.trades.find((trade) => trade.id === state.activeTradeId) : null;
    const opposite = kind === 'offered'
      ? state.create.wanted
      : kind === 'wanted'
        ? state.create.offered
        : new Set(activeTrade?.offered.map((line) => line.fruitId) || []);
    const normalized = query.trim().toLocaleLowerCase('fr');
    const matches = fruits.filter((fruit) => !normalized || fruit.name.toLocaleLowerCase('fr').includes(normalized));

    if (!matches.length) {
      container.innerHTML = '<p class="picker-no-results">Aucun fruit trouvé.</p>';
      renderSelected(kind);
      return;
    }

    let hasTabStop = false;
    container.innerHTML = matches.map((fruit) => {
      const fruitId = slugify(fruit.name);
      const isSelected = selected.has(fruitId);
      const isUnavailable = !isSelected && (selected.size >= MAX_FRUITS || opposite.has(fruitId));
      const isTabStop = !isUnavailable && !hasTabStop;
      if (isTabStop) hasTabStop = true;
      return `
        <button class="fruit-picker-option" type="button" data-picker="${kind}" data-fruit-id="${escapeHtml(fruitId)}" aria-pressed="${isSelected}" tabindex="${isTabStop ? '0' : '-1'}" ${isUnavailable ? 'disabled' : ''}>
          <img src="${fruitImagePath(fruit)}" alt="" width="512" height="512" loading="lazy" decoding="async">
          <span><strong>${escapeHtml(fruit.name)}</strong><small>${escapeHtml(rarityLabels[fruit.rarity] || fruit.rarity)}</small></span>
          <i class="picker-check fa-solid fa-check" aria-hidden="true"></i>
        </button>`;
    }).join('');
    renderSelected(kind);
  }

  function renderAllPickers() {
    const offeredQuery = $('[data-picker-search="offered"]')?.value || '';
    const wantedQuery = $('[data-picker-search="wanted"]')?.value || '';
    renderPicker('offered', offeredQuery);
    renderPicker('wanted', wantedQuery);
    updateCreateValuePreview();
  }

  function togglePickerFruit(kind, fruitId) {
    const selected = pickerSelection(kind);
    if (!fruitById.has(fruitId)) return;
    if (selected.has(fruitId)) {
      selected.delete(fruitId);
    } else {
      const activeTrade = kind === 'counter' ? state.trades.find((trade) => trade.id === state.activeTradeId) : null;
      const opposite = kind === 'offered'
        ? state.create.wanted
        : kind === 'wanted'
          ? state.create.offered
          : new Set(activeTrade?.offered.map((line) => line.fruitId) || []);
      if (opposite.has(fruitId)) {
        showToast('Un même fruit ne peut pas être des deux côtés.', 'warning');
        return;
      }
      if (selected.size >= MAX_FRUITS) {
        showToast(`Maximum ${MAX_FRUITS} fruits par côté.`, 'warning');
        return;
      }
      selected.add(fruitId);
    }

    if (kind === 'counter') {
      const query = $('[data-picker-search="counter"]')?.value || '';
      renderPicker('counter', query);
      clearPickerError('counter');
    } else {
      renderAllPickers();
      clearPickerError(kind);
    }
    window.requestAnimationFrame(() => {
      const restored = document.querySelector(`[data-picker="${kind}"][data-fruit-id="${fruitId}"]`);
      const target = restored && !restored.disabled
        ? restored
        : pickerContainer(kind)?.querySelector('[data-picker]:not([disabled])');
      if (target) {
        $$('[data-picker]', pickerContainer(kind)).forEach((option) => { option.tabIndex = -1; });
        target.tabIndex = 0;
        target.focus();
      }
    });
  }

  function updateCreateValuePreview() {
    const mode = byId('trade-mode')?.value === 'permanent' ? 'permanent' : 'physical';
    const offered = [...state.create.offered].map((fruitId) => ({ fruitId, quantity: 1 }));
    const wanted = [...state.create.wanted].map((fruitId) => ({ fruitId, quantity: 1 }));
    const offeredValue = linesValue(offered, mode);
    const wantedValue = linesValue(wanted, mode);
    const largest = Math.max(offeredValue, wantedValue);
    const gap = largest ? Math.round(Math.abs(offeredValue - wantedValue) / largest * 100) : 0;
    byId('create-value-preview').innerHTML = `
      <span>Tu proposes<strong>${formatValue(offeredValue, mode)}</strong></span>
      <b class="trade-value-gap"><i class="fa-solid fa-chart-simple" aria-hidden="true"></i>${offeredValue && wantedValue ? `Écart wiki ${gap}%` : 'Ajoute les deux côtés'}</b>
      <span>Tu recherches<strong>${formatValue(wantedValue, mode)}</strong></span>`;
  }

  function setPageInert(inert) {
    ['.announcement', '.site-header', 'main', '.site-footer'].forEach((selector) => {
      const element = $(selector);
      if (element) element.inert = inert;
    });
  }

  function openModal(modal, trigger) {
    if (!modal) return;
    if (activeModal && activeModal !== modal) closeModal(activeModal, false);
    returnFocus = trigger || document.activeElement;
    activeModal = modal;
    modal.hidden = false;
    document.body.classList.add('overlay-open');
    setPageInert(true);
  }

  function closeModal(modal, restoreFocus = true) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    activeModal = null;
    document.body.classList.remove('overlay-open');
    setPageInert(false);
    const preferred = returnFocus;
    const tradeId = state.activeTradeId;
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        const isUsable = (element) => element
          && element.isConnected
          && element.offsetParent !== null
          && !element.disabled
          && typeof element.focus === 'function';
        let focusTarget = isUsable(preferred) ? preferred : null;
        if (!focusTarget && tradeId) {
          const refreshedCardAction = document.querySelector(`[data-view-trade="${tradeId}"]`);
          if (isUsable(refreshedCardAction)) focusTarget = refreshedCardAction;
        }
        if (!focusTarget) {
          const stableHeaderAction = $('.site-header [data-open-create]');
          if (isUsable(stableHeaderAction)) focusTarget = stableHeaderAction;
        }
        focusTarget?.focus();
      });
    }
  }

  function resetCreateForm() {
    byId('create-trade-form').reset();
    state.create.offered.clear();
    state.create.wanted.clear();
    $$('[data-picker-search="offered"], [data-picker-search="wanted"]').forEach((input) => { input.value = ''; });
    clearCreateErrors();
    byId('trade-note-count').textContent = '0';
    renderAllPickers();
  }

  function openCreate(trigger) {
    clearCreateErrors();
    const modal = byId('create-trade-modal');
    $('.trade-modal-card', modal).scrollTop = 0;
    openModal(modal, trigger);
    window.requestAnimationFrame(() => byId('create-trade-title').focus());
  }

  function closeCreate() {
    closeModal(byId('create-trade-modal'));
  }

  function clearCreateErrors() {
    $$('[data-trade-error]').forEach((error) => { error.textContent = ''; });
    $$('[aria-invalid="true"]', byId('create-trade-form')).forEach((element) => element.removeAttribute('aria-invalid'));
    $$('.trade-fruit-fieldset.has-error', byId('create-trade-form')).forEach((fieldset) => fieldset.classList.remove('has-error'));
  }

  function clearPickerError(kind) {
    const fieldset = $(`[data-picker-fieldset="${kind}"]`);
    const error = byId(`${kind}-error`);
    fieldset?.classList.remove('has-error');
    fieldset?.removeAttribute('aria-invalid');
    if (error) error.textContent = '';
  }

  function setCreateError(field, message) {
    const error = $(`[data-trade-error="${field}"]`, byId('create-trade-form'));
    if (error) error.textContent = message;
    if (field === 'username') {
      byId('trade-username').setAttribute('aria-invalid', 'true');
    } else {
      const fieldset = $(`[data-picker-fieldset="${field}"]`, byId('create-trade-form'));
      fieldset?.classList.add('has-error');
      fieldset?.setAttribute('aria-invalid', 'true');
    }
  }

  function validateCreateForm() {
    clearCreateErrors();
    const username = byId('trade-username').value.trim();
    const errors = [];
    if (!USERNAME_PATTERN.test(username)) {
      setCreateError('username', 'Utilise 3 à 20 lettres, chiffres ou underscores.');
      errors.push(byId('trade-username'));
    }
    if (!state.create.offered.size) {
      setCreateError('offered', 'Sélectionne au moins un fruit à proposer.');
      errors.push($('[data-picker-fieldset="offered"]'));
    }
    if (!state.create.wanted.size) {
      setCreateError('wanted', 'Sélectionne au moins un fruit à rechercher.');
      errors.push($('[data-picker-fieldset="wanted"]'));
    }
    const overlaps = [...state.create.offered].some((fruitId) => state.create.wanted.has(fruitId));
    if (overlaps) {
      setCreateError('wanted', 'Le même fruit ne peut pas être proposé et recherché.');
      errors.push($('[data-picker-fieldset="wanted"]'));
    }
    errors[0]?.focus();
    return !errors.length;
  }

  function submitCreate(event) {
    event.preventDefault();
    if (isSubmitting || !validateCreateForm()) return;
    isSubmitting = true;
    const mode = byId('trade-mode').value === 'permanent' ? 'permanent' : 'physical';
    const trade = {
      id: uniqueId('trade'),
      username: byId('trade-username').value.trim(),
      mode,
      status: 'open',
      owned: true,
      offered: [...state.create.offered].map((fruitId) => ({ fruitId, quantity: 1 })),
      wanted: [...state.create.wanted].map((fruitId) => ({ fruitId, quantity: 1 })),
      note: byId('trade-note').value.trim().slice(0, 180),
      createdAt: new Date().toISOString(),
      responses: []
    };
    state.trades.unshift(trade);
    persistTrades();
    resetFilters();
    resetCreateForm();
    closeCreate();
    showToast('Ton offre a été ajoutée à cette démo locale.');
    announce('Offre publiée localement.');
    window.setTimeout(() => { isSubmitting = false; }, 0);
  }

  function detailMarkup(trade) {
    const mode = modeCopy(trade.mode);
    const history = trade.responses.slice(-5).reverse();
    const responseMarkup = history.length
      ? `<div class="counter-list">${history.map((response) => `
          <div class="counter-item">
            <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(response.username))}</span>
            <span class="counter-item-copy"><strong>${escapeHtml(response.username)} propose ${escapeHtml(response.offered.map((line) => fruitById.get(line.fruitId)?.name || '').join(' + '))}</strong><small>${response.note ? escapeHtml(response.note) : 'Sans message supplémentaire'}</small></span>
            <time datetime="${escapeHtml(response.createdAt)}">${escapeHtml(formatRelative(response.createdAt))}</time>
          </div>`).join('')}</div>`
      : '<p>Aucune contre-offre locale pour le moment.</p>';

    const canRespond = !trade.owned && trade.status === 'open';
    return `
      <div class="detail-owner">
        <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(trade.username))}</span>
        <span class="detail-owner-copy"><strong>${escapeHtml(trade.username)}</strong><small>Publiée ${escapeHtml(formatRelative(trade.createdAt))} · ${escapeHtml(fullDate(trade.createdAt))}</small></span>
        <span class="detail-owner-badges">
          <span class="trade-card-format"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.label}</span>
          <span class="trade-status${trade.status === 'completed' ? ' completed' : ''}"><i class="fa-solid fa-circle" aria-hidden="true"></i>${trade.status === 'completed' ? 'Terminée' : 'Ouverte'}</span>
        </span>
      </div>
      <div class="detail-exchange">
        ${sideMarkup(trade.offered, trade.mode, 'give')}
        <div class="trade-card-swap" aria-hidden="true"><span><i class="fa-solid fa-arrow-right-arrow-left"></i></span></div>
        ${sideMarkup(trade.wanted, trade.mode, 'want')}
      </div>
      ${trade.note ? `<p class="detail-note"><i class="fa-regular fa-message" aria-hidden="true"></i> ${escapeHtml(trade.note)}</p>` : ''}
      <p class="detail-value-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>Les valeurs ${mode.unit} viennent du wiki Blox Fruits sur Fandom. Elles servent uniquement de repère et ne déterminent pas la demande réelle entre joueurs.</span></p>
      ${canRespond ? counterFormMarkup() : ''}
      <section class="counteroffer-history" aria-labelledby="counter-history-title">
        <h3 id="counter-history-title">Réponses locales (${trade.responses.length})</h3>
        <p>Ces réponses simulent l'activité sur cet appareil ; elles ne sont pas envoyées au joueur.</p>
        ${responseMarkup}
      </section>`;
  }

  function counterFormMarkup() {
    return `
      <section class="counteroffer-panel" aria-labelledby="counteroffer-title">
        <h3 id="counteroffer-title">Simuler une contre-offre</h3>
        <p>Indique ton pseudo et ce que tu proposes. Rien n'est envoyé hors de ce navigateur.</p>
        <form class="counteroffer-form" id="counteroffer-form" novalidate>
          <div class="form-grid">
            <div class="field-group">
              <label for="counter-username">Ton pseudo Roblox</label>
              <input id="counter-username" type="text" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" placeholder="Ex. AtlasGaming" autocomplete="off" aria-describedby="counter-username-error">
              <span class="field-error" id="counter-username-error" aria-live="polite"></span>
            </div>
            <div class="field-group trade-note-field">
              <label for="counter-note">Message <span>facultatif</span></label>
              <input id="counter-note" type="text" maxlength="160" placeholder="Ex. Disponible maintenant" autocomplete="off">
            </div>
          </div>
          <fieldset class="trade-fruit-fieldset counter-fruit-fieldset" data-picker-fieldset="counter" aria-describedby="counter-error" tabindex="-1">
            <legend><span class="picker-step give"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></span><span><strong>Tu proposes en échange</strong><small>Sélectionne 1 à 4 fruits</small></span></legend>
            <label class="picker-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="sr-only">Rechercher un fruit pour la contre-offre</span><input type="search" placeholder="Rechercher…" data-picker-search="counter" autocomplete="off"></label>
            <div class="selected-fruits" id="counter-selected" aria-live="polite"><span>Aucun fruit sélectionné</span></div>
            <div class="fruit-picker-list" id="counter-picker" role="group" aria-label="Fruits de la contre-offre"></div>
            <span class="field-error" id="counter-error" aria-live="polite"></span>
          </fieldset>
          <div class="counter-form-actions">
            <button class="btn btn-secondary" type="button" data-share-active><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Partager l'annonce</button>
            <button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Enregistrer dans la démo</button>
          </div>
        </form>
      </section>`;
  }

  function detailFooter(trade) {
    const ownerActions = trade.owned
      ? `<div class="detail-owner-actions">
          <button class="btn btn-secondary" type="button" data-owner-status="${trade.status === 'open' ? 'completed' : 'open'}"><i class="fa-solid ${trade.status === 'open' ? 'fa-circle-check' : 'fa-rotate-left'}" aria-hidden="true"></i>${trade.status === 'open' ? 'Marquer terminée' : 'Rouvrir'}</button>
          <button class="btn btn-danger-soft" type="button" data-delete-trade><i class="fa-solid fa-trash-can" aria-hidden="true"></i> Supprimer</button>
        </div>`
      : '';
    return `${ownerActions}
      <button class="btn btn-secondary" type="button" data-share-active><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Partager</button>
      <button class="btn btn-primary" type="button" data-close-detail>Fermer</button>`;
  }

  function renderTradeDetail() {
    const trade = state.trades.find((item) => item.id === state.activeTradeId);
    if (!trade) {
      closeDetail();
      return;
    }
    byId('trade-detail-title').textContent = `Offre de ${trade.username}`;
    byId('trade-detail-body').innerHTML = detailMarkup(trade);
    byId('trade-detail-foot').innerHTML = detailFooter(trade);
    if (!trade.owned && trade.status === 'open') renderPicker('counter');
  }

  function openTradeDetail(tradeId, trigger) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    state.activeTradeId = tradeId;
    state.counter.clear();
    renderTradeDetail();
    const modal = byId('trade-detail-modal');
    $('.trade-detail-card', modal).scrollTop = 0;
    openModal(modal, trigger);
    window.requestAnimationFrame(() => byId('trade-detail-title').focus());
  }

  function closeDetail() {
    closeModal(byId('trade-detail-modal'));
    state.activeTradeId = null;
    state.counter.clear();
  }

  function submitCounteroffer(event) {
    if (!event.target.matches('#counteroffer-form')) return;
    event.preventDefault();
    if (isSubmitting) return;
    const trade = state.trades.find((item) => item.id === state.activeTradeId);
    if (!trade || trade.status !== 'open' || trade.owned) {
      showToast('Cette offre ne peut plus recevoir de réponse.', 'warning');
      return;
    }

    const usernameInput = byId('counter-username');
    const usernameError = byId('counter-username-error');
    const fieldset = $('[data-picker-fieldset="counter"]');
    const pickerError = byId('counter-error');
    usernameInput.removeAttribute('aria-invalid');
    fieldset.classList.remove('has-error');
    fieldset.removeAttribute('aria-invalid');
    usernameError.textContent = '';
    pickerError.textContent = '';

    const username = usernameInput.value.trim();
    if (!USERNAME_PATTERN.test(username)) {
      usernameInput.setAttribute('aria-invalid', 'true');
      usernameError.textContent = 'Utilise 3 à 20 lettres, chiffres ou underscores.';
      usernameInput.focus();
      return;
    }
    if (!state.counter.size) {
      fieldset.classList.add('has-error');
      fieldset.setAttribute('aria-invalid', 'true');
      pickerError.textContent = 'Sélectionne au moins un fruit pour ta contre-offre.';
      fieldset.focus();
      return;
    }
    const sourceIds = new Set(trade.offered.map((line) => line.fruitId));
    if ([...state.counter].some((fruitId) => sourceIds.has(fruitId))) {
      fieldset.classList.add('has-error');
      fieldset.setAttribute('aria-invalid', 'true');
      pickerError.textContent = 'Choisis un fruit différent de ceux proposés par ce joueur.';
      fieldset.focus();
      return;
    }

    isSubmitting = true;
    trade.responses.push({
      id: uniqueId('counter'),
      username,
      offered: [...state.counter].map((fruitId) => ({ fruitId, quantity: 1 })),
      note: byId('counter-note').value.trim().slice(0, 160),
      createdAt: new Date().toISOString()
    });
    persistTrades();
    state.counter.clear();
    renderTrades();
    renderTradeDetail();
    window.requestAnimationFrame(() => byId('trade-detail-title').focus());
    showToast('Contre-offre enregistrée dans cette démo locale.');
    announce('Contre-offre enregistrée localement.');
    window.setTimeout(() => { isSubmitting = false; }, 0);
  }

  function toggleSaved(tradeId) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    if (state.saved.has(tradeId)) {
      state.saved.delete(tradeId);
      showToast('Offre retirée des sauvegardées.');
    } else {
      state.saved.add(tradeId);
      showToast('Offre sauvegardée sur cet appareil.');
    }
    persistSaved();
    renderTrades();
    window.requestAnimationFrame(() => document.querySelector(`[data-save-trade="${tradeId}"]`)?.focus());
  }

  function updateOwnedStatus(status) {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned);
    if (!trade || !['open', 'completed'].includes(status)) return;
    trade.status = status;
    persistTrades();
    renderTrades();
    renderTradeDetail();
    showToast(status === 'completed' ? 'Offre marquée comme terminée.' : 'Offre rouverte.');
  }

  function deleteOwnedTrade() {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned);
    if (!trade) return;
    if (!window.confirm('Supprimer définitivement cette offre locale ?')) return;
    state.trades = state.trades.filter((item) => item.id !== trade.id);
    state.saved.delete(trade.id);
    persistTrades();
    persistSaved();
    closeDetail();
    renderTrades();
    showToast('Offre locale supprimée.');
    announce('Offre supprimée.');
  }

  function tradeShareMessage(trade) {
    const mode = modeCopy(trade.mode);
    const list = (lines) => lines.map((line) => `${line.quantity > 1 ? `${line.quantity}× ` : ''}${fruitById.get(line.fruitId)?.name || ''}`).join(' + ');
    return [
      'Salam, voici une offre Itemsouq Trading (démo) :',
      '',
      `Joueur : ${trade.username}`,
      `Format : ${mode.label}`,
      `Propose : ${list(trade.offered)} (${formatValue(linesValue(trade.offered, trade.mode), trade.mode)})`,
      `Recherche : ${list(trade.wanted)} (${formatValue(linesValue(trade.wanted, trade.mode), trade.mode)})`,
      trade.note ? `Message : ${trade.note}` : '',
      '',
      'Merci de tout vérifier dans la fenêtre d’échange. Ne partage jamais ton mot de passe, PIN ou OTP.'
    ].filter(Boolean).join('\n');
  }

  function shareTrade(tradeId) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    const anchor = document.createElement('a');
    anchor.href = `https://wa.me/?text=${encodeURIComponent(tradeShareMessage(trade))}`;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    showToast('Message préparé. Choisis ton contact dans WhatsApp.');
  }

  function resetTradingDemo() {
    if (!window.confirm('Réinitialiser uniquement les offres Trading de ce navigateur ?')) return;
    try {
      localStorage.removeItem(STORAGE.trades);
      localStorage.removeItem(STORAGE.saved);
    } catch (error) {
      showToast('Impossible de modifier le stockage local.', 'warning');
      return;
    }
    state.trades = demoTrades();
    state.saved.clear();
    persistTrades();
    persistSaved();
    resetFilters();
    showToast('La démo Trading a été réinitialisée.');
  }

  function toggleMobileMenu(restoreFocus = false) {
    const menu = byId('mobile-menu');
    const trigger = $('.mobile-menu-trigger');
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    $('i', trigger).className = `fa-solid ${open ? 'fa-xmark' : 'fa-bars'}`;
    if (!open && restoreFocus) {
      window.requestAnimationFrame(() => {
        const target = trigger.offsetParent !== null ? trigger : $('.desktop-nav .nav-active');
        target?.focus();
      });
    }
  }

  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function attachEvents() {
    $$('[data-open-create]').forEach((button) => button.addEventListener('click', () => openCreate(button)));
    $$('[data-close-create]').forEach((button) => button.addEventListener('click', closeCreate));
    $$('[data-close-detail]').forEach((button) => button.addEventListener('click', closeDetail));
    byId('create-trade-form').addEventListener('submit', submitCreate);
    byId('trade-detail-body').addEventListener('submit', submitCounteroffer);

    byId('trade-search').addEventListener('input', (event) => {
      state.search = event.target.value;
      renderTrades();
    });
    byId('trade-mode-filter').addEventListener('change', (event) => {
      state.mode = event.target.value;
      updateValueSortAvailability();
      renderTrades();
    });
    byId('trade-side-filter').addEventListener('change', (event) => {
      state.side = event.target.value;
      renderTrades();
    });
    byId('trade-status-filter').addEventListener('change', (event) => {
      state.status = event.target.value;
      renderTrades();
    });
    byId('trade-sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      renderTrades();
    });
    byId('clear-trade-filters').addEventListener('click', resetFilters);
    byId('trade-empty-action').addEventListener('click', (event) => {
      if (event.currentTarget.dataset.emptyMode === 'create') openCreate(event.currentTarget);
      else resetFilters();
    });
    byId('reset-trading-demo').addEventListener('click', resetTradingDemo);

    $$('.trade-tab').forEach((tab) => tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      $$('.trade-tab').forEach((item) => {
        const active = item === tab;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderTrades();
    }));

    byId('trade-grid').addEventListener('click', (event) => {
      const save = event.target.closest('[data-save-trade]');
      const view = event.target.closest('[data-view-trade]');
      const share = event.target.closest('[data-share-trade]');
      if (save) toggleSaved(save.dataset.saveTrade);
      else if (view) openTradeDetail(view.dataset.viewTrade, view);
      else if (share) shareTrade(share.dataset.shareTrade);
    });

    document.addEventListener('click', (event) => {
      const picker = event.target.closest('[data-picker]');
      const remove = event.target.closest('[data-picker-remove]');
      const ownerStatus = event.target.closest('[data-owner-status]');
      if (picker) togglePickerFruit(picker.dataset.picker, picker.dataset.fruitId);
      else if (remove) togglePickerFruit(remove.dataset.pickerRemove, remove.dataset.fruitId);
      else if (ownerStatus) updateOwnedStatus(ownerStatus.dataset.ownerStatus);
      else if (event.target.closest('[data-delete-trade]')) deleteOwnedTrade();
      else if (event.target.closest('[data-share-active]') && state.activeTradeId) shareTrade(state.activeTradeId);
      else if (event.target.closest('[data-close-detail]')) closeDetail();
    });

    $$('[data-picker-search]').forEach((input) => input.addEventListener('input', (event) => {
      renderPicker(event.target.dataset.pickerSearch, event.target.value);
    }));
    byId('trade-detail-body').addEventListener('input', (event) => {
      if (event.target.matches('[data-picker-search="counter"]')) renderPicker('counter', event.target.value);
    });
    byId('trade-mode').addEventListener('change', updateCreateValuePreview);
    byId('trade-note').addEventListener('input', (event) => {
      byId('trade-note-count').textContent = String(event.target.value.length);
    });
    byId('trade-username').addEventListener('input', () => {
      byId('trade-username').removeAttribute('aria-invalid');
      $('[data-trade-error="username"]').textContent = '';
    });

    $('.mobile-menu-trigger').addEventListener('click', () => toggleMobileMenu(false));
    $$('#mobile-menu a').forEach((link) => link.addEventListener('click', () => {
      if (!byId('mobile-menu').hidden) toggleMobileMenu();
    }));

    [byId('create-trade-modal'), byId('trade-detail-modal')].forEach((modal) => modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      if (modal.id === 'create-trade-modal') closeCreate();
      else closeDetail();
    }));

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !activeModal) {
        event.preventDefault();
        byId('trade-search').focus();
        byId('trading-feed').scrollIntoView({ behavior: 'smooth' });
      }
      if (event.key === 'Escape') {
        if (activeModal?.id === 'create-trade-modal') closeCreate();
        else if (activeModal?.id === 'trade-detail-modal') closeDetail();
        else if (!byId('mobile-menu').hidden) toggleMobileMenu(true);
      }
      const pickerOption = event.target.closest('[data-picker]');
      if (pickerOption && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const kind = pickerOption.dataset.picker;
        const options = $$(`[data-picker="${kind}"]:not([disabled])`, pickerContainer(kind));
        const currentIndex = options.indexOf(pickerOption);
        let nextIndex = currentIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = options.length - 1;
        else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % options.length;
        else nextIndex = (currentIndex - 1 + options.length) % options.length;
        options.forEach((option) => { option.tabIndex = -1; });
        options[nextIndex].tabIndex = 0;
        options[nextIndex].focus();
      }
      if (activeModal) trapFocus(activeModal, event);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 920 && !byId('mobile-menu').hidden) toggleMobileMenu(true);
    });
  }

  function validateDataset() {
    if (fruits.length !== 41) console.warn(`Itemsouq Trading: expected 41 fruits, received ${fruits.length}.`);
  }

  function init() {
    validateDataset();
    hydrateState();
    attachEvents();
    updateValueSortAvailability();
    renderAllPickers();
    renderTrades();
  }

  init();
})();
