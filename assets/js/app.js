/* Itemsouq Fruits — static storefront demo */
(function () {
  'use strict';

  const fruits = Array.isArray(window.ITEMSOUQ_FRUITS) ? window.ITEMSOUQ_FRUITS : [];
  const config = window.ITEMSOUQ_CONFIG && typeof window.ITEMSOUQ_CONFIG === 'object'
    ? window.ITEMSOUQ_CONFIG
    : {};
  const i18n = window.ITEMSOUQ_I18N && typeof window.ITEMSOUQ_I18N === 'object'
    ? window.ITEMSOUQ_I18N
    : null;
  const l = (key, fallback, variables) => i18n?.t(key, fallback, variables) ?? fallback;
  const sellerWhatsAppNumber = String(config.whatsappNumber || '').replace(/\D/g, '');
  const STORAGE = {
    cart: 'itemsouq:fruits:v1:cart',
    favorites: 'itemsouq:fruits:v1:favorites',
    compare: 'itemsouq:fruits:v1:compare',
    recent: 'itemsouq:fruits:v1:recent',
    preferences: 'itemsouq:fruits:v1:preferences',
    filters: 'itemsouq:fruits:v1:filters',
    actionHintSeen: 'itemsouq:ui:v1:action-hint-seen',
    orderTrackers: 'itemsouq:fruits:v1:order-trackers',
    orderSession: 'itemsouq:fruits:v1:order-session',
    tradeListings: 'itemsouq:trading:v3:listings',
    savedTrades: 'itemsouq:trading:v3:saved',
    tradeDraft: 'itemsouq:trading:v3:draft'
  };

  const ORDER_STAGE_IDS = ['prepared', 'seller-contacted', 'payment-pending', 'delivered'];
  const mobileFilterMedia = window.matchMedia('(max-width: 680px)');

  const rarityLabels = {
    Common: 'Commun',
    Uncommon: 'Peu commun',
    Rare: 'Rare',
    Legendary: 'Légendaire',
    Mythical: 'Mythique'
  };

  const typeLabels = {
    Natural: 'Naturel',
    Elemental: 'Élémentaire',
    Beast: 'Bête'
  };
  const rarityLabel = (rarity) => l(`rarity.${rarity}`, rarityLabels[rarity] || rarity);
  const typeLabel = (type) => l(`type.${type}`, typeLabels[type] || type);

  const rarityRank = {
    Common: 1,
    Uncommon: 2,
    Rare: 3,
    Legendary: 4,
    Mythical: 5
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = (id) => document.getElementById(id);
  const reduceMotionPreference = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const fruitById = new Map(fruits.map((fruit) => [slugify(fruit.name), fruit]));

  const state = {
    mode: 'physical',
    search: '',
    rarity: 'all',
    type: 'all',
    sort: 'featured',
    visible: 12,
    favoriteOnly: false,
    favorites: new Set(),
    cart: [],
    compare: [],
    recent: [],
    budget: null,
    preferences: { payment: '', city: '' },
    actionHintSeen: false,
    orderTrackers: {},
    orderSession: null
  };

  let toastTimer = null;
  let overlayReturnFocus = null;
  let activeOverlay = null;
  let activeQuickView = null;
  let checkoutMessagePrepared = false;
  let storageWarningShown = false;
  let filterSheetTimer = null;
  let filterSheetClosing = false;

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
      if (!storageWarningShown) {
        storageWarningShown = true;
        showToast(l('storage.unavailable', 'Le stockage local est indisponible sur ce navigateur.'), 'warning');
      }
      return false;
    }
  }

  function escapeAttribute(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]);
  }

  function sanitizeFavorites(input) {
    if (!Array.isArray(input)) return [];
    return [...new Set(input.filter((id) => typeof id === 'string' && fruitById.has(id)))];
  }

  function sanitizeIdList(input, limit = 6) {
    if (!Array.isArray(input)) return [];
    return [...new Set(input.filter((id) => typeof id === 'string' && fruitById.has(id)))].slice(0, limit);
  }

  function sanitizeCompare(input) {
    if (!Array.isArray(input)) return [];
    const clean = [];
    input.forEach((entry) => {
      if (!entry || typeof entry !== 'object' || clean.length >= 3) return;
      const id = typeof entry.id === 'string' ? entry.id : '';
      const mode = entry.mode === 'permanent' ? 'permanent' : entry.mode === 'physical' ? 'physical' : '';
      if (!fruitById.has(id) || !mode || clean.some((item) => item.id === id && item.mode === mode)) return;
      clean.push({ id, mode });
    });
    return clean;
  }

  function sanitizePreferences(input) {
    const validPayments = new Set(['', 'Cash Plus', 'Wafacash']);
    const validCities = new Set(['', 'Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Oujda', 'Meknès', 'Autre']);
    return {
      payment: validPayments.has(input?.payment) ? input.payment : '',
      city: validCities.has(input?.city) ? input.city : ''
    };
  }

  function sanitizeFilters(input) {
    const rarity = new Set(['all', 'Common', 'Uncommon', 'Rare', 'Legendary', 'Mythical']);
    const type = new Set(['all', 'Natural', 'Elemental', 'Beast']);
    const sort = new Set(['featured', 'value-desc', 'value-asc', 'name']);
    const budget = Number(input?.budget);
    return {
      mode: input?.mode === 'permanent' ? 'permanent' : 'physical',
      search: typeof input?.search === 'string' ? input.search.slice(0, 80) : '',
      rarity: rarity.has(input?.rarity) ? input.rarity : 'all',
      type: type.has(input?.type) ? input.type : 'all',
      sort: sort.has(input?.sort) ? input.sort : 'featured',
      favoriteOnly: input?.favoriteOnly === true,
      budget: Number.isFinite(budget) && budget >= 10 && budget <= 5000 ? budget : null
    };
  }

  function sanitizeOrderTrackers(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const clean = {};
    Object.entries(input).slice(-16).forEach(([reference, record]) => {
      if (!/^ISQ-\d{4,6}$/.test(reference) || !record || typeof record !== 'object') return;
      const stage = ORDER_STAGE_IDS.includes(record.stage) ? record.stage : '';
      if (!stage) return;
      const updated = new Date(record.updatedAt);
      clean[reference] = {
        stage,
        updatedAt: Number.isNaN(updated.getTime()) ? new Date(0).toISOString() : updated.toISOString()
      };
    });
    return clean;
  }

  function sanitizeOrderSession(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const reference = typeof input.reference === 'string' && /^ISQ-\d{4,6}$/.test(input.reference)
      ? input.reference
      : '';
    const signature = typeof input.signature === 'string' ? input.signature.slice(0, 500) : '';
    const createdAt = new Date(input.createdAt);
    if (!reference || !signature || Number.isNaN(createdAt.getTime())) return null;
    return { reference, signature, createdAt: createdAt.toISOString() };
  }

  function sanitizeCart(input) {
    if (!Array.isArray(input)) return [];

    const merged = new Map();
    input.forEach((line) => {
      if (!line || typeof line !== 'object') return;
      const id = typeof line.id === 'string' ? line.id : '';
      const mode = line.mode === 'permanent' ? 'permanent' : line.mode === 'physical' ? 'physical' : '';
      if (!fruitById.has(id) || !mode) return;

      const fruit = fruitById.get(id);
      const stock = stockFor(fruit, mode);
      const requested = Number.parseInt(line.quantity, 10);
      const quantity = Math.min(stock, Math.max(1, Number.isFinite(requested) ? requested : 1));
      const key = `${id}:${mode}`;

      if (merged.has(key)) {
        merged.get(key).quantity = Math.min(stock, merged.get(key).quantity + quantity);
      } else {
        merged.set(key, { id, mode, quantity });
      }
    });

    return [...merged.values()];
  }

  function hydrateState() {
    const savedFilters = sanitizeFilters(safeJsonRead(STORAGE.filters, {}));
    Object.assign(state, savedFilters);
    if (state.budget !== null && state.budget >= budgetCeiling(state.mode)) state.budget = null;
    state.favorites = new Set(sanitizeFavorites(safeJsonRead(STORAGE.favorites, [])));
    state.cart = sanitizeCart(safeJsonRead(STORAGE.cart, []));
    state.compare = sanitizeCompare(safeJsonRead(STORAGE.compare, []));
    state.recent = sanitizeIdList(safeJsonRead(STORAGE.recent, []));
    state.preferences = sanitizePreferences(safeJsonRead(STORAGE.preferences, {}));
    state.actionHintSeen = safeJsonRead(STORAGE.actionHintSeen, false) === true;
    state.orderTrackers = sanitizeOrderTrackers(safeJsonRead(STORAGE.orderTrackers, {}));
    state.orderSession = sanitizeOrderSession(safeJsonRead(STORAGE.orderSession, null));
    persistCart();
    persistFavorites();
    persistCompare();
    persistRecent();
    persistPreferences();
    persistFilters();
    persistOrderTrackers();
    persistOrderSession();
  }

  function persistCart() {
    safeJsonWrite(STORAGE.cart, state.cart);
  }

  function persistFavorites() {
    safeJsonWrite(STORAGE.favorites, [...state.favorites]);
  }

  function persistCompare() {
    safeJsonWrite(STORAGE.compare, state.compare);
  }

  function persistRecent() {
    safeJsonWrite(STORAGE.recent, state.recent);
  }

  function persistPreferences() {
    safeJsonWrite(STORAGE.preferences, state.preferences);
  }

  function persistFilters() {
    safeJsonWrite(STORAGE.filters, {
      mode: state.mode,
      search: state.search,
      rarity: state.rarity,
      type: state.type,
      sort: state.sort,
      favoriteOnly: state.favoriteOnly,
      budget: state.budget
    });
  }

  function persistOrderTrackers() {
    const entries = Object.entries(state.orderTrackers)
      .sort(([, a], [, b]) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
      .slice(-12);
    state.orderTrackers = Object.fromEntries(entries);
    safeJsonWrite(STORAGE.orderTrackers, state.orderTrackers);
  }

  function persistOrderSession() {
    safeJsonWrite(STORAGE.orderSession, state.orderSession);
  }

  function roundToFive(value) {
    return Math.ceil(value / 5) * 5;
  }

  function demoPrice(fruit, mode) {
    if (!fruit || !Number.isFinite(fruit.beli) || !Number.isFinite(fruit.robux)) return null;
    if (mode === 'permanent') return roundToFive(Math.max(25, fruit.robux * 0.15));
    return roundToFive(Math.max(10, Math.sqrt(fruit.beli) * 0.04));
  }

  function budgetCeiling(mode = state.mode) {
    const highest = fruits.reduce((max, fruit) => Math.max(max, demoPrice(fruit, mode) || 0), 0);
    return Math.max(50, Math.ceil(highest / 50) * 50);
  }

  function stockFor(fruit, mode) {
    if (mode === 'permanent') return 1;
    const seed = [...fruit.name].reduce((total, char) => total + char.charCodeAt(0), 0);
    return (seed % 5) + 1;
  }

  function formatMad(value) {
    if (!Number.isFinite(value) || value < 0) return l('price.onRequest', 'Sur demande');
    return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(value)} MAD`;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
  }

  function whatsappUrl(message) {
    const recipient = sellerWhatsAppNumber ? `/${sellerWhatsAppNumber}` : '/';
    return `https://wa.me${recipient}?text=${encodeURIComponent(message)}`;
  }

  function prepareStaticWhatsAppLinks() {
    $$('[data-whatsapp-message]').forEach((link) => {
      const message = link.dataset.whatsappI18n
        ? l(link.dataset.whatsappI18n, link.dataset.whatsappMessage || '')
        : (link.dataset.whatsappMessage || '');
      link.href = whatsappUrl(message);
    });
  }

  function initials(name) {
    return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();
  }

  function fruitImagePath(fruit) {
    return `assets/images/fruits/${slugify(fruit.name)}.webp`;
  }

  function wireFruitImageFallbacks(root = document) {
    $$('img[data-fruit-image]', root).forEach((image) => {
      const showFallback = () => image.parentElement?.classList.add('image-missing');
      image.addEventListener('error', showFallback, { once: true });
      if (image.complete && image.naturalWidth === 0) showFallback();
    });
  }

  function typeIcon(type) {
    if (type === 'Elemental') return 'fa-fire-flame-curved';
    if (type === 'Beast') return 'fa-paw';
    return 'fa-leaf';
  }

  function fruitVisualClasses(fruit) {
    const rarity = fruit.rarity.toLowerCase();
    return {
      visual: `visual-${rarity}`,
      core: `core-${rarity}`,
      tag: `rarity-${rarity}`
    };
  }

  function officialValue(fruit, mode) {
    return mode === 'permanent'
      ? `${formatNumber(fruit.robux)} Robux`
      : `${formatNumber(fruit.beli)} Beli`;
  }

  function modeCopy(mode) {
    return mode === 'permanent'
      ? { short: l('mode.permanent', 'Permanent'), long: l('mode.permanentLong', 'Fruit permanent'), icon: 'fa-infinity' }
      : { short: l('mode.physical', 'Physique'), long: l('mode.physicalLong', 'Fruit physique'), icon: 'fa-box-open' };
  }

  function filteredFruits() {
    const query = state.search.trim().toLocaleLowerCase('fr');
    const valueForMode = (fruit) => state.mode === 'permanent' ? fruit.robux : fruit.beli;

    const result = fruits.filter((fruit) => {
      const matchesSearch = !query || fruit.name.toLocaleLowerCase('fr').includes(query);
      const matchesRarity = state.rarity === 'all' || fruit.rarity === state.rarity;
      const matchesType = state.type === 'all' || fruit.type === state.type;
      const matchesFavorite = !state.favoriteOnly || state.favorites.has(slugify(fruit.name));
      const price = demoPrice(fruit, state.mode);
      const matchesBudget = state.budget === null || (Number.isFinite(price) && price <= state.budget);
      return matchesSearch && matchesRarity && matchesType && matchesFavorite && matchesBudget;
    });

    result.sort((a, b) => {
      if (state.sort === 'name') return a.name.localeCompare(b.name);
      if (state.sort === 'value-asc') return valueForMode(a) - valueForMode(b);
      if (state.sort === 'value-desc') return valueForMode(b) - valueForMode(a);
      return rarityRank[b.rarity] - rarityRank[a.rarity] || valueForMode(b) - valueForMode(a);
    });

    return result;
  }

  function createFruitCard(fruit) {
    const id = slugify(fruit.name);
    const classes = fruitVisualClasses(fruit);
    const favorite = state.favorites.has(id);
    const compared = state.compare.some((entry) => entry.id === id && entry.mode === state.mode);
    const mode = modeCopy(state.mode);
    const price = demoPrice(fruit, state.mode);
    const stock = stockFor(fruit, state.mode);
    const quickMessage = l(
      'whatsapp.fruitInquiry',
      `Salam Itemsouq, je veux vérifier ${fruit.name} (${mode.long}) — prix démo ${formatMad(price)}.`,
      { fruit: fruit.name, mode: mode.long, price: formatMad(price) }
    );
    const quickLabel = sellerWhatsAppNumber
      ? l('aria.askSellerWhatsApp', `Demander ${fruit.name} au vendeur sur WhatsApp`, { fruit: fruit.name })
      : l('aria.prepareFruitWhatsApp', `Préparer une demande pour ${fruit.name} dans WhatsApp`, { fruit: fruit.name });
    const compareLabel = compared
      ? l('aria.removeFromCompare', `Retirer ${fruit.name} de la comparaison`, { fruit: fruit.name })
      : l('aria.addToCompare', `Ajouter ${fruit.name} à la comparaison`, { fruit: fruit.name });
    const favoriteLabel = favorite
      ? l('aria.removeFavorite', `Retirer ${fruit.name} des favoris`, { fruit: fruit.name })
      : l('aria.addFavorite', `Ajouter ${fruit.name} aux favoris`, { fruit: fruit.name });

    return `
      <article class="fruit-card" id="fruit-${id}" data-fruit-id="${id}">
        <div class="fruit-card-head">
          <span class="rarity-tag ${classes.tag}">${rarityLabel(fruit.rarity)}</span>
          <span class="fruit-card-head-actions">
            <button class="compare-button${compared ? ' active' : ''}" type="button" data-compare="${id}" data-mode="${state.mode}" aria-label="${escapeAttribute(compareLabel)}" title="${escapeAttribute(compareLabel)}" aria-pressed="${compared}">
              <i class="fa-solid fa-code-compare" aria-hidden="true"></i>
            </button>
            <button class="favorite-button${favorite ? ' active' : ''}" type="button" data-favorite="${id}" aria-label="${escapeAttribute(favoriteLabel)}" title="${escapeAttribute(favoriteLabel)}" aria-pressed="${favorite}">
              <i class="fa-${favorite ? 'solid' : 'regular'} fa-heart" aria-hidden="true"></i>
            </button>
          </span>
        </div>
        <div class="fruit-visual ${classes.visual}">
          <div class="fruit-core ${classes.core}">
            <img class="fruit-image" data-fruit-image src="${fruitImagePath(fruit)}" alt="" width="512" height="512" loading="lazy" decoding="async">
            <span aria-hidden="true">${initials(fruit.name)}</span>
          </div>
          <span class="type-badge"><i class="fa-solid ${typeIcon(fruit.type)}" aria-hidden="true"></i>${typeLabel(fruit.type)}</span>
          <button class="fruit-quick-view" type="button" data-quick-view="${id}" data-mode="${state.mode}" aria-label="${l('aria.viewFruitDetails', `Voir les détails de ${fruit.name}`, { fruit: fruit.name })}"><i class="fa-solid fa-eye" aria-hidden="true"></i> ${l('card.preview', 'Aperçu')}</button>
        </div>
        <div class="fruit-content">
          <div class="fruit-title-row">
            <h3>${fruit.name}</h3>
          </div>
          <div class="fruit-essential-meta">
            <span class="mode-label"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.short}</span>
            <span class="stock-chip">${l('card.stock', `Stock démo ${stock}`, { count: stock })}</span>
          </div>
          <div class="card-price">
            <span>${l('card.demoPrice', 'Prix démo Itemsouq')}<strong>${formatMad(price)}</strong></span>
          </div>
          <div class="official-value">
            <span>${l('card.wiki', 'Valeur wiki')}</span>
            <strong>${officialValue(fruit, state.mode)}</strong>
          </div>
          <div class="card-actions">
            <button class="add-cart-button" type="button" data-add="${id}" data-mode="${state.mode}">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> ${l('card.add', 'Ajouter')}
            </button>
            <a class="quick-whatsapp" href="${whatsappUrl(quickMessage)}" target="_blank" rel="noopener" aria-label="${escapeAttribute(quickLabel)}" title="${escapeAttribute(quickLabel)}">
              <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function renderCatalogue() {
    const grid = byId('fruit-grid');
    const empty = byId('empty-results');
    const loadMore = byId('load-more');
    const clearFilters = byId('clear-filters');
    const results = filteredFruits();
    const visible = results.slice(0, state.visible);
    const hasFilters = Boolean(state.search.trim()) || state.rarity !== 'all' || state.type !== 'all' || state.sort !== 'featured' || state.favoriteOnly || state.budget !== null;

    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = visible.map(createFruitCard).join('');
    grid.hidden = visible.length === 0;
    empty.hidden = visible.length !== 0;
    loadMore.hidden = results.length <= state.visible || results.length === 0;
    clearFilters.hidden = !hasFilters;
    wireFruitImageFallbacks(grid);

    byId('results-count').textContent = state.favoriteOnly
      ? l('results.favoriteCount', `${results.length} fruit${results.length > 1 ? 's' : ''} favori${results.length > 1 ? 's' : ''} disponible${results.length > 1 ? 's' : ''}`, { count: results.length })
      : l('results.count', `${results.length} fruit${results.length > 1 ? 's' : ''} disponible${results.length > 1 ? 's' : ''}`, { count: results.length });
    renderActiveFilterUi(results.length);
    updateBudgetUi();
    updateFavoriteTrigger();
    renderCompareTray();
    updateSouqIndicators();
    window.requestAnimationFrame(() => grid.setAttribute('aria-busy', 'false'));
  }

  function updateBudgetUi() {
    const range = byId('budget-range');
    const output = byId('budget-output');
    if (!range || !output) return;
    const ceiling = budgetCeiling();
    range.max = String(ceiling);
    range.value = String(state.budget === null ? ceiling : Math.min(state.budget, ceiling));
    const label = state.budget === null
      ? l('budget.all', 'Tous les budgets')
      : l('budget.upTo', `Jusqu'à ${formatMad(state.budget)}`, { amount: formatMad(state.budget) });
    output.textContent = label;
    range.setAttribute('aria-valuetext', label);
    $$('[data-budget]').forEach((button) => {
      const value = button.dataset.budget;
      const active = value === 'all' ? state.budget === null : Number(value) === state.budget;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function syncFilterControls() {
    byId('fruit-search').value = state.search;
    byId('rarity-filter').value = state.rarity;
    byId('type-filter').value = state.type;
    byId('sort-fruits').value = state.sort;
    $$('.variant-option').forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateBudgetUi();
  }

  function activeFilterDescriptors() {
    const descriptors = [];
    if (state.rarity !== 'all') {
      descriptors.push({
        key: 'rarity',
        label: l('filter.chipRarity', `Rareté : ${rarityLabel(state.rarity)}`, { value: rarityLabel(state.rarity) })
      });
    }
    if (state.type !== 'all') {
      descriptors.push({
        key: 'type',
        label: l('filter.chipType', `Type : ${typeLabel(state.type)}`, { value: typeLabel(state.type) })
      });
    }
    if (state.budget !== null) {
      descriptors.push({
        key: 'budget',
        label: l('filter.chipBudget', `Budget : ${formatMad(state.budget)}`, { value: formatMad(state.budget) })
      });
    }
    if (state.favoriteOnly) {
      descriptors.push({ key: 'favorites', label: l('filter.chipFavorites', 'Favoris seulement') });
    }
    if (state.sort !== 'featured') {
      const sortLabels = {
        'value-desc': l('sort.valueDesc', 'Valeur décroissante'),
        'value-asc': l('sort.valueAsc', 'Valeur croissante'),
        name: l('sort.name', 'Nom A–Z')
      };
      descriptors.push({
        key: 'sort',
        label: l('filter.chipSort', `Tri : ${sortLabels[state.sort]}`, { value: sortLabels[state.sort] })
      });
    }
    return descriptors;
  }

  function renderActiveFilterUi(resultCount = filteredFruits().length) {
    const chips = byId('active-filter-chips');
    const count = byId('mobile-filter-count');
    const doneLabel = byId('filter-sheet-done-label');
    const descriptors = activeFilterDescriptors();
    if (chips) {
      chips.innerHTML = descriptors.map((filter) => {
        const removeLabel = l('aria.removeFilter', `Retirer le filtre ${filter.label}`, { filter: filter.label });
        return `<button class="active-filter-chip" type="button" data-clear-filter="${filter.key}" aria-label="${escapeAttribute(removeLabel)}" title="${escapeAttribute(removeLabel)}"><span>${filter.label}</span><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
      }).join('');
      chips.hidden = descriptors.length === 0;
    }
    if (count) {
      count.textContent = String(descriptors.length);
      count.hidden = descriptors.length === 0;
      count.setAttribute('aria-label', l('filter.activeCount', `${descriptors.length} filtre(s) actif(s)`, { count: descriptors.length }));
    }
    if (doneLabel) {
      doneLabel.textContent = l('filter.showResults', `Voir les résultats (${resultCount})`, { count: resultCount });
    }
  }

  function clearSingleFilter(key) {
    if (key === 'rarity') state.rarity = 'all';
    else if (key === 'type') state.type = 'all';
    else if (key === 'budget') state.budget = null;
    else if (key === 'favorites') state.favoriteOnly = false;
    else if (key === 'sort') state.sort = 'featured';
    else return;
    state.visible = 12;
    persistFilters();
    syncFilterControls();
    renderCatalogue();
  }

  function resetSecondaryFilters() {
    state.rarity = 'all';
    state.type = 'all';
    state.sort = 'featured';
    state.favoriteOnly = false;
    state.budget = null;
    state.visible = 12;
    persistFilters();
    syncFilterControls();
    renderCatalogue();
  }

  function dismissActionHint() {
    state.actionHintSeen = true;
    safeJsonWrite(STORAGE.actionHintSeen, true);
    const hint = byId('mobile-action-hint');
    if (hint) hint.hidden = true;
  }

  function syncActionHint() {
    const hint = byId('mobile-action-hint');
    if (!hint) return;
    hint.hidden = state.actionHintSeen || !mobileFilterMedia.matches;
  }

  function resetFilters(options = {}) {
    state.search = '';
    state.rarity = 'all';
    state.type = 'all';
    state.favoriteOnly = false;
    state.budget = null;
    state.visible = 12;
    if (!options.keepSort) {
      state.sort = 'featured';
    }
    persistFilters();
    syncFilterControls();
    renderCatalogue();
  }

  function setMode(mode) {
    if (!['physical', 'permanent'].includes(mode)) return;
    state.mode = mode;
    state.visible = 12;
    if (state.budget !== null && state.budget >= budgetCeiling(mode)) state.budget = null;
    $$('.variant-option').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    persistFilters();
    renderCatalogue();
  }

  function toggleFavorite(id) {
    if (!fruitById.has(id)) return;
    dismissActionHint();
    const fruit = fruitById.get(id);
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast(l('favorite.removed', `${fruit.name} retiré des favoris.`, { fruit: fruit.name }));
    } else {
      state.favorites.add(id);
      showToast(l('favorite.added', `${fruit.name} ajouté aux favoris.`, { fruit: fruit.name }));
    }
    persistFavorites();
    renderCatalogue();
    if (!byId('souq-drawer')?.hidden) renderSouq();
    window.requestAnimationFrame(() => {
      const restored = $(`[data-favorite="${id}"]`) || $('.favorites-trigger');
      restored?.focus();
    });
  }

  function updateFavoriteTrigger() {
    const count = state.favorites.size;
    const countElement = byId('favorite-count');
    const trigger = $('.favorites-trigger');
    countElement.textContent = String(count);
    countElement.hidden = count === 0;
    trigger.classList.toggle('active', state.favoriteOnly);
    trigger.setAttribute('aria-pressed', String(state.favoriteOnly));
    trigger.setAttribute('aria-label', state.favoriteOnly
      ? l('aria.showAllFruits', 'Afficher tous les fruits')
      : l('aria.showFavoritesCount', `Afficher mes favoris (${count})`, { count }));
    const icon = $('i', trigger);
    icon.className = `fa-${state.favoriteOnly ? 'solid' : 'regular'} fa-heart`;
  }

  function updateSouqIndicators() {
    const personalCount = state.favorites.size + cartQuantity();
    const souqCount = byId('souq-count');
    const mobileSouqCount = byId('mobile-souq-count');
    const mobileCartCount = byId('mobile-cart-count');
    if (souqCount) {
      souqCount.textContent = String(personalCount);
      souqCount.hidden = personalCount === 0;
    }
    if (mobileSouqCount) {
      mobileSouqCount.textContent = String(state.favorites.size);
      mobileSouqCount.hidden = state.favorites.size === 0;
      mobileSouqCount.setAttribute('aria-label', l('aria.favoriteCount', `${state.favorites.size} favori${state.favorites.size > 1 ? 's' : ''}`, { count: state.favorites.size }));
    }
    if (mobileCartCount) {
      mobileCartCount.textContent = String(cartQuantity());
      mobileCartCount.hidden = cartQuantity() === 0;
      mobileCartCount.setAttribute('aria-label', l('aria.articleCount', `${cartQuantity()} article${cartQuantity() > 1 ? 's' : ''}`, { count: cartQuantity() }));
    }
  }

  function trackRecent(id) {
    if (!fruitById.has(id)) return;
    state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 6);
    persistRecent();
    updateSouqIndicators();
  }

  function isCompared(id, mode) {
    return state.compare.some((entry) => entry.id === id && entry.mode === mode);
  }

  function toggleCompare(id, mode, restoreFocus = true) {
    if (!fruitById.has(id) || !['physical', 'permanent'].includes(mode)) return;
    dismissActionHint();
    const existingIndex = state.compare.findIndex((entry) => entry.id === id && entry.mode === mode);
    if (existingIndex >= 0) {
      state.compare.splice(existingIndex, 1);
      showToast(l('compare.removed', `${fruitById.get(id).name} retiré de la comparaison.`, { fruit: fruitById.get(id).name }));
    } else if (state.compare.length >= 3) {
      showToast(l('compare.max', 'Tu peux comparer au maximum 3 fruits.'), 'warning');
      return;
    } else {
      state.compare.push({ id, mode });
      showToast(l('compare.added', `${fruitById.get(id).name} ajouté à la comparaison.`, { fruit: fruitById.get(id).name }));
    }
    persistCompare();
    renderCatalogue();
    if (activeQuickView?.id === id && activeQuickView.mode === mode) renderQuickView();
    if (!byId('compare-modal')?.hidden) renderCompareModal();
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        const target = $(`[data-compare="${id}"][data-mode="${mode}"]`) || byId('compare-open');
        target?.focus();
      });
    }
  }

  function renderCompareTray() {
    const tray = byId('compare-tray');
    const items = byId('compare-tray-items');
    const open = byId('compare-open');
    const help = byId('compare-tray-help');
    if (!tray || !items || !open || !help) return;
    tray.hidden = state.compare.length === 0;
    document.body.classList.toggle('compare-active', state.compare.length > 0);
    items.innerHTML = state.compare.map((entry) => {
      const fruit = fruitById.get(entry.id);
      const removeLabel = l('aria.removeModeFromCompare', `Retirer ${fruit.name} ${modeCopy(entry.mode).short} de la comparaison`, { fruit: fruit.name, mode: modeCopy(entry.mode).short });
      return `<span class="compare-chip"><img src="${fruitImagePath(fruit)}" alt="" width="512" height="512"><strong>${fruit.name}</strong><button type="button" data-remove-compare="${entry.id}" data-mode="${entry.mode}" aria-label="${escapeAttribute(removeLabel)}" title="${escapeAttribute(removeLabel)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></span>`;
    }).join('') + Array.from({ length: Math.max(0, 3 - state.compare.length) }, () => '<span class="compare-slot" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>').join('');
    const canOpen = state.compare.length >= 2;
    open.disabled = !canOpen;
    $('span', open).textContent = l('compare.open', `Comparer (${state.compare.length})`, { count: state.compare.length });
    help.textContent = canOpen
      ? l('compare.selectedCount', `${state.compare.length} fruit${state.compare.length > 1 ? 's' : ''} sur 3 sélectionnés`, { count: state.compare.length })
      : l('compare.needTwo', 'Ajoute au moins 2 fruits pour comparer.');
    help.setAttribute('aria-live', 'polite');
  }

  function quickViewMarkup(fruit, mode) {
    const id = slugify(fruit.name);
    const classes = fruitVisualClasses(fruit);
    const price = demoPrice(fruit, mode);
    const stock = stockFor(fruit, mode);
    const compared = isCompared(id, mode);
    const compareLabel = compared
      ? l('aria.removeFromComparison', 'Retirer de la comparaison')
      : l('aria.addToComparison', 'Ajouter à la comparaison');
    const shareLabel = l('quick.shareFruit', `Partager ${fruit.name}`, { fruit: fruit.name });
    return `
      <div class="quick-view-visual ${classes.visual}">
        <img data-fruit-image src="${fruitImagePath(fruit)}" alt="${l('aria.fruitIllustration', `Illustration du fruit ${fruit.name}`, { fruit: fruit.name })}" width="512" height="512">
      </div>
      <div class="quick-view-details">
        <span class="rarity-tag ${classes.tag}">${rarityLabel(fruit.rarity)}</span>
        <h3>${fruit.name}</h3>
        <p>${l('quick.description', `${typeLabel(fruit.type)} · ${l('card.stock', `Stock démo ${stock}`, { count: stock })} · ${l('mode.physicalLong', 'Fruit physique')} ou ${l('mode.permanentLong', 'fruit permanent').toLowerCase()}.`, { type: typeLabel(fruit.type), stock: l('card.stock', `Stock démo ${stock}`, { count: stock }), physical: l('mode.physicalLong', 'Fruit physique'), permanent: l('mode.permanentLong', 'fruit permanent').toLowerCase() })}</p>
        <div class="quick-view-mode" role="group" aria-label="${l('aria.fruitFormatNamed', `Format de ${fruit.name}`, { fruit: fruit.name })}">
          <button type="button" class="${mode === 'physical' ? 'active' : ''}" data-quick-mode="physical" aria-pressed="${mode === 'physical'}"><i class="fa-solid fa-box-open" aria-hidden="true"></i> ${l('mode.physical', 'Physique')}</button>
          <button type="button" class="${mode === 'permanent' ? 'active' : ''}" data-quick-mode="permanent" aria-pressed="${mode === 'permanent'}"><i class="fa-solid fa-infinity" aria-hidden="true"></i> ${l('mode.permanent', 'Permanent')}</button>
        </div>
        <div class="quick-view-facts">
          <div class="quick-fact"><span>${l('card.wiki', 'Valeur wiki')}</span><strong>${officialValue(fruit, mode)}</strong></div>
          <div class="quick-fact"><span>${l('fact.type', 'Type')}</span><strong><i class="fa-solid ${typeIcon(fruit.type)}" aria-hidden="true"></i> ${typeLabel(fruit.type)}</strong></div>
          <div class="quick-fact"><span>${l('fact.rarity', 'Rareté')}</span><strong>${rarityLabel(fruit.rarity)}</strong></div>
          <div class="quick-fact"><span>${l('fact.stock', 'Stock démo')}</span><strong>${l('stock.availableCount', `${stock} en stock`, { count: stock })}</strong></div>
        </div>
        <div class="quick-view-price"><span>${l('card.demoPrice', 'Prix démo Itemsouq')}<strong>${formatMad(price)}</strong></span><span>${l('price.confirmWhatsApp', 'À confirmer sur WhatsApp')}</span></div>
        <div class="quick-view-actions">
          <button class="btn btn-primary" type="button" data-quick-add="${id}" data-mode="${mode}"><i class="fa-solid fa-plus" aria-hidden="true"></i> <span>${l('quick.add', 'Ajouter à la commande')}</span></button>
          <button class="quick-compare${compared ? ' active' : ''}" type="button" data-quick-compare="${id}" data-mode="${mode}" aria-label="${escapeAttribute(compareLabel)}" title="${escapeAttribute(compareLabel)}" aria-pressed="${compared}"><i class="fa-solid fa-code-compare" aria-hidden="true"></i></button>
          <button class="quick-share" type="button" data-share-fruit="${id}" data-mode="${mode}" aria-label="${escapeAttribute(shareLabel)}" title="${escapeAttribute(shareLabel)}"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }

  function renderQuickView() {
    if (!activeQuickView) return;
    const fruit = fruitById.get(activeQuickView.id);
    if (!fruit) return;
    byId('quick-view-title').textContent = fruit.name;
    byId('quick-view-body').innerHTML = quickViewMarkup(fruit, activeQuickView.mode);
    wireFruitImageFallbacks(byId('quick-view-body'));
  }

  function renderCompareModal() {
    const body = byId('compare-modal-body');
    if (!body) return;
    const entries = state.compare.map((entry) => ({ ...entry, fruit: fruitById.get(entry.id) })).filter((entry) => entry.fruit);
    if (entries.length < 2) {
      body.innerHTML = `<div class="souq-empty compare-empty"><p>${l('compare.needTwo', 'Ajoute au moins 2 fruits pour comparer.')}</p><button class="btn btn-primary" type="button" data-compare-browse><i class="fa-solid fa-plus" aria-hidden="true"></i> ${l('compare.addFruit', 'Ajouter un fruit')}</button></div>`;
      return;
    }
    const heads = entries.map((entry) => `<th class="compare-cell" scope="col"><div class="compare-fruit-head"><button type="button" data-remove-compare="${entry.id}" data-mode="${entry.mode}" aria-label="${l('aria.removeFromCompare', `Retirer ${entry.fruit.name} de la comparaison`, { fruit: entry.fruit.name })}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button><img src="${fruitImagePath(entry.fruit)}" alt="" width="512" height="512"><strong>${entry.fruit.name}</strong><span class="mode-label"><i class="fa-solid ${modeCopy(entry.mode).icon}" aria-hidden="true"></i>${modeCopy(entry.mode).short}</span></div></th>`).join('');
    const row = (label, renderValue) => `<tr><th class="compare-label" scope="row">${label}</th>${entries.map((entry) => `<td class="compare-cell">${renderValue(entry)}</td>`).join('')}</tr>`;
    body.innerHTML = `<table class="compare-grid" aria-label="${l('aria.compareFruitCount', `Comparaison de ${entries.length} fruits`, { count: entries.length })}" style="--compare-count:${entries.length}"><caption>${l('compare.caption', 'Comparaison de fruits Itemsouq')}</caption><thead><tr><th class="compare-label" scope="col">${l('compare.fruit', 'Fruit')}</th>${heads}</tr></thead><tbody>${row(l('fact.rarity', 'Rareté'), (entry) => rarityLabel(entry.fruit.rarity))}${row(l('fact.type', 'Type'), (entry) => typeLabel(entry.fruit.type))}${row(l('card.wiki', 'Valeur wiki'), (entry) => officialValue(entry.fruit, entry.mode))}${row(l('compare.demoPrice', 'Prix démo'), (entry) => `<strong>${formatMad(demoPrice(entry.fruit, entry.mode))}</strong>`)}${row(l('fact.stock', 'Stock démo'), (entry) => String(stockFor(entry.fruit, entry.mode)))}${row(l('compare.order', 'Commande'), (entry) => `<button class="btn btn-primary" type="button" data-add="${entry.id}" data-mode="${entry.mode}"><i class="fa-solid fa-plus" aria-hidden="true"></i> ${l('card.add', 'Ajouter')}</button>`)}</tbody></table>`;
  }

  function souqMiniMarkup(ids, emptyCopy) {
    if (!ids.length) return `<div class="souq-empty"><p>${emptyCopy}</p><button class="btn btn-secondary" type="button" data-souq-browse><i class="fa-solid fa-store" aria-hidden="true"></i> ${l('empty.browseFruits', 'Parcourir les fruits')}</button></div>`;
    return ids.slice(0, 6).map((id) => {
      const fruit = fruitById.get(id);
      return `<button class="souq-mini-fruit" type="button" data-quick-view="${id}" data-mode="${state.mode}" aria-label="${l('aria.viewFruit', `Voir ${fruit.name}`, { fruit: fruit.name })}"><img src="${fruitImagePath(fruit)}" alt="" width="512" height="512"><strong>${fruit.name}</strong></button>`;
    }).join('');
  }

  function renderSouq() {
    const stats = byId('souq-stats');
    if (!stats) return;
    const tradeListings = safeJsonRead(STORAGE.tradeListings, []);
    const validTradeIds = new Set(Array.isArray(tradeListings)
      ? tradeListings.filter((trade) => trade && typeof trade === 'object' && typeof trade.id === 'string' && /^[A-Za-z0-9_-]{1,90}$/.test(trade.id)).map((trade) => trade.id)
      : []);
    const savedTradeData = safeJsonRead(STORAGE.savedTrades, []);
    const savedTradeCount = Array.isArray(savedTradeData) ? new Set(savedTradeData.filter((id) => typeof id === 'string' && validTradeIds.has(id))).size : 0;
    const draft = safeJsonRead(STORAGE.tradeDraft, null);
    const draftDate = draft && typeof draft === 'object' ? new Date(draft.savedAt) : null;
    const hasDraft = Boolean(draft && typeof draft === 'object' && draftDate && !Number.isNaN(draftDate.getTime()) && (typeof draft.username === 'string' || typeof draft.note === 'string' || Array.isArray(draft.offered) || Array.isArray(draft.wanted)));
    stats.innerHTML = `
      <button class="souq-stat" type="button" data-view-favorites><i class="fa-solid fa-heart" aria-hidden="true"></i><strong>${state.favorites.size}</strong><span>${l('souq.favorites', 'Favoris')}</span></button>
      <button class="souq-stat" type="button" data-souq-cart><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i><strong>${cartQuantity()}</strong><span>${l('souq.cart', 'Dans la commande')} · ${formatMad(cartTotal())}</span></button>
      <a class="souq-stat" href="trading.html#trading-feed"><i class="fa-solid fa-bookmark" aria-hidden="true"></i><strong>${savedTradeCount}</strong><span>${l('souq.savedTrades', 'Trades sauvegardés')}</span></a>
      <a class="souq-stat" href="trading.html#create"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><strong>${hasDraft ? 1 : 0}</strong><span>${hasDraft ? l('souq.localDraft', 'Brouillon local') : l('souq.noDraft', 'Aucun brouillon')}</span></a>`;
    byId('souq-recent').innerHTML = souqMiniMarkup(state.recent, l('souq.emptyRecent', "Ouvre l’aperçu d’un fruit pour le retrouver ici."));
    byId('souq-favorites').innerHTML = souqMiniMarkup([...state.favorites], l('souq.emptyFavorites', 'Ajoute des fruits aux favoris pour les retrouver ici.'));
    byId('souq-payment').value = state.preferences.payment;
    byId('souq-city').value = state.preferences.city;
  }

  async function shareFruit(id, mode) {
    const fruit = fruitById.get(id);
    if (!fruit) return;
    const text = l(
      'share.fruitSummary',
      `${fruit.name} · ${modeCopy(mode).long} · ${formatMad(demoPrice(fruit, mode))} (prix démo à confirmer) — Itemsouq`,
      { fruit: fruit.name, mode: modeCopy(mode).long, price: formatMad(demoPrice(fruit, mode)) }
    );
    const sharedUrl = new URL(window.location.href);
    sharedUrl.hash = '';
    sharedUrl.searchParams.set('fruit', id);
    sharedUrl.searchParams.set('mode', mode);
    sharedUrl.searchParams.set('lang', i18n?.getLanguage?.() || 'fr');
    const url = sharedUrl.toString();
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${fruit.name} · Itemsouq`, text, url });
        showToast(l('share.ready', 'Partage prêt.'));
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
      } else {
        const helper = document.createElement('textarea');
        helper.value = `${text}\n${url}`;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.append(helper);
        helper.select();
        const copied = document.execCommand('copy');
        helper.remove();
        if (!copied) throw new Error('Copy command failed');
      }
      showToast(l('share.copied', 'Le résumé a été copié.'));
    } catch (error) {
      if (error?.name === 'AbortError') return;
      showToast(l('share.unavailable', 'Le partage est indisponible. Réessaie depuis WhatsApp.'), 'warning');
    }
  }

  function cartLineKey(id, mode) {
    return `${id}:${mode}`;
  }

  function addToCart(id, mode = state.mode) {
    const fruit = fruitById.get(id);
    if (!fruit || !['physical', 'permanent'].includes(mode)) return;

    const stock = stockFor(fruit, mode);
    const key = cartLineKey(id, mode);
    const existing = state.cart.find((line) => cartLineKey(line.id, line.mode) === key);

    if (existing) {
      if (existing.quantity >= stock) {
        showToast(l('cart.maxQuantity', `Quantité maximale atteinte pour ${fruit.name}.`, { fruit: fruit.name }), 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      state.cart.push({ id, mode, quantity: 1 });
    }

    persistCart();
    updateCartUi();
    showToast(l('cart.added', `${fruit.name} ${modeCopy(mode).short.toLowerCase()} ajouté à ta commande.`, { fruit: fruit.name, mode: modeCopy(mode).short.toLowerCase() }));
  }

  function changeQuantity(id, mode, delta) {
    const fruit = fruitById.get(id);
    const line = state.cart.find((item) => item.id === id && item.mode === mode);
    if (!fruit || !line) return;

    const next = line.quantity + delta;
    if (next < 1) {
      removeFromCart(id, mode);
      return;
    }

    line.quantity = Math.min(stockFor(fruit, mode), next);
    persistCart();
    updateCartUi();
    window.requestAnimationFrame(() => {
      $(`[data-quantity="${delta > 0 ? 1 : -1}"][data-id="${id}"][data-mode="${mode}"]`)?.focus();
    });
  }

  function removeFromCart(id, mode) {
    state.cart = state.cart.filter((line) => !(line.id === id && line.mode === mode));
    persistCart();
    updateCartUi();
    window.requestAnimationFrame(() => $('.drawer-close').focus());
  }

  function cartQuantity() {
    return state.cart.reduce((total, line) => total + line.quantity, 0);
  }

  function cartTotal() {
    return state.cart.reduce((total, line) => {
      const fruit = fruitById.get(line.id);
      const price = demoPrice(fruit, line.mode);
      return total + (Number.isFinite(price) ? price * line.quantity : 0);
    }, 0);
  }

  function cartLineMarkup(line) {
    const fruit = fruitById.get(line.id);
    if (!fruit) return '';
    const classes = fruitVisualClasses(fruit);
    const price = demoPrice(fruit, line.mode);
    const copy = modeCopy(line.mode);
    const key = `${line.id}|${line.mode}`;

    return `
      <article class="cart-line" data-cart-line="${key}">
        <div class="cart-line-visual ${classes.core}">
          <img data-fruit-image src="${fruitImagePath(fruit)}" alt="" width="512" height="512" loading="lazy" decoding="async">
          <span aria-hidden="true">${initials(fruit.name)}</span>
        </div>
        <div class="cart-line-main">
          <h3>${fruit.name}</h3>
          <p>${copy.long} · ${officialValue(fruit, line.mode)}</p>
          <strong class="cart-line-price">${formatMad(price)} / ${l('cart.unit', 'unité')}</strong>
          <div class="cart-quantity" aria-label="${l('aria.fruitQuantity', `Quantité de ${fruit.name}`, { fruit: fruit.name })}">
            <button type="button" data-quantity="-1" data-id="${line.id}" data-mode="${line.mode}" aria-label="${l('aria.decreaseFruit', `Diminuer ${fruit.name}`, { fruit: fruit.name })}"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <span>${line.quantity}</span>
            <button type="button" data-quantity="1" data-id="${line.id}" data-mode="${line.mode}" aria-label="${l('aria.increaseFruit', `Augmenter ${fruit.name}`, { fruit: fruit.name })}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          </div>
        </div>
        <button class="cart-line-remove" type="button" data-remove="${line.id}" data-mode="${line.mode}" aria-label="${l('aria.removeFruit', `Retirer ${fruit.name}`, { fruit: fruit.name })}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
      </article>
    `;
  }

  function updateCartUi() {
    const quantity = cartQuantity();
    byId('cart-count').textContent = String(quantity);
    byId('drawer-count').textContent = quantity ? `(${quantity})` : '(0)';
    byId('cart-items').innerHTML = state.cart.map(cartLineMarkup).join('') + orderTrackerMarkup();
    byId('cart-empty').hidden = state.cart.length !== 0;
    byId('cart-footer').hidden = state.cart.length === 0;
    byId('cart-total').textContent = formatMad(cartTotal());
    wireFruitImageFallbacks(byId('cart-items'));
    renderOrderPreview();
    updateSouqIndicators();
    if (!byId('souq-drawer')?.hidden) renderSouq();
    if (activeOverlay === 'cart') updateOrderSteppers(1);
    else if (activeOverlay === 'checkout') updateOrderSteppers(checkoutMessagePrepared ? 3 : 2);
  }

  function renderOrderPreview() {
    const preview = byId('order-preview');
    if (!preview) return;

    const rows = state.cart.map((line) => {
      const fruit = fruitById.get(line.id);
      const price = demoPrice(fruit, line.mode);
      return `
        <div class="preview-row">
          <span>${fruit.name} · ${modeCopy(line.mode).short} × ${line.quantity}</span>
          <strong>${formatMad(price * line.quantity)}</strong>
        </div>
      `;
    }).join('');

    preview.innerHTML = `
      <div class="preview-head"><span>${l('order.demoSummary', 'Résumé démo')}</span><span>${l('order.articleCount', `${cartQuantity()} article${cartQuantity() > 1 ? 's' : ''}`, { count: cartQuantity() })}</span></div>
      ${rows}
      <div class="preview-total"><span>${l('order.estimatedTotal', 'Total indicatif')}</span><strong>${formatMad(cartTotal())}</strong></div>
    `;
  }

  function showToast(message, type = 'success') {
    const toast = byId('toast');
    if (!toast) return;
    toast.setAttribute('role', type === 'warning' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'warning' ? 'assertive' : 'polite');
    const icon = $('.toast-icon i', toast);
    icon.className = type === 'warning' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-check';
    $('.toast-icon', toast).style.background = type === 'warning' ? '#fff4dd' : '';
    $('.toast-icon', toast).style.color = type === 'warning' ? '#b87407' : '';
    byId('toast-message').textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2800);
  }

  function hideToast() {
    window.clearTimeout(toastTimer);
    const toast = byId('toast');
    if (toast) toast.hidden = true;
  }

  function focusableElements(container) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
  }

  function isUsableFocusTarget(element) {
    return element instanceof HTMLElement
      && element.isConnected
      && !element.hidden
      && !element.disabled
      && element.getClientRects().length > 0;
  }

  function restoreOverlayFocus() {
    window.requestAnimationFrame(() => {
      const target = [overlayReturnFocus, $('[data-mobile-cart]'), $('[data-mobile-souq]'), byId('mobile-filter-open'), $('.cart-trigger'), $('.souq-trigger'), $('.brand')]
        .find(isUsableFocusTarget);
      if (!target) return;
      target.focus({ preventScroll: true });
      if (document.activeElement !== target) {
        window.setTimeout(() => target.focus({ preventScroll: true }), 0);
      }
      window.setTimeout(() => {
        if (document.activeElement === document.body && isUsableFocusTarget(target)) {
          target.focus({ preventScroll: true });
        }
      }, 140);
    });
  }

  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    const focusables = focusableElements(container);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (!container.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function setPageInert(inert) {
    ['.announcement', '.site-header', 'main', '.site-footer', '.whatsapp-fab', '.mobile-bottom-nav', '.compare-tray'].forEach((selector) => {
      const element = $(selector);
      if (element) element.inert = inert;
    });
  }

  function syncBodyOverlay() {
    const open = ['cart-drawer', 'checkout-modal', 'souq-drawer', 'quick-view-modal', 'compare-modal', 'filter-sheet']
      .some((id) => byId(id) && !byId(id).hidden);
    document.body.classList.toggle('overlay-open', open);
    setPageInert(open);
  }

  function closeActiveOverlay(restoreFocus = true) {
    if (activeOverlay === 'cart') closeCart(restoreFocus);
    else if (activeOverlay === 'checkout') closeCheckout(restoreFocus);
    else if (activeOverlay === 'souq') closeSouq(restoreFocus);
    else if (activeOverlay === 'quick') closeQuickView(restoreFocus);
    else if (activeOverlay === 'compare') closeCompare(restoreFocus);
    else if (activeOverlay === 'filter') closeFilterSheet(restoreFocus);
  }

  function activateOverlay(name, trigger) {
    if (activeOverlay && activeOverlay !== name) closeActiveOverlay(false);
    overlayReturnFocus = trigger || document.activeElement;
    activeOverlay = name;
  }

  function secondaryFilterElements() {
    return [
      byId('rarity-filter')?.closest('[data-secondary-filter]'),
      byId('type-filter')?.closest('[data-secondary-filter]'),
      byId('sort-fruits')?.closest('[data-secondary-filter]'),
      $('.budget-finder[data-secondary-filter]')
    ].filter(Boolean);
  }

  function syncFilterLayout() {
    const sheet = byId('filter-sheet');
    const sheetBody = byId('filter-sheet-body');
    const filtersRow = $('.filters-row');
    const elements = secondaryFilterElements();
    if (!sheet || !sheetBody || !filtersRow || elements.length !== 4) return;

    if (mobileFilterMedia.matches) {
      elements.forEach((element) => sheetBody.append(element));
    } else {
      if (!sheet.hidden) closeFilterSheet(false, true);
      elements.slice(0, 3).forEach((element) => filtersRow.append(element));
      filtersRow.after(elements[3]);
    }
    syncActionHint();
  }

  function openFilterSheet(trigger = byId('mobile-filter-open')) {
    if (!mobileFilterMedia.matches || filterSheetClosing) return;
    const sheet = byId('filter-sheet');
    const backdrop = byId('filter-sheet-backdrop');
    if (!sheet || !backdrop) return;
    hideToast();
    syncFilterLayout();
    activateOverlay('filter', trigger);
    window.clearTimeout(filterSheetTimer);
    sheet.hidden = false;
    backdrop.hidden = false;
    byId('mobile-filter-open')?.setAttribute('aria-expanded', 'true');
    syncBodyOverlay();
    window.requestAnimationFrame(() => {
      sheet.classList.add('is-open');
      backdrop.classList.add('is-open');
      window.requestAnimationFrame(() => $('.filter-sheet-close')?.focus());
    });
  }

  function closeFilterSheet(returnFocus = true, immediate = false) {
    const sheet = byId('filter-sheet');
    const backdrop = byId('filter-sheet-backdrop');
    if (!sheet || !backdrop || sheet.hidden) return;
    filterSheetClosing = true;
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    byId('mobile-filter-open')?.setAttribute('aria-expanded', 'false');
    const finish = () => {
      sheet.hidden = true;
      backdrop.hidden = true;
      filterSheetClosing = false;
      if (activeOverlay === 'filter') activeOverlay = null;
      syncBodyOverlay();
      if (returnFocus) restoreOverlayFocus();
    };
    window.clearTimeout(filterSheetTimer);
    if (immediate || !returnFocus || reduceMotionPreference()) finish();
    else filterSheetTimer = window.setTimeout(finish, 230);
  }

  function openCart(trigger = $('.cart-trigger')) {
    hideToast();
    activateOverlay('cart', trigger);
    byId('cart-drawer').hidden = false;
    byId('drawer-backdrop').hidden = false;
    $('.cart-trigger').setAttribute('aria-expanded', 'true');
    $('[data-mobile-cart]')?.setAttribute('aria-expanded', 'true');
    updateOrderSteppers(1);
    syncBodyOverlay();
    window.requestAnimationFrame(() => $('.drawer-close').focus());
  }

  function closeCart(returnFocus = true) {
    byId('cart-drawer').hidden = true;
    byId('drawer-backdrop').hidden = true;
    $('.cart-trigger').setAttribute('aria-expanded', 'false');
    $('[data-mobile-cart]')?.setAttribute('aria-expanded', 'false');
    if (activeOverlay === 'cart') activeOverlay = null;
    syncBodyOverlay();
    if (returnFocus) restoreOverlayFocus();
  }

  function openCheckout(trigger = byId('checkout-open')) {
    if (!state.cart.length) return;
    const returnTarget = overlayReturnFocus;
    closeCart(false);
    activateOverlay('checkout', returnTarget || trigger);
    checkoutMessagePrepared = false;
    byId('checkout-modal').hidden = false;
    syncBodyOverlay();
    renderOrderPreview();
    updateOrderSteppers(2);
    if (state.preferences.payment) {
      const preferred = $(`input[name="payment"][value="${state.preferences.payment}"]`);
      if (preferred) preferred.checked = true;
    }
    window.requestAnimationFrame(() => byId('buyer-name').focus());
  }

  function closeCheckout(returnFocus = true) {
    byId('checkout-modal').hidden = true;
    if (activeOverlay === 'checkout') activeOverlay = null;
    if (returnFocus) {
      overlayReturnFocus = mobileFilterMedia.matches ? $('[data-mobile-cart]') : $('.cart-trigger');
    }
    syncBodyOverlay();
    clearFormErrors();
    if (returnFocus) restoreOverlayFocus();
  }

  function returnToCart() {
    closeCheckout(false);
    openCart($('.cart-trigger'));
  }

  function openSouq(trigger = $('.souq-trigger')) {
    hideToast();
    activateOverlay('souq', trigger);
    renderSouq();
    byId('souq-drawer').hidden = false;
    byId('souq-backdrop').hidden = false;
    $('.souq-trigger')?.setAttribute('aria-expanded', 'true');
    $('[data-mobile-souq]')?.setAttribute('aria-expanded', 'true');
    syncBodyOverlay();
    window.requestAnimationFrame(() => $('.souq-close').focus());
  }

  function closeSouq(returnFocus = true) {
    byId('souq-drawer').hidden = true;
    byId('souq-backdrop').hidden = true;
    $('.souq-trigger')?.setAttribute('aria-expanded', 'false');
    $('[data-mobile-souq]')?.setAttribute('aria-expanded', 'false');
    if (activeOverlay === 'souq') activeOverlay = null;
    syncBodyOverlay();
    if (returnFocus) restoreOverlayFocus();
  }

  function openQuickView(id, mode = state.mode, trigger = null) {
    if (!fruitById.has(id) || !['physical', 'permanent'].includes(mode)) return;
    activateOverlay('quick', trigger);
    activeQuickView = { id, mode };
    trackRecent(id);
    renderQuickView();
    byId('quick-view-modal').hidden = false;
    syncBodyOverlay();
    window.requestAnimationFrame(() => byId('quick-view-title').focus());
  }

  function closeQuickView(returnFocus = true) {
    byId('quick-view-modal').hidden = true;
    activeQuickView = null;
    if (activeOverlay === 'quick') activeOverlay = null;
    syncBodyOverlay();
    if (returnFocus) restoreOverlayFocus();
  }

  function openCompare(trigger = byId('compare-open')) {
    if (state.compare.length < 2) {
      showToast(l('compare.needTwo', 'Ajoute au moins 2 fruits pour comparer.'), 'warning');
      return;
    }
    activateOverlay('compare', trigger);
    renderCompareModal();
    byId('compare-modal').hidden = false;
    syncBodyOverlay();
    window.requestAnimationFrame(() => byId('compare-title').focus());
  }

  function closeCompare(returnFocus = true) {
    byId('compare-modal').hidden = true;
    if (activeOverlay === 'compare') activeOverlay = null;
    syncBodyOverlay();
    if (returnFocus) restoreOverlayFocus();
  }

  function updateOrderSteppers(stage) {
    $$('.order-stepper').forEach((stepper) => {
      $$('[data-order-step]', stepper).forEach((item) => {
        const itemStage = Number(item.dataset.orderStep);
        const complete = itemStage < stage;
        const current = itemStage === stage;
        item.classList.toggle('complete', complete);
        item.classList.toggle('active', current);
        if (current) item.setAttribute('aria-current', 'step');
        else item.removeAttribute('aria-current');
        const label = $('small', item)?.textContent || '';
        item.setAttribute('aria-label', `${label} — ${complete ? l('order.state.complete', 'étape terminée') : current ? l('order.state.current', 'étape actuelle') : l('order.state.upcoming', 'à venir')}`);
        const badge = $('span', item);
        if (badge) badge.innerHTML = complete ? `<i class="fa-solid fa-check" aria-hidden="true"></i><span class="sr-only">${l('order.complete', 'Terminée')}</span>` : String(itemStage);
      });
    });
  }

  function clearFormErrors() {
    $$('.field-error').forEach((element) => { element.textContent = ''; });
    $$('#checkout-form [aria-invalid="true"]').forEach((element) => element.removeAttribute('aria-invalid'));
  }

  function setFieldError(id, message) {
    const input = byId(id);
    const error = $(`[data-error-for="${id}"]`);
    if (input) input.setAttribute('aria-invalid', 'true');
    if (error) error.textContent = message;
  }

  function validateCheckout(form) {
    clearFormErrors();
    const name = form.elements.buyerName.value.trim();
    const username = form.elements.robloxUsername.value.trim();
    const payment = form.elements.payment.value;
    let firstInvalid = null;

    if (!name) {
      setFieldError('buyer-name', l('validation.firstName', 'Entre ton prénom.'));
      firstInvalid ||= byId('buyer-name');
    }

    if (!username) {
      setFieldError('roblox-username', l('validation.robloxUsername', 'Entre ton pseudo Roblox.'));
      firstInvalid ||= byId('roblox-username');
    } else if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      setFieldError('roblox-username', l('validation.robloxFormat', 'Utilise 3 à 30 lettres, chiffres ou _.'));
      firstInvalid ||= byId('roblox-username');
    }

    if (!payment) {
      byId('payment-fieldset').setAttribute('aria-invalid', 'true');
      $('[data-error-for="payment"]').textContent = l('validation.payment', 'Choisis Cash Plus ou Wafacash.');
      firstInvalid ||= $('input[name="payment"]');
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    return { name, username, payment };
  }

  function cartSignature() {
    return state.cart
      .map((line) => `${line.id}:${line.mode}:${line.quantity}`)
      .sort()
      .join('|');
  }

  function createOrderReference() {
    const randomNumber = () => {
      if (window.crypto?.getRandomValues) {
        const value = new Uint32Array(1);
        window.crypto.getRandomValues(value);
        return value[0] % 1000000;
      }
      return Math.floor(Math.random() * 1000000);
    };
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const reference = `ISQ-${String(randomNumber()).padStart(6, '0')}`;
      if (!state.orderTrackers[reference]) return reference;
    }
    let fallback = Date.now() % 1000000;
    while (state.orderTrackers[`ISQ-${String(fallback).padStart(6, '0')}`]) fallback = (fallback + 1) % 1000000;
    return `ISQ-${String(fallback).padStart(6, '0')}`;
  }

  function orderReference() {
    if (!state.cart.length) {
      if (state.orderSession) {
        state.orderSession = null;
        persistOrderSession();
      }
      return '';
    }
    const signature = cartSignature();
    if (state.orderSession?.signature !== signature) {
      state.orderSession = {
        reference: createOrderReference(),
        signature,
        createdAt: new Date().toISOString()
      };
      persistOrderSession();
    }
    return state.orderSession.reference;
  }

  function orderStageDefinitions() {
    return [
      { id: 'prepared', label: l('tracker.stage.prepared', 'Préparée') },
      { id: 'seller-contacted', label: l('tracker.stage.sellerContacted', 'Vendeur contacté') },
      { id: 'payment-pending', label: l('tracker.stage.paymentPending', 'Paiement en attente') },
      { id: 'delivered', label: l('tracker.stage.delivered', 'Livrée') }
    ];
  }

  function currentOrderTracker() {
    if (!state.cart.length) {
      if (state.orderSession) {
        state.orderSession = null;
        persistOrderSession();
      }
      return null;
    }
    const reference = orderReference();
    if (!state.orderTrackers[reference]) {
      state.orderTrackers[reference] = { stage: ORDER_STAGE_IDS[0], updatedAt: new Date().toISOString() };
      persistOrderTrackers();
    }
    return { reference, ...state.orderTrackers[reference] };
  }

  function orderTrackerMarkup() {
    const tracker = currentOrderTracker();
    if (!tracker) return '';
    const stages = orderStageDefinitions();
    const currentIndex = Math.max(0, stages.findIndex((stage) => stage.id === tracker.stage));
    const current = stages[currentIndex];
    const next = stages[currentIndex + 1] || null;
    const progress = stages.map((stage, index) => {
      const complete = index < currentIndex;
      const active = index === currentIndex;
      const stateClass = complete ? ' complete' : active ? ' active' : '';
      return `<li${stateClass ? ` class="${stateClass.trim()}"` : ''}${active ? ' aria-current="step"' : ''}><span>${complete ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : index + 1}</span><small>${stage.label}</small></li>`;
    }).join('');
    const actionLabel = next
      ? l('tracker.next', `Passer à : ${next.label}`, { stage: next.label })
      : l('tracker.complete', 'Commande livrée');
    return `
      <section class="local-order-tracker" tabindex="-1" aria-label="${escapeAttribute(l('aria.orderTracking', 'Progression de la livraison'))}">
        <div class="local-order-tracker-head">
          <span><small>${l('tracker.kicker', 'SUIVI LOCAL')}</small><strong>${l('tracker.reference', `Commande ${tracker.reference}`, { reference: tracker.reference })}</strong></span>
          <em>${current.label}</em>
        </div>
        <p>${l('tracker.current', `Étape actuelle : ${current.label}`, { stage: current.label })}</p>
        <ol>${progress}</ol>
        <button class="btn btn-secondary btn-full" type="button" data-order-advance${next ? '' : ' disabled'}>${next ? '<i class="fa-solid fa-arrow-right" aria-hidden="true"></i>' : '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>'}<span>${actionLabel}</span></button>
      </section>`;
  }

  function advanceOrderTracker() {
    const tracker = currentOrderTracker();
    if (!tracker) return;
    const currentIndex = ORDER_STAGE_IDS.indexOf(tracker.stage);
    const nextStage = ORDER_STAGE_IDS[currentIndex + 1];
    if (!nextStage) return;
    state.orderTrackers[tracker.reference] = { stage: nextStage, updatedAt: new Date().toISOString() };
    persistOrderTrackers();
    updateCartUi();
    const nextLabel = orderStageDefinitions().find((stage) => stage.id === nextStage)?.label || nextStage;
    showToast(l('tracker.advanced', `Suivi mis à jour : ${nextLabel}.`, { stage: nextLabel }));
    window.requestAnimationFrame(() => {
      const advance = $('[data-order-advance]');
      if (advance && !advance.disabled) advance.focus();
      else $('.local-order-tracker')?.focus();
    });
  }

  function buildWhatsAppMessage(details) {
    const lines = state.cart.map((line) => {
      const fruit = fruitById.get(line.id);
      const unit = demoPrice(fruit, line.mode);
      return `• ${fruit.name} — ${modeCopy(line.mode).long} × ${line.quantity} — ${formatMad(unit * line.quantity)}`;
    });

    return [
      l('whatsapp.checkoutGreeting', 'Salam Itemsouq 👋'),
      l('whatsapp.checkoutIntro', `Je souhaite vérifier cette commande (${orderReference()}) :`, { reference: orderReference() }),
      '',
      ...lines,
      '',
      l('whatsapp.checkoutTotal', `Total démo : ${formatMad(cartTotal())}`, { total: formatMad(cartTotal()) }),
      l('whatsapp.checkoutName', `Prénom : ${details.name}`, { name: details.name }),
      l('whatsapp.checkoutUsername', `Pseudo Roblox : ${details.username}`, { username: details.username }),
      l('whatsapp.checkoutPayment', `Paiement préféré : ${details.payment}`, { payment: details.payment }),
      ...(state.preferences.city ? [l('whatsapp.checkoutCity', `Ville : ${state.preferences.city}`, { city: state.preferences.city })] : []),
      '',
      l('whatsapp.checkoutClosing', 'Merci de confirmer le stock, le prix final et la livraison en jeu avant paiement.')
    ].join('\n');
  }

  function submitCheckout(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const details = validateCheckout(form);
    if (!details) return;

    const message = buildWhatsAppMessage(details);
    const handoff = document.createElement('a');
    handoff.href = whatsappUrl(message);
    handoff.target = '_blank';
    handoff.rel = 'noopener';
    handoff.hidden = true;
    document.body.append(handoff);
    handoff.click();
    handoff.remove();

    checkoutMessagePrepared = true;
    updateOrderSteppers(3);

    showToast(sellerWhatsAppNumber
      ? l('checkout.requestReady', 'Demande préparée. Vérifie-la dans WhatsApp.')
      : l('checkout.messageReady', 'Message préparé. Choisis le contact Itemsouq dans WhatsApp.'));

    // The cart remains intact: opening WhatsApp does not mean paid or delivered.
  }

  function toggleMobileMenu() {
    const menu = byId('mobile-menu');
    const trigger = $('.mobile-menu-trigger');
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? l('aria.closeMenu', 'Fermer le menu') : l('aria.openMenu', 'Ouvrir le menu'));
    $('i', trigger).className = `fa-solid ${open ? 'fa-xmark' : 'fa-bars'}`;
  }

  function initHeroEffects() {
    const hero = $('.hero');
    if (!hero) return;
    const showcase = $('.hero-showcase', hero);
    const card = $('.showcase-card', hero);
    if (!showcase || !card) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const precisePointer = window.matchMedia('(min-width: 921px) and (hover: hover) and (pointer: fine)');
    const mobileTouch = window.matchMedia('(max-width: 680px) and (pointer: coarse)');
    const overlayNodes = [byId('cart-drawer'), byId('checkout-modal'), byId('souq-drawer'), byId('quick-view-modal'), byId('compare-modal'), byId('filter-sheet')].filter(Boolean);
    const interactiveTarget = 'button, a, input, select, textarea, [role="button"]';
    let heroVisible = !('IntersectionObserver' in window);
    let cardBounds = null;
    let tiltFrame = null;
    let touchFrame = null;
    let touchTap = null;
    let nextTilt = { x: 0, y: 0 };

    const overlayOpen = () => overlayNodes.some((node) => !node.hidden);
    const motionActive = () => !reduceMotion.matches && !document.hidden && heroVisible && !overlayOpen();

    function addMediaListener(query, handler) {
      if (typeof query.addEventListener === 'function') query.addEventListener('change', handler);
      else if (typeof query.addListener === 'function') query.addListener(handler);
    }

    function removeMediaListener(query, handler) {
      if (typeof query.removeEventListener === 'function') query.removeEventListener('change', handler);
      else if (typeof query.removeListener === 'function') query.removeListener(handler);
    }

    function resetTilt() {
      if (tiltFrame !== null) {
        window.cancelAnimationFrame(tiltFrame);
        tiltFrame = null;
      }
      nextTilt = { x: 0, y: 0 };
      card.style.removeProperty('--hero-card-rx');
      card.style.removeProperty('--hero-card-ry');
      card.style.removeProperty('--hero-card-x');
      card.style.removeProperty('--hero-card-y');
    }

    function resetTouch() {
      if (touchFrame !== null) {
        window.cancelAnimationFrame(touchFrame);
        touchFrame = null;
      }
      touchTap = null;
      showcase.classList.remove('hero-touch-reacting');
    }

    function syncMotion() {
      const enabled = !reduceMotion.matches;
      const active = enabled && motionActive();
      hero.classList.toggle('hero-motion-ready', enabled);
      hero.classList.toggle('hero-in-view', active);
      if (!active || !precisePointer.matches) resetTilt();
      if (!active || !mobileTouch.matches) resetTouch();
    }

    function applyTilt() {
      tiltFrame = null;
      if (!motionActive() || !precisePointer.matches) return;
      card.style.setProperty('--hero-card-rx', `${(-nextTilt.y * 2.1).toFixed(2)}deg`);
      card.style.setProperty('--hero-card-ry', `${(nextTilt.x * 2.7).toFixed(2)}deg`);
      card.style.setProperty('--hero-card-x', `${(nextTilt.x * 2).toFixed(2)}px`);
      card.style.setProperty('--hero-card-y', `${(nextTilt.y * 1.2).toFixed(2)}px`);
    }

    function measureCard() {
      cardBounds = showcase.getBoundingClientRect();
    }

    function handlePointerMove(event) {
      if (event.pointerType !== 'mouse' || !motionActive() || !precisePointer.matches) return;
      if (!cardBounds) measureCard();
      const x = ((event.clientX - cardBounds.left) / cardBounds.width) * 2 - 1;
      const y = ((event.clientY - cardBounds.top) / cardBounds.height) * 2 - 1;
      nextTilt = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y))
      };
      if (tiltFrame === null) tiltFrame = window.requestAnimationFrame(applyTilt);
    }

    function handleTouchStart(event) {
      if (event.pointerType !== 'touch' || !event.isPrimary || !mobileTouch.matches || !motionActive()) return;
      if (event.target.closest?.(interactiveTarget)) return;
      touchTap = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp
      };
    }

    function handleTouchEnd(event) {
      const start = touchTap;
      touchTap = null;
      if (!start || event.pointerType !== 'touch' || !event.isPrimary || event.pointerId !== start.pointerId) return;
      if (!mobileTouch.matches || !motionActive()) return;
      const elapsed = event.timeStamp - start.time;
      const distanceX = event.clientX - start.x;
      const distanceY = event.clientY - start.y;
      if (elapsed > 650 || (distanceX * distanceX) + (distanceY * distanceY) > 144) return;

      showcase.classList.remove('hero-touch-reacting');
      touchFrame = window.requestAnimationFrame(() => {
        touchFrame = null;
        if (mobileTouch.matches && motionActive()) showcase.classList.add('hero-touch-reacting');
      });
    }

    function handleTouchCancel() {
      touchTap = null;
    }

    function handleTouchAnimationEnd(event) {
      if (event.animationName === 'hero-touch-card-pop') {
        showcase.classList.remove('hero-touch-reacting');
      }
    }

    function handleResize() {
      cardBounds = null;
      resetTilt();
      resetTouch();
      syncMotion();
    }

    function currentHeroVisibility() {
      const bounds = hero.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.right > 0 && bounds.top < window.innerHeight && bounds.left < window.innerWidth;
    }

    const intersectionObserver = 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => {
          heroVisible = Boolean(entry && entry.isIntersecting);
          syncMotion();
        }, { threshold: 0.08 })
      : null;

    const overlayObserver = overlayNodes.length
      ? new MutationObserver(syncMotion)
      : null;

    if (intersectionObserver) intersectionObserver.observe(hero);
    if (overlayObserver) overlayNodes.forEach((node) => overlayObserver.observe(node, { attributes: true, attributeFilter: ['hidden'] }));

    showcase.addEventListener('pointerenter', measureCard);
    showcase.addEventListener('pointermove', handlePointerMove);
    showcase.addEventListener('pointerleave', resetTilt);
    showcase.addEventListener('pointerdown', handleTouchStart, { passive: true });
    showcase.addEventListener('pointerup', handleTouchEnd, { passive: true });
    showcase.addEventListener('pointercancel', handleTouchCancel, { passive: true });
    card.addEventListener('animationend', handleTouchAnimationEnd);
    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('visibilitychange', syncMotion);
    addMediaListener(reduceMotion, syncMotion);
    addMediaListener(precisePointer, handleResize);
    addMediaListener(mobileTouch, handleResize);

    window.requestAnimationFrame(syncMotion);

    function cleanup() {
      resetTilt();
      resetTouch();
      intersectionObserver?.disconnect();
      overlayObserver?.disconnect();
      showcase.removeEventListener('pointerenter', measureCard);
      showcase.removeEventListener('pointermove', handlePointerMove);
      showcase.removeEventListener('pointerleave', resetTilt);
      showcase.removeEventListener('pointerdown', handleTouchStart);
      showcase.removeEventListener('pointerup', handleTouchEnd);
      showcase.removeEventListener('pointercancel', handleTouchCancel);
      card.removeEventListener('animationend', handleTouchAnimationEnd);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', syncMotion);
      removeMediaListener(reduceMotion, syncMotion);
      removeMediaListener(precisePointer, handleResize);
      removeMediaListener(mobileTouch, handleResize);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    }

    function handlePageHide(event) {
      resetTilt();
      resetTouch();
      hero.classList.remove('hero-in-view');
      if (!event.persisted) cleanup();
    }

    function handlePageShow(event) {
      if (!event.persisted) return;
      heroVisible = currentHeroVisibility();
      syncMotion();
    }

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
  }

  function attachEvents() {
    $$('.variant-option').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));

    byId('fruit-search').addEventListener('input', (event) => {
      state.search = event.target.value;
      state.visible = 12;
      persistFilters();
      renderCatalogue();
    });

    byId('rarity-filter').addEventListener('change', (event) => {
      state.rarity = event.target.value;
      state.visible = 12;
      persistFilters();
      renderCatalogue();
    });

    byId('type-filter').addEventListener('change', (event) => {
      state.type = event.target.value;
      state.visible = 12;
      persistFilters();
      renderCatalogue();
    });

    byId('sort-fruits').addEventListener('change', (event) => {
      state.sort = event.target.value;
      state.visible = 12;
      persistFilters();
      renderCatalogue();
    });

    byId('budget-range').addEventListener('input', (event) => {
      const ceiling = budgetCeiling();
      const value = Math.min(ceiling, Math.max(10, Number(event.target.value) || ceiling));
      state.budget = value >= ceiling ? null : value;
      state.visible = 12;
      persistFilters();
      renderCatalogue();
    });

    $('.budget-presets').addEventListener('click', (event) => {
      const preset = event.target.closest('[data-budget]');
      if (!preset) return;
      const ceiling = budgetCeiling();
      state.budget = preset.dataset.budget === 'all' ? null : Math.min(ceiling, Number(preset.dataset.budget));
      if (state.budget >= ceiling) state.budget = null;
      state.visible = 12;
      persistFilters();
      renderCatalogue();
      window.requestAnimationFrame(() => preset.focus());
    });

    byId('clear-filters').addEventListener('click', () => resetFilters());
    byId('empty-reset').addEventListener('click', () => resetFilters());
    byId('active-filter-chips').addEventListener('click', (event) => {
      const chip = event.target.closest('[data-clear-filter]');
      if (!chip) return;
      const chips = $$('[data-clear-filter]', byId('active-filter-chips'));
      const index = Math.max(0, chips.indexOf(chip));
      clearSingleFilter(chip.dataset.clearFilter);
      window.requestAnimationFrame(() => {
        const remaining = $$('[data-clear-filter]', byId('active-filter-chips'));
        (remaining[Math.min(index, remaining.length - 1)] || byId('mobile-filter-open'))?.focus();
      });
    });
    byId('mobile-filter-open').addEventListener('click', (event) => openFilterSheet(event.currentTarget));
    $('.filter-sheet-close').addEventListener('click', () => closeFilterSheet());
    byId('filter-sheet-backdrop').addEventListener('click', () => closeFilterSheet());
    byId('filter-sheet-done').addEventListener('click', () => closeFilterSheet());
    byId('filter-sheet-reset').addEventListener('click', (event) => {
      resetSecondaryFilters();
      window.requestAnimationFrame(() => event.currentTarget.focus());
    });
    byId('mobile-action-hint-dismiss').addEventListener('click', dismissActionHint);
    const handleFilterBreakpoint = () => syncFilterLayout();
    if (typeof mobileFilterMedia.addEventListener === 'function') mobileFilterMedia.addEventListener('change', handleFilterBreakpoint);
    else if (typeof mobileFilterMedia.addListener === 'function') mobileFilterMedia.addListener(handleFilterBreakpoint);
    byId('load-more').addEventListener('click', () => {
      state.visible += 12;
      renderCatalogue();
    });

    byId('fruit-grid').addEventListener('click', (event) => {
      const favorite = event.target.closest('[data-favorite]');
      const add = event.target.closest('[data-add]');
      const quickView = event.target.closest('[data-quick-view]');
      const compare = event.target.closest('[data-compare]');
      if (favorite) toggleFavorite(favorite.dataset.favorite);
      if (add) addToCart(add.dataset.add, add.dataset.mode);
      if (quickView) openQuickView(quickView.dataset.quickView, quickView.dataset.mode, quickView);
      if (compare) toggleCompare(compare.dataset.compare, compare.dataset.mode);
    });

    $('.favorites-trigger').addEventListener('click', () => {
      if (!state.favorites.size && !state.favoriteOnly) {
        showToast(l('favorite.empty', 'Ajoute un cœur à un fruit pour le retrouver ici.'), 'warning');
        byId('catalogue').scrollIntoView({ behavior: reduceMotionPreference() ? 'auto' : 'smooth' });
        return;
      }
      state.favoriteOnly = !state.favoriteOnly;
      state.visible = 12;
      persistFilters();
      renderCatalogue();
      byId('catalogue').scrollIntoView({ behavior: reduceMotionPreference() ? 'auto' : 'smooth' });
    });

    $$('.showcase-add').forEach((button) => button.addEventListener('click', () => addToCart(slugify(button.dataset.quickAdd), button.dataset.mode)));

    $$('[data-footer-mode]').forEach((link) => link.addEventListener('click', () => {
      setMode(link.dataset.footerMode);
    }));

    $('.souq-trigger').addEventListener('click', (event) => openSouq(event.currentTarget));
    $('.souq-close').addEventListener('click', () => closeSouq());
    byId('souq-backdrop').addEventListener('click', () => closeSouq());
    byId('souq-drawer').addEventListener('click', (event) => {
      const quickView = event.target.closest('[data-quick-view]');
      const favorites = event.target.closest('[data-view-favorites]');
      const cart = event.target.closest('[data-souq-cart]');
      const clearRecent = event.target.closest('[data-clear-recent]');
      const browse = event.target.closest('[data-souq-browse]');
      if (quickView) openQuickView(quickView.dataset.quickView, quickView.dataset.mode, quickView);
      if (favorites) {
        closeSouq(false);
        state.favoriteOnly = state.favorites.size > 0;
        state.visible = 12;
        persistFilters();
        renderCatalogue();
        byId('catalogue').scrollIntoView({ behavior: reduceMotionPreference() ? 'auto' : 'smooth' });
        if (!state.favorites.size) showToast(l('favorite.empty', 'Ajoute un cœur à un fruit pour le retrouver ici.'), 'warning');
      }
      if (cart) {
        closeSouq(false);
        openCart($('.cart-trigger'));
      }
      if (clearRecent) {
        state.recent = [];
        persistRecent();
        renderSouq();
        updateSouqIndicators();
      }
      if (browse) {
        closeSouq(false);
        state.favoriteOnly = false;
        persistFilters();
        renderCatalogue();
        byId('catalogue').scrollIntoView({ behavior: reduceMotionPreference() ? 'auto' : 'smooth' });
      }
    });

    byId('souq-preferences-form').addEventListener('submit', (event) => {
      event.preventDefault();
      state.preferences = sanitizePreferences({
        payment: byId('souq-payment').value,
        city: byId('souq-city').value
      });
      persistPreferences();
      showToast(l('souq.preferencesSaved', 'Tes préférences locales sont enregistrées.'));
    });

    $('[data-mobile-souq]').addEventListener('click', (event) => openSouq(event.currentTarget));
    $('[data-mobile-cart]').addEventListener('click', (event) => openCart(event.currentTarget));

    $('.cart-trigger').addEventListener('click', (event) => openCart(event.currentTarget));
    $('.drawer-close').addEventListener('click', () => closeCart());
    byId('drawer-backdrop').addEventListener('click', () => closeCart());
    $('.drawer-browse').addEventListener('click', () => {
      closeCart(false);
      byId('catalogue').scrollIntoView({ behavior: reduceMotionPreference() ? 'auto' : 'smooth' });
    });

    byId('cart-items').addEventListener('click', (event) => {
      const quantity = event.target.closest('[data-quantity]');
      const remove = event.target.closest('[data-remove]');
      const advance = event.target.closest('[data-order-advance]');
      if (quantity) changeQuantity(quantity.dataset.id, quantity.dataset.mode, Number(quantity.dataset.quantity));
      if (remove) removeFromCart(remove.dataset.remove, remove.dataset.mode);
      if (advance) advanceOrderTracker();
    });

    byId('clear-cart').addEventListener('click', () => {
      state.cart = [];
      persistCart();
      updateCartUi();
      showToast(l('cart.cleared', 'Commande vidée.'));
      window.requestAnimationFrame(() => $('.drawer-close').focus());
    });

    byId('checkout-open').addEventListener('click', (event) => openCheckout(event.currentTarget));
    $('.modal-close').addEventListener('click', () => closeCheckout());
    $('.modal-cancel').addEventListener('click', returnToCart);
    byId('checkout-form').addEventListener('submit', submitCheckout);
    byId('checkout-modal').addEventListener('click', (event) => {
      if (event.target === byId('checkout-modal')) closeCheckout();
    });

    byId('compare-tray').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-compare]');
      if (remove) toggleCompare(remove.dataset.removeCompare, remove.dataset.mode);
    });
    byId('compare-open').addEventListener('click', (event) => openCompare(event.currentTarget));
    byId('compare-clear').addEventListener('click', () => {
      state.compare = [];
      persistCompare();
      renderCatalogue();
      closeCompare();
      showToast(l('compare.cleared', 'Comparaison vidée.'));
    });
    byId('compare-modal').addEventListener('click', (event) => {
      if (event.target === byId('compare-modal') || event.target.closest('[data-close-compare]')) {
        closeCompare();
        return;
      }
      const remove = event.target.closest('[data-remove-compare]');
      const add = event.target.closest('[data-add]');
      const browse = event.target.closest('[data-compare-browse]');
      if (remove) {
        toggleCompare(remove.dataset.removeCompare, remove.dataset.mode, false);
        window.requestAnimationFrame(() => {
          const remaining = $('[data-remove-compare]', byId('compare-modal'));
          if (remaining) remaining.focus();
          else byId('compare-clear').focus();
        });
      }
      if (add) addToCart(add.dataset.add, add.dataset.mode);
      if (browse) {
        closeCompare(false);
        byId('catalogue').scrollIntoView({ behavior: reduceMotionPreference() ? 'auto' : 'smooth' });
      }
    });

    byId('quick-view-modal').addEventListener('click', (event) => {
      if (event.target === byId('quick-view-modal') || event.target.closest('[data-close-quick-view]')) {
        closeQuickView();
        return;
      }
      const mode = event.target.closest('[data-quick-mode]');
      const add = event.target.closest('[data-quick-add]');
      const compare = event.target.closest('[data-quick-compare]');
      const share = event.target.closest('[data-share-fruit]');
      if (mode && activeQuickView) {
        activeQuickView.mode = mode.dataset.quickMode;
        renderQuickView();
        window.requestAnimationFrame(() => $(`[data-quick-mode="${activeQuickView.mode}"]`)?.focus());
      }
      if (add) addToCart(add.dataset.quickAdd, add.dataset.mode);
      if (compare) {
        toggleCompare(compare.dataset.quickCompare, compare.dataset.mode, false);
        window.requestAnimationFrame(() => $('[data-quick-compare]', byId('quick-view-modal'))?.focus());
      }
      if (share) shareFruit(share.dataset.shareFruit, share.dataset.mode);
    });

    $('.mobile-menu-trigger').addEventListener('click', toggleMobileMenu);
    $$('#mobile-menu a').forEach((link) => link.addEventListener('click', () => {
      if (!byId('mobile-menu').hidden) toggleMobileMenu();
    }));

    document.addEventListener('itemsouq:languagechange', () => {
      renderCatalogue();
      updateCartUi();
      if (activeQuickView) renderQuickView();
      if (!byId('compare-modal').hidden) renderCompareModal();
      if (!byId('souq-drawer').hidden) renderSouq();
      i18n?.applyStatic(document);
      prepareStaticWhatsAppLinks();
      showToast(i18n?.getLanguage() === 'ary'
        ? l('language.changedDarija', 'Darija tkhayrat.')
        : l('language.changedFrench', 'Interface en français.'));
    });

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        byId('fruit-search').focus();
        byId('catalogue').scrollIntoView({ behavior: reduceMotionPreference() ? 'auto' : 'smooth' });
      }

      if (event.key === 'Escape') {
        if (activeOverlay) closeActiveOverlay();
        else if (!byId('mobile-menu').hidden) toggleMobileMenu();
      }

      const activeContainer = activeOverlay === 'checkout' ? byId('checkout-modal')
        : activeOverlay === 'cart' ? byId('cart-drawer')
          : activeOverlay === 'souq' ? byId('souq-drawer')
            : activeOverlay === 'quick' ? byId('quick-view-modal')
              : activeOverlay === 'compare' ? byId('compare-modal')
                : activeOverlay === 'filter' ? byId('filter-sheet')
                  : null;
      if (activeContainer) trapFocus(activeContainer, event);
    });
  }

  function validateDataset() {
    if (fruits.length !== 41) {
      console.warn(`Itemsouq: expected 41 fruits, received ${fruits.length}.`);
    }
  }

  function syncMobileNavigation() {
    const links = $$('.mobile-bottom-nav a');
    if (!links.length) return;
    const catalogue = byId('catalogue');
    const catalogueActive = catalogue && window.scrollY >= catalogue.offsetTop - (window.innerHeight * 0.45);
    links.forEach((link) => {
      const active = catalogueActive ? link.getAttribute('href') === '#catalogue' : link.getAttribute('href') === '#top';
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function syncContextualFab() {
    const catalogue = byId('catalogue');
    if (!catalogue) return;
    const bounds = catalogue.getBoundingClientRect();
    const catalogueInView = bounds.top < window.innerHeight
      && bounds.bottom > 76;
    document.body.classList.toggle('catalogue-active', catalogueInView);
  }

  function syncSearchShortcut() {
    const shortcut = $('.search-control kbd');
    if (!shortcut) return;
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    shortcut.textContent = /Mac|iPhone|iPad/i.test(platform) ? '⌘ K' : 'Ctrl K';
  }

  function initSharedLinks() {
    let mobileNavFrame = null;
    window.addEventListener('scroll', () => {
      if (mobileNavFrame !== null) return;
      mobileNavFrame = window.requestAnimationFrame(() => {
        mobileNavFrame = null;
        syncMobileNavigation();
        syncContextualFab();
      });
    }, { passive: true });
    syncMobileNavigation();
    syncContextualFab();
    window.addEventListener('resize', syncContextualFab, { passive: true });

    const sharedFruit = new URLSearchParams(window.location.search).get('fruit');
    const sharedMode = new URLSearchParams(window.location.search).get('mode');
    const hashMatch = window.location.hash.match(/^#fruit-([a-z0-9-]+)$/);
    if (sharedFruit && fruitById.has(sharedFruit)) {
      window.requestAnimationFrame(() => openQuickView(sharedFruit, sharedMode === 'permanent' ? 'permanent' : 'physical'));
    } else if (hashMatch && fruitById.has(hashMatch[1])) {
      window.requestAnimationFrame(() => openQuickView(hashMatch[1], state.mode));
    } else if (window.location.hash === '#souq') {
      window.requestAnimationFrame(() => openSouq($('.souq-trigger')));
    } else if (window.location.hash === '#order') {
      window.requestAnimationFrame(() => openCart($('.cart-trigger')));
    }
  }

  function init() {
    validateDataset();
    hydrateState();
    syncFilterControls();
    syncFilterLayout();
    syncSearchShortcut();
    prepareStaticWhatsAppLinks();
    initHeroEffects();
    attachEvents();
    renderCatalogue();
    updateCartUi();
    initSharedLinks();
    i18n?.applyStatic(document);
  }

  init();
})();
