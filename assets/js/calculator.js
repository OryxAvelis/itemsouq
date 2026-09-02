(() => {
  'use strict';

  const MAX_FRUITS = 4;
  const MAX_QUANTITY = 4;
  const HISTORY_LIMIT = 10;
  const STATE_KEY = 'itemsouq:calculator:v1:state';
  const HISTORY_KEY = 'itemsouq:calculator:v1:history';
  const VALID_MODES = new Set(['physical', 'permanent']);
  const fruits = Array.isArray(window.ITEMSOUQ_FRUITS) ? window.ITEMSOUQ_FRUITS : [];
  const i18n = window.ITEMSOUQ_I18N;

  if (!fruits.length || !i18n) return;

  const slugify = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const fruitById = new Map(fruits.map((fruit) => [slugify(fruit.name), fruit]));
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const t = (key, fallback, variables = {}) => i18n.t(key, fallback, variables);

  const elements = {
    mode: document.getElementById('calculator-mode'),
    leftList: document.getElementById('calc-left-list'),
    rightList: document.getElementById('calc-right-list'),
    leftCount: document.getElementById('calc-left-count'),
    rightCount: document.getElementById('calc-right-count'),
    leftEmpty: document.getElementById('calc-left-empty'),
    rightEmpty: document.getElementById('calc-right-empty'),
    leftTotal: document.getElementById('calc-left-total'),
    rightTotal: document.getElementById('calc-right-total'),
    result: document.getElementById('calc-result'),
    resultIcon: document.getElementById('calc-result-icon'),
    resultLabel: document.getElementById('calc-result-label'),
    resultCopy: document.getElementById('calc-result-copy'),
    resultGap: document.getElementById('calc-result-gap'),
    resultLeft: document.getElementById('calc-result-left'),
    resultRight: document.getElementById('calc-result-right'),
    leftBar: document.getElementById('calc-left-bar'),
    rightBar: document.getElementById('calc-right-bar'),
    scoreRing: document.getElementById('calc-score-ring'),
    score: document.getElementById('calc-score'),
    swap: document.getElementById('calc-swap'),
    reset: document.getElementById('calc-reset'),
    save: document.getElementById('calc-save'),
    share: document.getElementById('calc-share'),
    copy: document.getElementById('calc-copy'),
    whatsapp: document.getElementById('calc-whatsapp'),
    findOffers: document.getElementById('calc-find-offers'),
    historySection: document.getElementById('calc-history-section'),
    history: document.getElementById('calc-history'),
    historyEmpty: document.getElementById('calc-history-empty'),
    historyClear: document.getElementById('calc-history-clear'),
    pickerModal: document.getElementById('calc-picker-modal'),
    pickerTitle: document.getElementById('calc-picker-title'),
    pickerSearch: document.getElementById('calc-picker-search'),
    pickerList: document.getElementById('calc-picker-list'),
    pickerEmpty: document.getElementById('calc-picker-empty'),
    pickerClearSearch: document.getElementById('calc-picker-clear-search'),
    pickerCount: document.getElementById('calc-picker-count'),
    pickerDone: document.getElementById('calc-picker-done'),
    toast: document.getElementById('calc-toast'),
    toastMessage: document.getElementById('calc-toast-message'),
    alert: document.getElementById('calc-alert'),
    mobileSummary: document.getElementById('calc-mobile-summary'),
    mobileLeft: document.getElementById('calc-mobile-left'),
    mobileVerdict: document.getElementById('calc-mobile-verdict'),
    mobileRight: document.getElementById('calc-mobile-right')
  };

  if (!elements.leftList || !elements.rightList || !elements.result) return;

  let storageAvailable = true;
  let storageWarningShown = false;
  let pickerSide = null;
  let pickerReturnFocus = null;
  let pickerActiveFruitId = null;
  let toastTimer = 0;

  function safeJsonRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      storageAvailable = false;
      return fallback;
    }
  }

  function safeJsonWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      storageAvailable = false;
      announceStorageIssue();
      return false;
    }
  }

  function safeJsonRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      storageAvailable = false;
      announceStorageIssue();
      return false;
    }
  }

  function announceStorageIssue() {
    if (storageWarningShown) return;
    storageWarningShown = true;
    window.setTimeout(() => showToast(t(
      'calculator.feedback.storageUnavailable',
      'Le stockage local est indisponible. Le calcul restera temporaire.'
    ), 'warning'), 0);
  }

  function sanitizeLine(line, mode = 'physical') {
    const fruitId = slugify(line?.fruitId || line?.id || '');
    if (!fruitById.has(fruitId)) return null;
    const quantity = mode === 'permanent'
      ? 1
      : Math.min(MAX_QUANTITY, Math.max(1, Number.parseInt(line?.quantity, 10) || 1));
    return { fruitId, quantity };
  }

  function sanitizeLines(lines, mode = 'physical') {
    if (!Array.isArray(lines)) return [];
    const seen = new Set();
    return lines.slice(0, MAX_FRUITS * 2).reduce((result, line) => {
      const clean = sanitizeLine(line, mode);
      if (!clean || seen.has(clean.fruitId) || result.length >= MAX_FRUITS) return result;
      seen.add(clean.fruitId);
      result.push(clean);
      return result;
    }, []);
  }

  function sanitizeState(candidate) {
    const mode = VALID_MODES.has(candidate?.mode) ? candidate.mode : 'physical';
    return {
      mode,
      left: sanitizeLines(candidate?.left || candidate?.yours, mode),
      right: sanitizeLines(candidate?.right || candidate?.theirs, mode)
    };
  }

  function parseQueryLines(raw, mode) {
    if (!raw) return [];
    return sanitizeLines(String(raw).split(',').map((entry) => {
      const [fruitId, quantity] = entry.trim().split(':');
      return { fruitId, quantity };
    }), mode);
  }

  function stateFromQuery() {
    const query = new URLSearchParams(window.location.search);
    const hasTradeData = query.has('yours') || query.has('theirs') || query.has('give') || query.has('want');
    if (!hasTradeData) return null;
    const mode = VALID_MODES.has(query.get('mode')) ? query.get('mode') : 'physical';
    return {
      mode,
      left: parseQueryLines(query.get('yours') || query.get('give'), mode),
      right: parseQueryLines(query.get('theirs') || query.get('want'), mode)
    };
  }

  const queryState = stateFromQuery();
  let state = queryState || sanitizeState(safeJsonRead(STATE_KEY, {}));

  function sanitizeHistory(candidate) {
    if (!Array.isArray(candidate)) return [];
    return candidate.slice(0, HISTORY_LIMIT * 2).reduce((result, entry) => {
      const clean = sanitizeState(entry);
      if (!clean.left.length || !clean.right.length) return result;
      const createdAt = Number(entry?.createdAt);
      result.push({
        id: String(entry?.id || `${createdAt || Date.now()}-${result.length}`),
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        ...clean
      });
      return result.slice(0, HISTORY_LIMIT);
    }, []);
  }

  let history = sanitizeHistory(safeJsonRead(HISTORY_KEY, []));

  function fruitImagePath(fruit) {
    return `assets/images/fruits/${slugify(fruit.name)}.webp`;
  }

  function valueFor(fruit, mode = state.mode) {
    const value = mode === 'permanent' ? fruit?.robux : fruit?.beli;
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function linesTotal(lines, mode = state.mode) {
    return lines.reduce((sum, line) => {
      const fruit = fruitById.get(line.fruitId);
      const quantity = mode === 'permanent' ? 1 : line.quantity;
      return sum + (valueFor(fruit, mode) * quantity);
    }, 0);
  }

  function language() {
    return i18n.getLanguage();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(language() === 'ary' ? 'fr-MA' : 'fr-FR', {
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function unitLabel(mode = state.mode) {
    return mode === 'permanent'
      ? t('calculator.value.robux', 'Robux')
      : t('calculator.value.beli', 'Beli');
  }

  function modeLabel(mode = state.mode) {
    return mode === 'permanent'
      ? t('mode.permanentLong', 'Fruit permanent')
      : t('mode.physicalLong', 'Fruit physique');
  }

  function formatValue(value, mode = state.mode) {
    return `${formatNumber(value)} ${unitLabel(mode)}`;
  }

  function sideLabel(side) {
    return side === 'left'
      ? t('calculator.side.yours', 'TON OFFRE')
      : t('calculator.side.theirs', 'LEUR OFFRE');
  }

  function persistState() {
    safeJsonWrite(STATE_KEY, state);
    const current = new URL(window.location.href);
    const handoffKeys = ['mode', 'yours', 'theirs', 'give', 'want'];
    if (handoffKeys.some((key) => current.searchParams.has(key))) {
      handoffKeys.forEach((key) => current.searchParams.delete(key));
      window.history.replaceState({}, '', `${current.pathname}${current.search}${current.hash}`);
    }
  }

  function currentShareUrl() {
    const url = new URL('calculator.html', window.location.href);
    url.search = '';
    url.hash = 'calculator-workspace';
    url.searchParams.set('mode', state.mode);
    if (state.left.length) url.searchParams.set('yours', serializeLines(state.left));
    if (state.right.length) url.searchParams.set('theirs', serializeLines(state.right));
    return url.href;
  }

  function serializeLines(lines) {
    return lines.map((line) => `${line.fruitId}:${state.mode === 'permanent' ? 1 : line.quantity}`).join(',');
  }

  function lineNames(lines, includeQuantity = true) {
    if (!lines.length) return '—';
    return lines.map((line) => {
      const fruit = fruitById.get(line.fruitId);
      if (!fruit) return '';
      const quantity = state.mode === 'permanent' ? 1 : line.quantity;
      return includeQuantity && quantity > 1 ? `${quantity}× ${fruit.name}` : fruit.name;
    }).filter(Boolean).join(' + ');
  }

  function resultData() {
    const leftTotal = linesTotal(state.left);
    const rightTotal = linesTotal(state.right);
    const complete = state.left.length > 0 && state.right.length > 0 && leftTotal > 0 && rightTotal > 0;

    if (!complete) {
      return {
        complete: false,
        status: 'waiting',
        leftTotal,
        rightTotal,
        difference: 0,
        percent: null,
        score: 0,
        label: t('calculator.result.waitingTitle', 'Compose les deux offres'),
        copy: t('calculator.result.waitingCopy', 'Ajoute au moins un fruit de chaque côté pour afficher la comparaison.'),
        shortLabel: '—',
        icon: 'fa-scale-balanced'
      };
    }

    const delta = leftTotal - rightTotal;
    const difference = Math.abs(delta);
    const percent = Math.round((difference / Math.max(leftTotal, rightTotal)) * 100);
    const score = Math.max(0, 100 - percent);
    let status = 'uneven';
    let label;
    let copy;
    let shortLabel;
    let icon = 'fa-arrow-trend-up';

    if (percent <= 5) {
      status = 'balanced';
      label = t('calculator.result.balancedTitle', 'Échange équilibré');
      copy = t('calculator.result.balancedCopy', 'Les deux côtés ont une valeur wiki très proche.');
      shortLabel = t('calculator.result.fair', 'Équilibré');
      icon = 'fa-scale-balanced';
    } else if (percent <= 15) {
      status = 'close';
      label = t('calculator.result.closeTitle', 'Échange assez proche');
      copy = t('calculator.result.closeCopy', "L’écart est limité, mais vérifie aussi la demande entre joueurs.");
      shortLabel = t('calculator.result.close', 'Proche');
      icon = 'fa-arrows-left-right-to-line';
    } else if (delta > 0) {
      label = t('calculator.result.youOverpayTitle', 'Tu donnes plus');
      copy = t('calculator.result.youOverpayCopy', 'Ton côté vaut {difference} de plus selon le wiki.', {
        difference: formatValue(difference)
      });
      shortLabel = t('calculator.result.uneven', 'Déséquilibré');
      icon = 'fa-arrow-left-long';
    } else {
      label = t('calculator.result.theyOverpayTitle', "L’autre joueur donne plus");
      copy = t('calculator.result.theyOverpayCopy', 'Leur côté vaut {difference} de plus selon le wiki.', {
        difference: formatValue(difference)
      });
      shortLabel = t('calculator.result.uneven', 'Déséquilibré');
      icon = 'fa-arrow-right-long';
    }

    return { complete, status, leftTotal, rightTotal, difference, percent, score, label, copy, shortLabel, icon, delta };
  }

  function fruitRow(line, side) {
    const fruit = fruitById.get(line.fruitId);
    if (!fruit) return '';
    const quantity = state.mode === 'permanent' ? 1 : line.quantity;
    const totalValue = valueFor(fruit) * quantity;
    const rarity = t(`rarity.${fruit.rarity}`, fruit.rarity);
    const removeLabel = t('calculator.aria.removeFruit', `Retirer ${fruit.name}`, {
      fruit: fruit.name,
      side: sideLabel(side)
    });
    const decreaseLabel = t('calculator.quantity.decreaseAria', `Réduire la quantité de ${fruit.name}`, { fruit: fruit.name });
    const increaseLabel = t('calculator.quantity.increaseAria', `Augmenter la quantité de ${fruit.name}`, { fruit: fruit.name });
    const quantityControls = state.mode === 'physical' ? `
      <div class="calc-quantity" aria-label="${escapeHtml(t('trading.quantityAria', `Quantité ${quantity}`, { count: quantity }))}">
        <button type="button" data-quantity-side="${side}" data-fruit-id="${line.fruitId}" data-quantity-delta="-1" aria-label="${escapeHtml(decreaseLabel)}" title="${escapeHtml(decreaseLabel)}" ${quantity <= 1 ? 'disabled' : ''}><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
        <span aria-hidden="true">${quantity}</span>
        <button type="button" data-quantity-side="${side}" data-fruit-id="${line.fruitId}" data-quantity-delta="1" aria-label="${escapeHtml(increaseLabel)}" title="${escapeHtml(increaseLabel)}" ${quantity >= MAX_QUANTITY ? 'disabled' : ''}><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
      </div>` : '';

    return `
      <article class="calc-fruit-row" data-rarity="${escapeHtml(fruit.rarity.toLowerCase())}">
        <span class="calc-fruit-art"><img src="${fruitImagePath(fruit)}" alt="${escapeHtml(t('aria.fruitIllustration', `Illustration du fruit ${fruit.name}`, { fruit: fruit.name }))}" width="72" height="72"></span>
        <span class="calc-fruit-copy">
          <strong>${escapeHtml(fruit.name)}</strong>
          <small><span>${escapeHtml(rarity)}</span><b aria-hidden="true">·</b>${escapeHtml(formatValue(totalValue))}</small>
        </span>
        ${quantityControls}
        <button class="calc-remove-fruit" type="button" data-remove-side="${side}" data-fruit-id="${line.fruitId}" aria-label="${escapeHtml(removeLabel)}" title="${escapeHtml(removeLabel)}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </article>`;
  }

  function renderSide(side) {
    const lines = side === 'left' ? state.left : state.right;
    const list = side === 'left' ? elements.leftList : elements.rightList;
    const count = side === 'left' ? elements.leftCount : elements.rightCount;
    const empty = side === 'left' ? elements.leftEmpty : elements.rightEmpty;
    const total = side === 'left' ? elements.leftTotal : elements.rightTotal;
    if (!list) return;

    list.innerHTML = lines.map((line) => fruitRow(line, side)).join('');
    if (count) count.textContent = t('calculator.side.capacity', `${lines.length}/4 fruits`, { count: lines.length });
    if (empty) empty.hidden = lines.length > 0;
    if (total) total.textContent = formatValue(linesTotal(lines));

    document.querySelectorAll(`[data-open-picker="${side}"]`).forEach((button) => {
      button.disabled = lines.length >= MAX_FRUITS;
      button.setAttribute('aria-disabled', String(lines.length >= MAX_FRUITS));
    });
    document.querySelectorAll(`[data-clear-side="${side}"]`).forEach((button) => {
      button.disabled = lines.length === 0;
    });
  }

  function renderMode() {
    document.querySelectorAll('input[name="calc-mode"]').forEach((input) => {
      input.checked = input.value === state.mode;
    });
    document.body.dataset.calcMode = state.mode;
  }

  function renderResult() {
    const result = resultData();
    elements.result.dataset.status = result.status;
    elements.result.classList.remove('is-waiting', 'is-balanced', 'is-close', 'is-uneven');
    elements.result.classList.add(`is-${result.status}`);
    elements.result.setAttribute('aria-label', t('calculator.result.liveAria', `Résultat du calcul : ${result.label}`, { result: result.label }));
    if (elements.resultIcon) elements.resultIcon.className = `fa-solid ${result.icon}`;
    if (elements.resultLabel) elements.resultLabel.textContent = result.label;
    if (elements.resultCopy) elements.resultCopy.textContent = result.copy;
    if (elements.resultLeft) elements.resultLeft.textContent = formatValue(result.leftTotal);
    if (elements.resultRight) elements.resultRight.textContent = formatValue(result.rightTotal);
    if (elements.resultGap) {
      elements.resultGap.textContent = result.complete
        ? (result.difference === 0
          ? t('calculator.result.equal', 'Même valeur wiki')
          : t('calculator.result.gap', `Écart de ${result.percent}%`, { percent: result.percent }))
        : '—';
    }
    if (elements.scoreRing) elements.scoreRing.style.setProperty('--calc-score', result.complete ? result.score : 0);
    if (elements.score) elements.score.textContent = result.complete ? `${result.score}%` : '—';

    const maxTotal = Math.max(result.leftTotal, result.rightTotal, 1);
    if (elements.leftBar) elements.leftBar.style.width = `${result.leftTotal ? Math.max(4, (result.leftTotal / maxTotal) * 100) : 0}%`;
    if (elements.rightBar) elements.rightBar.style.width = `${result.rightTotal ? Math.max(4, (result.rightTotal / maxTotal) * 100) : 0}%`;

    if (elements.mobileSummary) elements.mobileSummary.hidden = !result.complete;
    if (elements.mobileLeft) elements.mobileLeft.textContent = formatValue(result.leftTotal);
    if (elements.mobileVerdict) elements.mobileVerdict.textContent = result.shortLabel;
    if (elements.mobileRight) elements.mobileRight.textContent = formatValue(result.rightTotal);

    if (elements.save) elements.save.disabled = !result.complete;
    if (elements.share) elements.share.disabled = !result.complete;
    if (elements.copy) elements.copy.disabled = !result.complete;
    if (elements.whatsapp) {
      elements.whatsapp.classList.toggle('is-disabled', !result.complete);
      elements.whatsapp.setAttribute('aria-disabled', String(!result.complete));
      if (result.complete) elements.whatsapp.removeAttribute('tabindex');
      else elements.whatsapp.setAttribute('tabindex', '-1');
      elements.whatsapp.href = result.complete
        ? `https://wa.me/?text=${encodeURIComponent(`${shareText(result)}\n${currentShareUrl()}`)}`
        : '#calculator-workspace';
    }
    if (elements.findOffers) {
      const wanted = state.right.map((line) => fruitById.get(line.fruitId)?.name).filter(Boolean);
      const target = new URL('trading.html', window.location.href);
      if (wanted.length) target.searchParams.set('q', wanted[0]);
      target.searchParams.set('mode', state.mode);
      target.hash = 'trading-feed';
      elements.findOffers.href = target.href;
    }
  }

  function renderAll({ persist = false } = {}) {
    renderMode();
    renderSide('left');
    renderSide('right');
    renderResult();
    renderHistory();
    if (pickerSide) renderPicker();
    if (persist) persistState();
  }

  function setAlert(message) {
    if (!elements.alert) return;
    elements.alert.textContent = '';
    window.setTimeout(() => { elements.alert.textContent = message; }, 10);
  }

  function showToast(message, tone = 'success') {
    if (!elements.toast || !elements.toastMessage) return;
    window.clearTimeout(toastTimer);
    elements.toast.dataset.tone = tone;
    elements.toastMessage.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 3600);
  }

  function changeQuantity(side, fruitId, delta) {
    const lines = side === 'left' ? state.left : state.right;
    const line = lines.find((item) => item.fruitId === fruitId);
    if (!line || state.mode === 'permanent') return;
    line.quantity = Math.min(MAX_QUANTITY, Math.max(1, line.quantity + delta));
    renderAll({ persist: true });
  }

  function removeFruit(side, fruitId) {
    if (side === 'left') state.left = state.left.filter((line) => line.fruitId !== fruitId);
    else state.right = state.right.filter((line) => line.fruitId !== fruitId);
    renderAll({ persist: true });
  }

  function clearSide(side) {
    if (side === 'left') state.left = [];
    else state.right = [];
    renderAll({ persist: true });
  }

  function changeMode(mode) {
    if (!VALID_MODES.has(mode) || state.mode === mode) return;
    state.mode = mode;
    if (mode === 'permanent') {
      state.left.forEach((line) => { line.quantity = 1; });
      state.right.forEach((line) => { line.quantity = 1; });
    }
    renderAll({ persist: true });
    showToast(t('calculator.feedback.modeChanged', `Format changé : ${modeLabel()}.`, { mode: modeLabel() }));
  }

  function swapSides() {
    [state.left, state.right] = [state.right, state.left];
    renderAll({ persist: true });
    showToast(t('calculator.feedback.swapped', 'Les deux offres ont été inversées.'));
  }

  function resetCalculator() {
    state = { mode: 'physical', left: [], right: [] };
    renderAll({ persist: true });
    showToast(t('calculator.feedback.reset', 'Le calculateur a été réinitialisé.'));
  }

  function setPageInert(inert) {
    document.querySelectorAll('body > .announcement, body > .site-header, body > main, body > .site-footer, body > .mobile-bottom-nav, body > .calc-mobile-summary').forEach((element) => {
      if (element === elements.pickerModal) return;
      if (inert) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }

  function openPicker(side, trigger) {
    if (!['left', 'right'].includes(side) || !elements.pickerModal) return;
    const lines = side === 'left' ? state.left : state.right;
    if (lines.length >= MAX_FRUITS) {
      setAlert(t('calculator.feedback.maxReached', 'Tu as atteint la limite de quatre fruits pour ce côté.'));
      showToast(t('calculator.picker.limit', 'Maximum quatre fruits par côté.'), 'warning');
      return;
    }
    pickerSide = side;
    pickerReturnFocus = trigger || document.activeElement;
    pickerActiveFruitId = lines[0]?.fruitId || null;
    elements.pickerSearch.value = '';
    elements.pickerModal.hidden = false;
    document.body.classList.add('overlay-open', 'calculator-picker-open');
    setPageInert(true);
    renderPicker();
    window.requestAnimationFrame(() => elements.pickerSearch?.focus());
  }

  function closePicker() {
    if (!pickerSide || !elements.pickerModal) return;
    elements.pickerModal.hidden = true;
    document.body.classList.remove('overlay-open', 'calculator-picker-open');
    setPageInert(false);
    document.querySelectorAll('[data-open-picker]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    const returnFocus = pickerReturnFocus;
    pickerSide = null;
    pickerReturnFocus = null;
    pickerActiveFruitId = null;
    window.requestAnimationFrame(() => returnFocus?.focus());
  }

  function normalizeSearch(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function pickerOption(fruit, selected, disabled, tabbable) {
    const fruitId = slugify(fruit.name);
    const value = formatValue(valueFor(fruit));
    const sideKey = pickerSide === 'left' ? 'calculator.picker.addYoursAria' : 'calculator.picker.addTheirsAria';
    const baseLabel = t(sideKey, `Ajouter ${fruit.name}`, { fruit: fruit.name });
    const selectedLabel = t('calculator.picker.selectedAria', `${fruit.name} sélectionné`, { fruit: fruit.name });
    return `
      <button class="calc-picker-option${selected ? ' is-selected' : ''}" type="button" data-picker-fruit="${fruitId}" aria-pressed="${selected}" aria-label="${escapeHtml(selected ? selectedLabel : `${baseLabel}, ${value}`)}" tabindex="${tabbable ? '0' : '-1'}" ${disabled ? 'disabled' : ''}>
        <span class="calc-picker-art"><img src="${fruitImagePath(fruit)}" alt="" width="64" height="64"></span>
        <span class="calc-picker-copy"><strong>${escapeHtml(fruit.name)}</strong><small>${escapeHtml(t(`rarity.${fruit.rarity}`, fruit.rarity))} · ${escapeHtml(value)}</small></span>
        <span class="calc-picker-check" aria-hidden="true"><i class="fa-solid ${selected ? 'fa-check' : 'fa-plus'}"></i></span>
      </button>`;
  }

  function renderPicker({ focusFruitId = null } = {}) {
    if (!pickerSide || !elements.pickerList) return;
    const lines = pickerSide === 'left' ? state.left : state.right;
    const selected = new Set(lines.map((line) => line.fruitId));
    const query = normalizeSearch(elements.pickerSearch?.value);
    const filtered = fruits.filter((fruit) => normalizeSearch(`${fruit.name} ${fruit.rarity} ${fruit.type}`).includes(query));
    const atLimit = lines.length >= MAX_FRUITS;
    const enabledIds = filtered
      .map((fruit) => slugify(fruit.name))
      .filter((fruitId) => !atLimit || selected.has(fruitId));
    const focusedFruitId = document.activeElement?.dataset?.pickerFruit || null;
    const requestedFocusId = focusFruitId || focusedFruitId;
    const preferredId = slugify(requestedFocusId || pickerActiveFruitId || '');
    pickerActiveFruitId = enabledIds.includes(preferredId) ? preferredId : (enabledIds[0] || null);

    if (elements.pickerTitle) {
      elements.pickerTitle.textContent = pickerSide === 'left'
        ? t('calculator.picker.titleYours', 'Ajouter à ton offre')
        : t('calculator.picker.titleTheirs', 'Ajouter à leur offre');
    }
    elements.pickerList.innerHTML = filtered.map((fruit) => {
      const fruitId = slugify(fruit.name);
      const isSelected = selected.has(fruitId);
      return pickerOption(fruit, isSelected, atLimit && !isSelected, fruitId === pickerActiveFruitId);
    }).join('');
    if (elements.pickerEmpty) elements.pickerEmpty.hidden = filtered.length > 0;
    if (elements.pickerCount) elements.pickerCount.textContent = t('calculator.picker.selected', `${lines.length} sur 4 sélectionné(s)`, { count: lines.length });
    if (elements.pickerDone) elements.pickerDone.disabled = false;
    if (elements.pickerClearSearch) elements.pickerClearSearch.hidden = !query;
    if (requestedFocusId && pickerActiveFruitId) {
      window.requestAnimationFrame(() => {
        const target = Array.from(elements.pickerList.querySelectorAll('[data-picker-fruit]'))
          .find((button) => button.dataset.pickerFruit === pickerActiveFruitId);
        target?.focus();
      });
    }
  }

  function togglePickerFruit(fruitId) {
    if (!pickerSide || !fruitById.has(fruitId)) return;
    const lines = pickerSide === 'left' ? state.left : state.right;
    const existingIndex = lines.findIndex((line) => line.fruitId === fruitId);
    if (existingIndex >= 0) {
      lines.splice(existingIndex, 1);
    } else if (lines.length >= MAX_FRUITS) {
      setAlert(t('calculator.feedback.maxReached', 'Tu as atteint la limite de quatre fruits pour ce côté.'));
      showToast(t('calculator.picker.limit', 'Maximum quatre fruits par côté.'), 'warning');
      return;
    } else {
      lines.push({ fruitId, quantity: 1 });
    }
    renderSide(pickerSide);
    renderResult();
    renderPicker({ focusFruitId: fruitId });
    persistState();
  }

  function pickerFocusable() {
    if (!elements.pickerModal) return [];
    return Array.from(elements.pickerModal.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hidden && element.offsetParent !== null);
  }

  function handlePickerKeys(event) {
    if (!pickerSide) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = pickerFocusable();
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
      return;
    }
    const option = event.target.closest('[data-picker-fruit]');
    if (!option || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const options = Array.from(elements.pickerList.querySelectorAll('[data-picker-fruit]:not([disabled])'));
    const current = options.indexOf(option);
    if (current < 0) return;
    event.preventDefault();
    const columns = window.matchMedia('(max-width: 360px)').matches ? 1 : (window.matchMedia('(max-width: 760px)').matches ? 2 : 3);
    let next = current;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = options.length - 1;
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    if (event.key === 'ArrowRight') next = Math.min(options.length - 1, current + 1);
    if (event.key === 'ArrowUp') next = Math.max(0, current - columns);
    if (event.key === 'ArrowDown') next = Math.min(options.length - 1, current + columns);
    options.forEach((button) => button.setAttribute('tabindex', '-1'));
    if (options[next]) {
      options[next].setAttribute('tabindex', '0');
      pickerActiveFruitId = options[next].dataset.pickerFruit;
      options[next].focus();
    }
  }

  function shareText(result = resultData()) {
    return [
      t('calculator.shareMessage.intro', 'Voici ma comparaison d’échange Itemsouq (démo) :'),
      t('calculator.shareMessage.format', `Format : ${modeLabel()}`, { mode: modeLabel() }),
      t('calculator.shareMessage.yours', `Mon offre : ${lineNames(state.left)} (${formatValue(result.leftTotal)})`, {
        fruits: lineNames(state.left), value: formatValue(result.leftTotal)
      }),
      t('calculator.shareMessage.theirs', `Leur offre : ${lineNames(state.right)} (${formatValue(result.rightTotal)})`, {
        fruits: lineNames(state.right), value: formatValue(result.rightTotal)
      }),
      t('calculator.shareMessage.result', `Résultat : ${result.label}`, { result: result.label }),
      t('calculator.shareMessage.gap', `Écart wiki : ${result.percent}%`, { percent: result.percent ?? 0 }),
      t('calculator.shareMessage.notice', 'Repère wiki uniquement ; la demande réelle peut varier.')
    ].join('\n');
  }

  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy failed');
    return true;
  }

  async function shareCalculation() {
    const result = resultData();
    if (!result.complete) {
      setAlert(t('calculator.validation.bothSides', 'Ajoute au moins un fruit de chaque côté.'));
      return;
    }
    const text = shareText(result);
    const url = currentShareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: t('calculator.shareMessage.title', 'Calcul d’échange Itemsouq'), text, url });
        showToast(t('calculator.feedback.shareOpened', 'Résumé envoyé au menu de partage.'));
      } else {
        await writeClipboard(`${text}\n${url}`);
        showToast(t('calculator.feedback.copied', 'Résumé copié.'));
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      try {
        await writeClipboard(`${text}\n${url}`);
        showToast(t('calculator.feedback.copied', 'Résumé copié.'));
      } catch (copyError) {
        showToast(t('calculator.feedback.shareFailed', 'Impossible de partager ou de copier ce calcul.'), 'error');
      }
    }
  }

  async function copyCalculation() {
    const result = resultData();
    if (!result.complete) {
      setAlert(t('calculator.validation.bothSides', 'Ajoute au moins un fruit de chaque côté.'));
      return;
    }
    try {
      await writeClipboard(`${shareText(result)}\n${currentShareUrl()}`);
      showToast(t('calculator.feedback.copied', 'Résumé copié.'));
    } catch (error) {
      showToast(t('calculator.feedback.shareFailed', 'Impossible de partager ou de copier ce calcul.'), 'error');
    }
  }

  function saveCalculation() {
    const result = resultData();
    if (!result.complete) {
      setAlert(t('calculator.validation.bothSides', 'Ajoute au moins un fruit de chaque côté.'));
      showToast(t('calculator.validation.bothSides', 'Ajoute au moins un fruit de chaque côté.'), 'warning');
      return;
    }
    const fingerprint = JSON.stringify({ mode: state.mode, left: state.left, right: state.right });
    history = history.filter((entry) => JSON.stringify({ mode: entry.mode, left: entry.left, right: entry.right }) !== fingerprint);
    history.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      mode: state.mode,
      left: state.left.map((line) => ({ ...line })),
      right: state.right.map((line) => ({ ...line }))
    });
    history = history.slice(0, HISTORY_LIMIT);
    if (safeJsonWrite(HISTORY_KEY, history)) {
      renderHistory();
      showToast(t('calculator.feedback.saved', 'Calcul enregistré sur cet appareil.'));
    }
  }

  function historyDate(timestamp) {
    return new Intl.DateTimeFormat(language() === 'ary' ? 'fr-MA' : 'fr-FR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
  }

  function historyCard(entry) {
    const leftTotal = linesTotal(entry.left, entry.mode);
    const rightTotal = linesTotal(entry.right, entry.mode);
    const leftNames = entry.left.map((line) => fruitById.get(line.fruitId)?.name).filter(Boolean).join(', ');
    const rightNames = entry.right.map((line) => fruitById.get(line.fruitId)?.name).filter(Boolean).join(', ');
    const date = historyDate(entry.createdAt);
    const deleteLabel = t('calculator.history.deleteAria', `Supprimer le calcul du ${date}`, { date });
    const mode = entry.mode === 'permanent' ? t('mode.permanent', 'Permanent') : t('mode.physical', 'Physique');
    return `
      <article class="calc-history-card" role="listitem">
        <div class="calc-history-card-head"><span class="calc-history-mode"><i class="fa-solid ${entry.mode === 'permanent' ? 'fa-infinity' : 'fa-box-open'}" aria-hidden="true"></i>${escapeHtml(mode)}</span><time datetime="${new Date(entry.createdAt).toISOString()}">${escapeHtml(date)}</time></div>
        <div class="calc-history-trade">
          <div><small>${escapeHtml(t('calculator.side.yours', 'TON OFFRE'))}</small><strong>${escapeHtml(leftNames || '—')}</strong><span>${escapeHtml(formatValue(leftTotal, entry.mode))}</span></div>
          <i class="fa-solid fa-right-left" aria-hidden="true"></i>
          <div><small>${escapeHtml(t('calculator.side.theirs', 'LEUR OFFRE'))}</small><strong>${escapeHtml(rightNames || '—')}</strong><span>${escapeHtml(formatValue(rightTotal, entry.mode))}</span></div>
        </div>
        <div class="calc-history-actions">
          <button class="btn calc-history-restore" type="button" data-history-restore="${escapeHtml(entry.id)}"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span>${escapeHtml(t('calculator.history.restore', 'Reprendre'))}</span></button>
          <button class="calc-history-delete" type="button" data-history-delete="${escapeHtml(entry.id)}" aria-label="${escapeHtml(deleteLabel)}" title="${escapeHtml(deleteLabel)}"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
        </div>
      </article>`;
  }

  function renderHistory() {
    if (!elements.history) return;
    elements.history.innerHTML = history.map(historyCard).join('');
    if (elements.historyEmpty) elements.historyEmpty.hidden = history.length > 0;
    if (elements.historyClear) {
      elements.historyClear.hidden = history.length === 0;
      elements.historyClear.disabled = history.length === 0;
    }
    if (elements.historySection) elements.historySection.dataset.count = String(history.length);
  }

  function restoreHistory(id) {
    const entry = history.find((item) => item.id === id);
    if (!entry) return;
    state = sanitizeState(entry);
    renderAll({ persist: true });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('calculator-workspace')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    showToast(t('calculator.feedback.restored', 'Calcul restauré.'));
  }

  function deleteHistory(id) {
    history = history.filter((item) => item.id !== id);
    if (safeJsonWrite(HISTORY_KEY, history)) {
      renderHistory();
      showToast(t('calculator.feedback.deleted', 'Calcul supprimé.'));
    }
  }

  function clearHistory() {
    if (!history.length) return;
    if (!window.confirm(t('calculator.history.confirmClear', 'Effacer tous les calculs enregistrés sur cet appareil ?'))) return;
    history = [];
    safeJsonRemove(HISTORY_KEY);
    renderHistory();
    showToast(t('calculator.feedback.cleared', 'Tous les calculs enregistrés ont été supprimés.'));
  }

  document.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open-picker]');
    if (openButton) {
      openButton.setAttribute('aria-expanded', 'true');
      openPicker(openButton.dataset.openPicker, openButton);
      return;
    }

    const removeButton = event.target.closest('[data-remove-side]');
    if (removeButton) {
      removeFruit(removeButton.dataset.removeSide, removeButton.dataset.fruitId);
      return;
    }

    const quantityButton = event.target.closest('[data-quantity-side]');
    if (quantityButton) {
      changeQuantity(quantityButton.dataset.quantitySide, quantityButton.dataset.fruitId, Number(quantityButton.dataset.quantityDelta));
      return;
    }

    const clearButton = event.target.closest('[data-clear-side]');
    if (clearButton) {
      clearSide(clearButton.dataset.clearSide);
      return;
    }

    const pickerFruit = event.target.closest('[data-picker-fruit]');
    if (pickerFruit) {
      togglePickerFruit(pickerFruit.dataset.pickerFruit);
      return;
    }

    if (event.target.closest('[data-close-picker]') || event.target === elements.pickerModal) {
      closePicker();
      return;
    }

    const restore = event.target.closest('[data-history-restore]');
    if (restore) {
      restoreHistory(restore.dataset.historyRestore);
      return;
    }

    const removeHistory = event.target.closest('[data-history-delete]');
    if (removeHistory) deleteHistory(removeHistory.dataset.historyDelete);
  });

  elements.mode?.addEventListener('change', (event) => {
    if (event.target.matches('input[name="calc-mode"]')) changeMode(event.target.value);
  });
  elements.swap?.addEventListener('click', swapSides);
  elements.reset?.addEventListener('click', resetCalculator);
  elements.save?.addEventListener('click', saveCalculation);
  elements.share?.addEventListener('click', shareCalculation);
  elements.copy?.addEventListener('click', copyCalculation);
  elements.historyClear?.addEventListener('click', clearHistory);
  elements.pickerDone?.addEventListener('click', closePicker);
  elements.pickerSearch?.addEventListener('input', renderPicker);
  elements.pickerClearSearch?.addEventListener('click', () => {
    elements.pickerSearch.value = '';
    renderPicker();
    elements.pickerSearch.focus();
  });
  elements.pickerModal?.addEventListener('keydown', handlePickerKeys);
  elements.whatsapp?.addEventListener('click', (event) => {
    if (elements.whatsapp.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      setAlert(t('calculator.validation.bothSides', 'Ajoute au moins un fruit de chaque côté.'));
    }
  });

  document.addEventListener('itemsouq:languagechange', () => {
    renderAll();
    if (pickerSide) renderPicker();
    if (mobileMenuTrigger && mobileMenu) {
      const menuLabel = mobileMenu.hidden
        ? t('aria.openMenu', 'Ouvrir le menu')
        : t('trading.menu.close', 'Fermer le menu');
      mobileMenuTrigger.setAttribute('aria-label', menuLabel);
      mobileMenuTrigger.setAttribute('title', menuLabel);
    }
  });

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) renderAll();
  });

  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuTrigger = document.querySelector('.mobile-menu-trigger');
  function toggleMobileMenu(forceClosed = false) {
    if (!mobileMenu || !mobileMenuTrigger) return;
    const willOpen = !forceClosed && mobileMenu.hidden;
    mobileMenu.hidden = !willOpen;
    mobileMenuTrigger.setAttribute('aria-expanded', String(willOpen));
    const label = willOpen
      ? t('trading.menu.close', 'Fermer le menu')
      : t('aria.openMenu', 'Ouvrir le menu');
    mobileMenuTrigger.setAttribute('aria-label', label);
    mobileMenuTrigger.setAttribute('title', label);
  }
  mobileMenuTrigger?.addEventListener('click', () => toggleMobileMenu());
  mobileMenu?.addEventListener('click', (event) => {
    if (event.target.closest('a')) toggleMobileMenu(true);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !pickerSide && mobileMenu && !mobileMenu.hidden) {
      toggleMobileMenu(true);
      mobileMenuTrigger?.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 920 && mobileMenu && !mobileMenu.hidden) toggleMobileMenu(true);
  });

  renderAll();
  if (!storageAvailable) announceStorageIssue();
})();
