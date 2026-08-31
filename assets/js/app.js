/* Itemsouq Fruits — static storefront demo */
(function () {
  'use strict';

  const fruits = Array.isArray(window.ITEMSOUQ_FRUITS) ? window.ITEMSOUQ_FRUITS : [];
  const config = window.ITEMSOUQ_CONFIG && typeof window.ITEMSOUQ_CONFIG === 'object'
    ? window.ITEMSOUQ_CONFIG
    : {};
  const sellerWhatsAppNumber = String(config.whatsappNumber || '').replace(/\D/g, '');
  const STORAGE = {
    cart: 'itemsouq:fruits:v1:cart',
    favorites: 'itemsouq:fruits:v1:favorites'
  };

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
    cart: []
  };

  let toastTimer = null;
  let overlayReturnFocus = null;

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
      showToast('Le stockage local est indisponible sur ce navigateur.', 'warning');
      return false;
    }
  }

  function sanitizeFavorites(input) {
    if (!Array.isArray(input)) return [];
    return [...new Set(input.filter((id) => typeof id === 'string' && fruitById.has(id)))];
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
    state.favorites = new Set(sanitizeFavorites(safeJsonRead(STORAGE.favorites, [])));
    state.cart = sanitizeCart(safeJsonRead(STORAGE.cart, []));
    persistCart();
  }

  function persistCart() {
    safeJsonWrite(STORAGE.cart, state.cart);
  }

  function persistFavorites() {
    safeJsonWrite(STORAGE.favorites, [...state.favorites]);
  }

  function roundToFive(value) {
    return Math.ceil(value / 5) * 5;
  }

  function demoPrice(fruit, mode) {
    if (!fruit || !Number.isFinite(fruit.beli) || !Number.isFinite(fruit.robux)) return null;
    if (mode === 'permanent') return roundToFive(Math.max(25, fruit.robux * 0.15));
    return roundToFive(Math.max(10, Math.sqrt(fruit.beli) * 0.04));
  }

  function stockFor(fruit, mode) {
    if (mode === 'permanent') return 1;
    const seed = [...fruit.name].reduce((total, char) => total + char.charCodeAt(0), 0);
    return (seed % 5) + 1;
  }

  function formatMad(value) {
    if (!Number.isFinite(value) || value < 0) return 'Sur demande';
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
      link.href = whatsappUrl(link.dataset.whatsappMessage || '');
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
      ? { short: 'Permanent', long: 'Fruit permanent', icon: 'fa-infinity' }
      : { short: 'Physique', long: 'Fruit physique', icon: 'fa-box-open' };
  }

  function filteredFruits() {
    const query = state.search.trim().toLocaleLowerCase('fr');
    const valueForMode = (fruit) => state.mode === 'permanent' ? fruit.robux : fruit.beli;

    const result = fruits.filter((fruit) => {
      const matchesSearch = !query || fruit.name.toLocaleLowerCase('fr').includes(query);
      const matchesRarity = state.rarity === 'all' || fruit.rarity === state.rarity;
      const matchesType = state.type === 'all' || fruit.type === state.type;
      const matchesFavorite = !state.favoriteOnly || state.favorites.has(slugify(fruit.name));
      return matchesSearch && matchesRarity && matchesType && matchesFavorite;
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
    const mode = modeCopy(state.mode);
    const price = demoPrice(fruit, state.mode);
    const stock = stockFor(fruit, state.mode);
    const quickMessage = `Salam Itemsouq, je veux vérifier ${fruit.name} (${mode.long}) — prix démo ${formatMad(price)}.`;
    const quickLabel = sellerWhatsAppNumber
      ? `Demander ${fruit.name} au vendeur sur WhatsApp`
      : `Préparer une demande pour ${fruit.name} dans WhatsApp`;

    return `
      <article class="fruit-card" data-fruit-id="${id}">
        <div class="fruit-card-head">
          <span class="rarity-tag ${classes.tag}">${rarityLabels[fruit.rarity]}</span>
          <button class="favorite-button${favorite ? ' active' : ''}" type="button" data-favorite="${id}" aria-label="${favorite ? 'Retirer' : 'Ajouter'} ${fruit.name} ${favorite ? 'des' : 'aux'} favoris" aria-pressed="${favorite}">
            <i class="fa-${favorite ? 'solid' : 'regular'} fa-heart" aria-hidden="true"></i>
          </button>
        </div>
        <div class="fruit-visual ${classes.visual}">
          <div class="fruit-core ${classes.core}">
            <img class="fruit-image" data-fruit-image src="${fruitImagePath(fruit)}" alt="" width="512" height="512" loading="lazy" decoding="async">
            <span aria-hidden="true">${initials(fruit.name)}</span>
          </div>
          <span class="type-badge"><i class="fa-solid ${typeIcon(fruit.type)}" aria-hidden="true"></i>${typeLabels[fruit.type]}</span>
        </div>
        <div class="fruit-content">
          <div class="fruit-title-row">
            <h3>${fruit.name}</h3>
            <span class="stock-chip">Stock démo ${stock}</span>
          </div>
          <div class="official-value">
            <span>Valeur wiki</span>
            <strong>${officialValue(fruit, state.mode)}</strong>
          </div>
          <div class="card-price">
            <span>Prix démo Itemsouq<strong>${formatMad(price)}</strong></span>
            <span class="mode-label"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.short}</span>
          </div>
          <div class="card-actions">
            <button class="add-cart-button" type="button" data-add="${id}" data-mode="${state.mode}">
              <i class="fa-solid fa-plus" aria-hidden="true"></i> Ajouter
            </button>
            <a class="quick-whatsapp" href="${whatsappUrl(quickMessage)}" target="_blank" rel="noopener" aria-label="${quickLabel}">
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
    const hasFilters = Boolean(state.search.trim()) || state.rarity !== 'all' || state.type !== 'all' || state.favoriteOnly;

    grid.innerHTML = visible.map(createFruitCard).join('');
    grid.hidden = visible.length === 0;
    empty.hidden = visible.length !== 0;
    loadMore.hidden = results.length <= state.visible || results.length === 0;
    clearFilters.hidden = !hasFilters;
    wireFruitImageFallbacks(grid);

    const favoriteSuffix = state.favoriteOnly ? ' favoris' : '';
    byId('results-count').textContent = `${results.length} fruit${results.length > 1 ? 's' : ''}${favoriteSuffix} disponible${results.length > 1 ? 's' : ''}`;
    updateFavoriteTrigger();
  }

  function resetFilters(options = {}) {
    state.search = '';
    state.rarity = 'all';
    state.type = 'all';
    state.favoriteOnly = false;
    state.visible = 12;
    byId('fruit-search').value = '';
    byId('rarity-filter').value = 'all';
    byId('type-filter').value = 'all';
    if (!options.keepSort) {
      state.sort = 'featured';
      byId('sort-fruits').value = 'featured';
    }
    renderCatalogue();
  }

  function setMode(mode) {
    if (!['physical', 'permanent'].includes(mode)) return;
    state.mode = mode;
    state.visible = 12;
    $$('.variant-option').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderCatalogue();
  }

  function toggleFavorite(id) {
    if (!fruitById.has(id)) return;
    const fruit = fruitById.get(id);
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      showToast(`${fruit.name} retiré des favoris.`);
    } else {
      state.favorites.add(id);
      showToast(`${fruit.name} ajouté aux favoris.`);
    }
    persistFavorites();
    renderCatalogue();
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
    trigger.setAttribute('aria-label', state.favoriteOnly ? 'Afficher tous les fruits' : `Afficher mes favoris (${count})`);
    const icon = $('i', trigger);
    icon.className = `fa-${state.favoriteOnly ? 'solid' : 'regular'} fa-heart`;
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
        showToast(`Quantité maximale atteinte pour ${fruit.name}.`, 'warning');
        return;
      }
      existing.quantity += 1;
    } else {
      state.cart.push({ id, mode, quantity: 1 });
    }

    persistCart();
    updateCartUi();
    showToast(`${fruit.name} ${mode === 'permanent' ? 'permanent' : 'physique'} ajouté à ta commande.`);
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
          <strong class="cart-line-price">${formatMad(price)} / unité</strong>
          <div class="cart-quantity" aria-label="Quantité de ${fruit.name}">
            <button type="button" data-quantity="-1" data-id="${line.id}" data-mode="${line.mode}" aria-label="Diminuer ${fruit.name}"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <span>${line.quantity}</span>
            <button type="button" data-quantity="1" data-id="${line.id}" data-mode="${line.mode}" aria-label="Augmenter ${fruit.name}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          </div>
        </div>
        <button class="cart-line-remove" type="button" data-remove="${line.id}" data-mode="${line.mode}" aria-label="Retirer ${fruit.name}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
      </article>
    `;
  }

  function updateCartUi() {
    const quantity = cartQuantity();
    byId('cart-count').textContent = String(quantity);
    byId('drawer-count').textContent = quantity ? `(${quantity})` : '(0)';
    byId('cart-items').innerHTML = state.cart.map(cartLineMarkup).join('');
    byId('cart-empty').hidden = state.cart.length !== 0;
    byId('cart-footer').hidden = state.cart.length === 0;
    byId('cart-total').textContent = formatMad(cartTotal());
    wireFruitImageFallbacks(byId('cart-items'));
    renderOrderPreview();
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
      <div class="preview-head"><span>Résumé démo</span><span>${cartQuantity()} article${cartQuantity() > 1 ? 's' : ''}</span></div>
      ${rows}
      <div class="preview-total"><span>Total indicatif</span><strong>${formatMad(cartTotal())}</strong></div>
    `;
  }

  function showToast(message, type = 'success') {
    const toast = byId('toast');
    if (!toast) return;
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

  function trapFocus(container, event) {
    if (event.key !== 'Tab') return;
    const focusables = focusableElements(container);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function syncBodyOverlay() {
    const open = !byId('cart-drawer').hidden || !byId('checkout-modal').hidden;
    document.body.classList.toggle('overlay-open', open);
  }

  function openCart() {
    hideToast();
    overlayReturnFocus = $('.cart-trigger');
    byId('cart-drawer').hidden = false;
    byId('drawer-backdrop').hidden = false;
    $('.cart-trigger').setAttribute('aria-expanded', 'true');
    syncBodyOverlay();
    window.requestAnimationFrame(() => $('.drawer-close').focus());
  }

  function closeCart(returnFocus = true) {
    byId('cart-drawer').hidden = true;
    byId('drawer-backdrop').hidden = true;
    $('.cart-trigger').setAttribute('aria-expanded', 'false');
    syncBodyOverlay();
    if (returnFocus && overlayReturnFocus instanceof HTMLElement) overlayReturnFocus.focus();
  }

  function openCheckout() {
    if (!state.cart.length) return;
    closeCart(false);
    overlayReturnFocus = $('.cart-trigger');
    byId('checkout-modal').hidden = false;
    syncBodyOverlay();
    renderOrderPreview();
    window.requestAnimationFrame(() => byId('buyer-name').focus());
  }

  function closeCheckout(returnFocus = true) {
    byId('checkout-modal').hidden = true;
    syncBodyOverlay();
    clearFormErrors();
    if (returnFocus && overlayReturnFocus instanceof HTMLElement) overlayReturnFocus.focus();
  }

  function returnToCart() {
    closeCheckout(false);
    openCart();
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
      setFieldError('buyer-name', 'Entre ton prénom.');
      firstInvalid ||= byId('buyer-name');
    }

    if (!username) {
      setFieldError('roblox-username', 'Entre ton pseudo Roblox.');
      firstInvalid ||= byId('roblox-username');
    } else if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) {
      setFieldError('roblox-username', 'Utilise 3 à 30 lettres, chiffres ou _.');
      firstInvalid ||= byId('roblox-username');
    }

    if (!payment) {
      byId('payment-fieldset').setAttribute('aria-invalid', 'true');
      $('[data-error-for="payment"]').textContent = 'Choisis Cash Plus ou Wafacash.';
      firstInvalid ||= $('input[name="payment"]');
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    return { name, username, payment };
  }

  function orderReference() {
    const seed = state.cart.map((line) => `${line.id}:${line.mode}:${line.quantity}`).join('|');
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
    return `ISQ-${String(Math.abs(hash) % 10000).padStart(4, '0')}`;
  }

  function buildWhatsAppMessage(details) {
    const lines = state.cart.map((line) => {
      const fruit = fruitById.get(line.id);
      const unit = demoPrice(fruit, line.mode);
      return `• ${fruit.name} — ${modeCopy(line.mode).long} × ${line.quantity} — ${formatMad(unit * line.quantity)}`;
    });

    return [
      'Salam Itemsouq 👋',
      `Je souhaite vérifier cette commande (${orderReference()}) :`,
      '',
      ...lines,
      '',
      `Total démo : ${formatMad(cartTotal())}`,
      `Prénom : ${details.name}`,
      `Pseudo Roblox : ${details.username}`,
      `Paiement préféré : ${details.payment}`,
      '',
      'Merci de confirmer le stock, le prix final et la livraison en jeu avant paiement.'
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

    showToast(sellerWhatsAppNumber
      ? 'Demande préparée. Vérifie-la dans WhatsApp.'
      : 'Message préparé. Choisis le contact Itemsouq dans WhatsApp.');

    // The cart remains intact: opening WhatsApp does not mean paid or delivered.
  }

  function toggleMobileMenu() {
    const menu = byId('mobile-menu');
    const trigger = $('.mobile-menu-trigger');
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
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
    const overlayNodes = [byId('cart-drawer'), byId('checkout-modal')].filter(Boolean);
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
      renderCatalogue();
    });

    byId('rarity-filter').addEventListener('change', (event) => {
      state.rarity = event.target.value;
      state.visible = 12;
      renderCatalogue();
    });

    byId('type-filter').addEventListener('change', (event) => {
      state.type = event.target.value;
      state.visible = 12;
      renderCatalogue();
    });

    byId('sort-fruits').addEventListener('change', (event) => {
      state.sort = event.target.value;
      state.visible = 12;
      renderCatalogue();
    });

    byId('clear-filters').addEventListener('click', () => resetFilters());
    byId('empty-reset').addEventListener('click', () => resetFilters());
    byId('load-more').addEventListener('click', () => {
      state.visible += 12;
      renderCatalogue();
    });

    byId('fruit-grid').addEventListener('click', (event) => {
      const favorite = event.target.closest('[data-favorite]');
      const add = event.target.closest('[data-add]');
      if (favorite) toggleFavorite(favorite.dataset.favorite);
      if (add) addToCart(add.dataset.add, add.dataset.mode);
    });

    $('.favorites-trigger').addEventListener('click', () => {
      if (!state.favorites.size && !state.favoriteOnly) {
        showToast('Ajoute un cœur à un fruit pour le retrouver ici.', 'warning');
        byId('catalogue').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      state.favoriteOnly = !state.favoriteOnly;
      state.visible = 12;
      renderCatalogue();
      byId('catalogue').scrollIntoView({ behavior: 'smooth' });
    });

    $$('.showcase-add').forEach((button) => button.addEventListener('click', () => addToCart(slugify(button.dataset.quickAdd), button.dataset.mode)));

    $$('[data-footer-mode]').forEach((link) => link.addEventListener('click', () => {
      setMode(link.dataset.footerMode);
    }));

    $('.cart-trigger').addEventListener('click', openCart);
    $('.drawer-close').addEventListener('click', () => closeCart());
    byId('drawer-backdrop').addEventListener('click', () => closeCart());
    $('.drawer-browse').addEventListener('click', () => {
      closeCart(false);
      byId('catalogue').scrollIntoView({ behavior: 'smooth' });
    });

    byId('cart-items').addEventListener('click', (event) => {
      const quantity = event.target.closest('[data-quantity]');
      const remove = event.target.closest('[data-remove]');
      if (quantity) changeQuantity(quantity.dataset.id, quantity.dataset.mode, Number(quantity.dataset.quantity));
      if (remove) removeFromCart(remove.dataset.remove, remove.dataset.mode);
    });

    byId('clear-cart').addEventListener('click', () => {
      state.cart = [];
      persistCart();
      updateCartUi();
      showToast('Commande vidée.');
      window.requestAnimationFrame(() => $('.drawer-close').focus());
    });

    byId('checkout-open').addEventListener('click', openCheckout);
    $('.modal-close').addEventListener('click', () => closeCheckout());
    $('.modal-cancel').addEventListener('click', returnToCart);
    byId('checkout-form').addEventListener('submit', submitCheckout);
    byId('checkout-modal').addEventListener('click', (event) => {
      if (event.target === byId('checkout-modal')) closeCheckout();
    });

    $('.mobile-menu-trigger').addEventListener('click', toggleMobileMenu);
    $$('#mobile-menu a').forEach((link) => link.addEventListener('click', () => {
      if (!byId('mobile-menu').hidden) toggleMobileMenu();
    }));

    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        byId('fruit-search').focus();
        byId('catalogue').scrollIntoView({ behavior: 'smooth' });
      }

      if (event.key === 'Escape') {
        if (!byId('checkout-modal').hidden) closeCheckout();
        else if (!byId('cart-drawer').hidden) closeCart();
        else if (!byId('mobile-menu').hidden) toggleMobileMenu();
      }

      if (!byId('checkout-modal').hidden) trapFocus(byId('checkout-modal'), event);
      else if (!byId('cart-drawer').hidden) trapFocus(byId('cart-drawer'), event);
    });
  }

  function validateDataset() {
    if (fruits.length !== 41) {
      console.warn(`Itemsouq: expected 41 fruits, received ${fruits.length}.`);
    }
  }

  function init() {
    validateDataset();
    hydrateState();
    prepareStaticWhatsAppLinks();
    initHeroEffects();
    attachEvents();
    renderCatalogue();
    updateCartUi();
  }

  init();
})();
