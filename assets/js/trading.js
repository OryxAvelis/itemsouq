/* Itemsouq Trading — shared community marketplace */
(function () {
  'use strict';

  const fruits = Array.isArray(window.ITEMSOUQ_FRUITS) ? window.ITEMSOUQ_FRUITS : [];
  const i18n = window.ITEMSOUQ_I18N;
  const l = (key, fallback, variables) => i18n?.t(key, fallback, variables) ?? fallback;
  const language = () => i18n?.getLanguage?.() || 'fr';
  const STORAGE = {
    saved: 'itemsouq:trading:v3:saved',
    draft: 'itemsouq:trading:v3:draft',
    tracker: 'itemsouq:trading:v1:tracker',
    blocked: 'itemsouq:trading:v1:blocked',
    ownerTokens: 'itemsouq:trading:v4:owner-tokens',
    responseTokens: 'itemsouq:trading:v4:response-tokens'
  };
  const API = {
    trades: 'api/v1/trades.php',
    trade: 'api/v1/trade.php',
    responses: 'api/v1/trade-responses.php',
    tradeAction: 'api/v1/trade-action.php',
    responseAction: 'api/v1/trade-response-action.php'
  };
  const MAX_FRUITS = 4;
  const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
  const INTERACTION_STATES = new Set([
    'awaiting_response',
    'offer_sent',
    'counter_received',
    'accepted',
    'declined',
    'completed'
  ]);
  const RESPONSE_OUTCOMES = new Set(['pending', 'accepted', 'declined', 'withdrawn', 'removed']);
  const TRADE_STATUSES = new Set(['open', 'matched', 'completed', 'closed', 'expired']);
  const TRACKER_STAGES = ['prepared', 'player_contacted', 'exchange_pending', 'completed'];

  const rarityLabels = {
    Common: 'Commun',
    Uncommon: 'Peu commun',
    Rare: 'Rare',
    Legendary: 'Légendaire',
    Mythical: 'Mythique'
  };
  const rarityLabel = (rarity) => l(`rarity.${rarity}`, rarityLabels[rarity] || rarity);

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
      offered: new Map(),
      wanted: new Map()
    },
    counter: new Map(),
    activeTradeId: null,
    tracker: new Map(),
    blocked: new Set(),
    ownerTokens: new Map(),
    responseTokens: new Map(),
    responsesLoaded: new Set(),
    responseErrors: new Map(),
    lastBlockedTradeId: null,
    stats: { open: 0, responses: 0 },
    apiStatus: 'loading',
    apiError: ''
  };

  let activeModal = null;
  let returnFocus = null;
  let toastTimer = null;
  let isSubmitting = false;
  let createDraft = null;
  let pendingCreateSubmission = null;
  let pendingResponseSubmission = null;

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
      showToast(l('trading.feedback.storageUnavailable', 'Le stockage local est indisponible. Tes changements restent temporaires.'), 'warning');
      return false;
    }
  }

  function storageIsWritable() {
    const probe = 'itemsouq:trading:storage-probe';
    try {
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (error) {
      return false;
    }
  }

  class TradingApiError extends Error {
    constructor(message, status = 0, code = 'request_failed', fields = null) {
      super(message);
      this.name = 'TradingApiError';
      this.status = status;
      this.code = code;
      this.fields = fields;
    }
  }

  async function apiRequest(url, { method = 'GET', body = null, token = '' } = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    const headers = { Accept: 'application/json' };
    if (body !== null) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body === null ? null : JSON.stringify(body),
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok || !payload?.ok) {
        const error = payload?.error || {};
        throw new TradingApiError(
          typeof error.message === 'string' && error.message ? error.message : l('trading.api.requestFailed', 'Impossible de contacter le service Trading.'),
          response.status,
          typeof error.code === 'string' ? error.code : 'request_failed',
          error.fields && typeof error.fields === 'object'
            ? error.fields
            : error.details && typeof error.details === 'object' ? error.details : null
        );
      }
      return payload.data ?? payload;
    } catch (error) {
      if (error instanceof TradingApiError) throw error;
      if (error?.name === 'AbortError') {
        throw new TradingApiError(l('trading.api.timeout', 'Le service Trading met trop de temps à répondre.'), 0, 'timeout');
      }
      throw new TradingApiError(l('trading.api.unavailable', 'Le service Trading est momentanément indisponible.'), 0, 'network_error');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function uniqueId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function requestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto?.getRandomValues?.(bytes);
    if (!bytes.some(Boolean)) {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function displayTradeNote(trade) {
    return trade.note;
  }

  function displayResponseNote(response) {
    return response.note;
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
    const result = [];
    let usedSlots = 0;
    for (const line of lines) {
      const clean = sanitizeLine(line, mode);
      if (!clean || usedSlots >= MAX_FRUITS) continue;
      const existing = result.find((item) => item.fruitId === clean.fruitId);
      if (existing) {
        if (mode === 'permanent') continue;
        const increment = Math.min(clean.quantity, MAX_FRUITS - usedSlots, MAX_FRUITS - existing.quantity);
        if (increment > 0) {
          existing.quantity += increment;
          usedSlots += increment;
        }
        continue;
      }
      const quantity = Math.min(clean.quantity, MAX_FRUITS - usedSlots);
      result.push({ fruitId: clean.fruitId, quantity });
      usedSlots += quantity;
    }
    return result;
  }

  function selectionFromLines(lines, mode = 'physical') {
    return new Map(sanitizeLines(lines, mode).map((line) => [line.fruitId, line.quantity]));
  }

  function selectionToLines(selection, mode = 'physical') {
    if (!(selection instanceof Map)) return [];
    return sanitizeLines([...selection.entries()].map(([fruitId, quantity]) => ({ fruitId, quantity })), mode);
  }

  function apiLines(lines) {
    return lines.map((line) => ({ fruitSlug: line.fruitId, quantity: line.quantity }));
  }

  function selectionSlots(selection) {
    if (!(selection instanceof Map)) return 0;
    return [...selection.values()].reduce((total, quantity) => total + quantity, 0);
  }

  function lineSlots(lines) {
    if (!Array.isArray(lines)) return 0;
    return lines.reduce((total, line) => total + (Number.parseInt(line?.quantity, 10) || 1), 0);
  }

  function sanitizeUsername(value) {
    const username = typeof value === 'string' ? value.trim().slice(0, 20) : '';
    return USERNAME_PATTERN.test(username) ? username : '';
  }

  function clampInteger(value, minimum, maximum, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
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
      createdAt: date.toISOString(),
      updatedAt: Number.isNaN(new Date(response.updatedAt).getTime()) ? date.toISOString() : new Date(response.updatedAt).toISOString(),
      outcome: RESPONSE_OUTCOMES.has(response.outcome) ? response.outcome : 'pending',
      version: clampInteger(response.version, 1, 2147483647, 1)
    };
  }

  function sanitizeTrade(trade) {
    if (!trade || typeof trade !== 'object') return null;
    const id = typeof trade.id === 'string' && /^[A-Za-z0-9_-]{1,90}$/.test(trade.id) ? trade.id : '';
    const username = sanitizeUsername(trade.username);
    const mode = trade.mode === 'permanent' ? 'permanent' : trade.mode === 'physical' ? 'physical' : '';
    const status = TRADE_STATUSES.has(trade.status) ? trade.status : '';
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

    const normalized = {
      id,
      username,
      mode,
      status,
      owned: state.ownerTokens.has(id),
      offered,
      wanted,
      note: typeof trade.note === 'string' ? trade.note.trim().slice(0, 180) : '',
      createdAt: date.toISOString(),
      responses,
      responseCount: clampInteger(trade.responseCount, responses.length, 999999, responses.length),
      version: clampInteger(trade.version, 1, 2147483647, 1)
    };
    return normalized;
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

  function sanitizeDraft(input) {
    if (!input || typeof input !== 'object') return null;
    const mode = input.mode === 'permanent' ? 'permanent' : 'physical';
    const normalizeDraftLines = (value) => Array.isArray(value)
      ? value.map((item) => typeof item === 'string' ? { fruitId: item, quantity: 1 } : item)
      : [];
    const offered = sanitizeLines(normalizeDraftLines(input.offered), mode);
    const offeredIds = new Set(offered.map((line) => line.fruitId));
    const wanted = sanitizeLines(normalizeDraftLines(input.wanted), mode)
      .filter((line) => !offeredIds.has(line.fruitId));
    const username = typeof input.username === 'string' ? input.username.slice(0, 20) : '';
    const note = typeof input.note === 'string' ? input.note.slice(0, 180) : '';
    const savedAt = new Date(input.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;
    if (!username.trim() && !note.trim() && !offered.length && !wanted.length) return null;
    return { username, mode, offered, wanted, note, savedAt: savedAt.toISOString() };
  }

  function sanitizeIdSet(input, validIds = null) {
    return new Set(Array.isArray(input)
      ? input.filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,90}$/.test(id) && (!validIds || validIds.has(id))).slice(0, 250)
      : []);
  }

  function sanitizeTracker(input, validIds = null) {
    const result = new Map();
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
    for (const [tradeId, record] of Object.entries(input)) {
      if (!/^[A-Za-z0-9_-]{1,90}$/.test(tradeId) || (validIds && !validIds.has(tradeId)) || !record || typeof record !== 'object') continue;
      const stage = TRACKER_STAGES.includes(record.stage) ? record.stage : '';
      const updatedAt = new Date(record.updatedAt);
      if (!stage || Number.isNaN(updatedAt.getTime())) continue;
      result.set(tradeId, { stage, updatedAt: updatedAt.toISOString() });
      if (result.size === 100) break;
    }
    return result;
  }

  function sanitizeOwnerTokens(input) {
    const result = new Map();
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
    for (const [tradeId, token] of Object.entries(input)) {
      if (!/^[A-Za-z0-9_-]{1,90}$/.test(tradeId)) continue;
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32,180}$/.test(token)) continue;
      result.set(tradeId, token);
      if (result.size === 250) break;
    }
    return result;
  }

  function sanitizeResponseTokens(input) {
    const result = new Map();
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
    for (const [responseId, record] of Object.entries(input)) {
      if (!/^[A-Za-z0-9_-]{1,90}$/.test(responseId) || !record || typeof record !== 'object') continue;
      if (typeof record.tradeId !== 'string' || !/^[A-Za-z0-9_-]{1,90}$/.test(record.tradeId)) continue;
      if (typeof record.token !== 'string' || !/^[A-Za-z0-9_-]{32,180}$/.test(record.token)) continue;
      result.set(responseId, { tradeId: record.tradeId, token: record.token });
      if (result.size === 500) break;
    }
    return result;
  }

  function hydrateState() {
    state.ownerTokens = sanitizeOwnerTokens(safeJsonRead(STORAGE.ownerTokens, {}));
    state.responseTokens = sanitizeResponseTokens(safeJsonRead(STORAGE.responseTokens, {}));
    state.saved = sanitizeIdSet(safeJsonRead(STORAGE.saved, []));
    state.blocked = sanitizeIdSet(safeJsonRead(STORAGE.blocked, []));
    state.tracker = sanitizeTracker(safeJsonRead(STORAGE.tracker, {}));

    createDraft = sanitizeDraft(safeJsonRead(STORAGE.draft, null));

    persistSaved();
    persistModeration();
    persistTracker();
    persistOwnerTokens();
    persistResponseTokens();
  }

  function persistSaved() {
    safeJsonWrite(STORAGE.saved, [...state.saved]);
  }

  function persistModeration() {
    safeJsonWrite(STORAGE.blocked, [...state.blocked]);
  }

  function persistTracker() {
    safeJsonWrite(STORAGE.tracker, Object.fromEntries(state.tracker));
  }

  function persistOwnerTokens() {
    return safeJsonWrite(STORAGE.ownerTokens, Object.fromEntries(state.ownerTokens));
  }

  function persistResponseTokens() {
    return safeJsonWrite(STORAGE.responseTokens, Object.fromEntries(state.responseTokens));
  }

  function fruitImagePath(fruit) {
    return `assets/images/fruits/${slugify(fruit.name)}.webp`;
  }

  function modeCopy(mode) {
    return mode === 'permanent'
      ? { label: l('trading.mode.permanent', 'Permanent'), icon: 'fa-infinity', unit: 'Robux' }
      : { label: l('trading.mode.physical', 'Physique'), icon: 'fa-box-open', unit: 'Beli' };
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
    const locale = language() === 'ary' ? 'fr-MA' : 'fr-FR';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
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
    if (seconds < 60) return l('trading.now', 'à l’instant');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return l('trading.minutesAgo', `il y a ${minutes} min`, { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return l('trading.hoursAgo', `il y a ${hours} h`, { count: hours });
    const days = Math.floor(hours / 24);
    return l('trading.daysAgo', `il y a ${days} j`, { count: days });
  }

  function fullDate(isoDate) {
    return new Intl.DateTimeFormat('fr-MA', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(isoDate));
  }

  function interactionState(trade) {
    if (trade.status === 'completed') return 'completed';
    if (trade.owned) {
      if (trade.responses.some((response) => response.outcome === 'accepted')) return 'accepted';
      if (trade.responses.some((response) => response.outcome === 'pending')) return 'counter_received';
      return 'awaiting_response';
    }
    const responseIds = new Set([...state.responseTokens.entries()]
      .filter(([, record]) => record.tradeId === trade.id)
      .map(([responseId]) => responseId));
    if (!responseIds.size) return null;
    const ownedResponses = trade.responses.filter((response) => responseIds.has(response.id));
    if (!ownedResponses.length && !state.responsesLoaded.has(trade.id)) return 'offer_sent';
    if (ownedResponses.some((response) => response.outcome === 'accepted')) return 'accepted';
    if (ownedResponses.some((response) => response.outcome === 'pending')) return 'offer_sent';
    if (ownedResponses.some((response) => response.outcome === 'declined')) return 'declined';
    return null;
  }

  function interactionMeta(stateName) {
    const states = {
      awaiting_response: { key: 'trading.interaction.awaitingResponse', fallback: 'En attente de réponse', icon: 'fa-clock' },
      offer_sent: { key: 'trading.interaction.offerSent', fallback: 'Offre envoyée', icon: 'fa-paper-plane' },
      counter_received: { key: 'trading.interaction.counterReceived', fallback: 'Contre-offre reçue', icon: 'fa-comments' },
      accepted: { key: 'trading.interaction.accepted', fallback: 'Acceptée', icon: 'fa-circle-check' },
      declined: { key: 'trading.interaction.declined', fallback: 'Refusée', icon: 'fa-circle-xmark' },
      completed: { key: 'trading.interaction.completed', fallback: 'Échange terminé', icon: 'fa-flag-checkered' }
    };
    return states[stateName] || null;
  }

  function interactionMarkup(trade, detail = false) {
    const stateName = interactionState(trade);
    const meta = interactionMeta(stateName);
    if (!meta) return '';
    return `<p class="trade-interaction-state state-${stateName}${detail ? ' is-detail' : ''}" data-interaction-state tabindex="-1"><i class="fa-solid ${meta.icon}" aria-hidden="true"></i><span>${escapeHtml(l(meta.key, meta.fallback))}</span></p>`;
  }

  function trustMarkup(trade, detail = false) {
    const profileLabel = l('trading.community.profileAria', `Actions pour l'offre de ${trade.username}`, { username: trade.username });
    const moderation = trade.owned ? '' : `
      <div class="trade-trust-actions">
        <button type="button" class="trade-trust-action block" data-block-trade="${escapeHtml(trade.id)}" aria-label="${escapeHtml(l('trading.moderation.blockAria', `Masquer le profil de ${trade.username} sur cet appareil`, { username: trade.username }))}"><i class="fa-solid fa-user-slash" aria-hidden="true"></i><span>${escapeHtml(l('trading.moderation.block', 'Masquer'))}</span></button>
      </div>`;
    return `
      <section class="trade-trust${detail ? ' is-detail' : ''}" aria-label="${escapeHtml(profileLabel)}">
        <div class="trade-community-meta">
          <i class="fa-solid fa-users" aria-hidden="true"></i>
          <span><strong>${escapeHtml(trade.owned ? l('trading.community.owned', 'Offre gérée sur cet appareil') : l('trading.community.public', 'Offre publique communautaire'))}</strong><small>${escapeHtml(l('trading.community.unverified', 'Pseudo Roblox non vérifié · vérifie tout dans le jeu'))}</small></span>
        </div>
        ${moderation}
      </section>`;
  }

  function tradeStatusMeta(status) {
    const statuses = {
      open: { key: 'trading.status.open', fallback: 'Ouverte', className: '' },
      matched: { key: 'trading.status.matched', fallback: 'Accord trouvé', className: ' matched' },
      completed: { key: 'trading.status.completed', fallback: 'Terminée', className: ' completed' },
      closed: { key: 'trading.status.closed', fallback: 'Fermée', className: ' completed' },
      expired: { key: 'trading.status.expired', fallback: 'Expirée', className: ' completed' }
    };
    return statuses[status] || statuses.closed;
  }

  function primaryTradeAction(trade) {
    const stateName = interactionState(trade);
    if (trade.owned) return { intent: 'manage', key: 'trading.manage', fallback: 'Gérer' };
    if (trade.status !== 'open' || ['accepted', 'completed'].includes(stateName)) {
      return { intent: 'view', key: 'trading.view', fallback: 'Voir' };
    }
    if (stateName === 'counter_received') {
      return { intent: 'counter', key: 'trading.cta.counteroffer', fallback: 'Faire une contre-offre' };
    }
    if (stateName === 'offer_sent') {
      return { intent: 'track', key: 'trading.cta.viewResponse', fallback: 'Voir la réponse' };
    }
    return { intent: 'offer', key: 'trading.cta.makeOffer', fallback: 'Faire une offre' };
  }

  function calculatorUrlForTrade(trade) {
    const encodeLines = (lines) => lines
      .map((line) => `${line.fruitId}:${line.quantity}`)
      .join(',');
    const yours = trade.owned ? trade.offered : trade.wanted;
    const theirs = trade.owned ? trade.wanted : trade.offered;
    return `calculator.html?mode=${trade.mode}&yours=${encodeLines(yours)}&theirs=${encodeLines(theirs)}`;
  }

  function calculatorAriaLabel(trade) {
    return l(
      'trading.calculateTradeAria',
      `Calculer l'offre de ${trade.username}`,
      { username: trade.username }
    );
  }

  function announceError(message) {
    const region = byId('trade-alert-region');
    if (!region) return;
    region.textContent = '';
    window.requestAnimationFrame(() => { region.textContent = message; });
  }

  function showToast(message, type = 'success') {
    const toast = byId('trade-toast');
    if (!toast) return;
    byId('trade-toast-message').textContent = message;
    const icon = $('.toast-icon i', toast);
    const iconName = type === 'warning'
      ? 'fa-triangle-exclamation'
      : type === 'info'
        ? 'fa-share-nodes'
        : 'fa-check';
    icon.className = `fa-solid ${iconName}`;
    toast.classList.toggle('warning', type === 'warning');
    toast.classList.toggle('info', type === 'info');
    toast.hidden = false;
    if (type === 'warning') announceError(message);
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
      const quantity = line.quantity > 1
        ? `<b aria-label="${escapeHtml(l('trading.quantityAria', `Quantité ${line.quantity}`, { count: line.quantity }))}">×${line.quantity}</b>`
        : '';
      return `
        <div class="trade-fruit-mini">
          <span class="trade-fruit-mini-img"><img src="${fruitImagePath(fruit)}" alt="" width="512" height="512" loading="lazy" decoding="async">${quantity}</span>
          <span><strong>${escapeHtml(fruit.name)}</strong><small>${escapeHtml(rarityLabel(fruit.rarity))} · ${formatValue(valueFor(fruit, mode) * line.quantity, mode)}</small></span>
        </div>`;
    }).join('');
  }

  function sideMarkup(lines, mode, side) {
    const offered = side === 'give';
    return `
      <div class="trade-side">
        <span class="trade-side-label ${offered ? 'give' : 'want'}"><i class="fa-solid ${offered ? 'fa-arrow-up' : 'fa-arrow-down'}" aria-hidden="true"></i>${offered ? l('trading.give', 'Propose') : l('trading.want', 'Recherche')}</span>
        <div class="trade-fruit-stack">${fruitRows(lines, mode)}</div>
        <div class="trade-side-value"><span>${l('trading.wikiValue', 'Valeur wiki')}</span><strong>${formatValue(linesValue(lines, mode), mode)}</strong></div>
      </div>`;
  }

  function trackerStageMeta(stage) {
    const stages = {
      prepared: { key: 'trading.tracker.prepared', fallback: 'Préparé', icon: 'fa-clipboard-check' },
      player_contacted: { key: 'trading.tracker.playerContacted', fallback: 'Joueur contacté', icon: 'fa-user-check' },
      exchange_pending: { key: 'trading.tracker.exchangePending', fallback: 'Échange en attente', icon: 'fa-hourglass-half' },
      completed: { key: 'trading.tracker.completed', fallback: 'Terminé', icon: 'fa-circle-check' }
    };
    return stages[stage] || stages.prepared;
  }

  function ensureTracker(tradeId, minimumStage = 'prepared') {
    const existing = state.tracker.get(tradeId);
    const requestedIndex = Math.max(0, TRACKER_STAGES.indexOf(minimumStage));
    const existingIndex = existing ? TRACKER_STAGES.indexOf(existing.stage) : -1;
    if (existing && existingIndex >= requestedIndex) return existing;
    const record = { stage: TRACKER_STAGES[requestedIndex], updatedAt: new Date().toISOString() };
    state.tracker.set(tradeId, record);
    persistTracker();
    return record;
  }

  function shouldShowTracker(trade) {
    return trade.owned || Boolean(interactionState(trade)) || state.tracker.has(trade.id);
  }

  function trackerMarkup(trade) {
    if (!shouldShowTracker(trade)) return '';
    const record = state.tracker.get(trade.id) || { stage: trade.status === 'completed' ? 'completed' : 'prepared' };
    const currentIndex = Math.max(0, TRACKER_STAGES.indexOf(record.stage));
    const nextStage = TRACKER_STAGES[currentIndex + 1];
    const currentMeta = trackerStageMeta(record.stage);
    const nextMeta = nextStage ? trackerStageMeta(nextStage) : null;
    return `
      <section class="trade-tracker" id="trade-tracker-${escapeHtml(trade.id)}" aria-labelledby="trade-tracker-title-${escapeHtml(trade.id)}" data-trade-tracker tabindex="-1">
        <div class="trade-tracker-head">
          <span><strong id="trade-tracker-title-${escapeHtml(trade.id)}">${escapeHtml(l('trading.tracker.title', 'Suivi local de l’échange'))}</strong><small>${escapeHtml(l('trading.tracker.copy', 'Ces étapes restent uniquement sur cet appareil.'))}</small></span>
          <span class="trade-tracker-current" aria-live="polite">${escapeHtml(l('trading.tracker.current', `Étape actuelle : ${l(currentMeta.key, currentMeta.fallback)}`, { stage: l(currentMeta.key, currentMeta.fallback) }))}</span>
        </div>
        <ol class="trade-tracker-steps">
          ${TRACKER_STAGES.map((stage, index) => {
            const meta = trackerStageMeta(stage);
            const stateClass = index < currentIndex ? ' is-complete' : index === currentIndex ? ' is-current' : '';
            return `<li class="${stateClass}"${index === currentIndex ? ' aria-current="step"' : ''}><span><i class="fa-solid ${meta.icon}" aria-hidden="true"></i></span><strong>${escapeHtml(l(meta.key, meta.fallback))}</strong></li>`;
          }).join('')}
        </ol>
        <div class="trade-tracker-actions">
          <button class="btn btn-secondary" type="button" data-advance-tracker="${escapeHtml(trade.id)}" ${nextStage ? '' : 'disabled'}><i class="fa-solid ${nextStage ? 'fa-arrow-right' : 'fa-check'}" aria-hidden="true"></i> ${escapeHtml(nextMeta
            ? l('trading.tracker.advance', `Passer à : ${l(nextMeta.key, nextMeta.fallback)}`, { stage: l(nextMeta.key, nextMeta.fallback) })
            : l('trading.tracker.finished', 'Suivi terminé'))}</button>
        </div>
      </section>`;
  }

  function filteredTrades(includeBlocked = false) {
    const query = state.search.trim().toLocaleLowerCase('fr');
    let result = state.trades.filter((trade) => {
      if (!includeBlocked && state.blocked.has(trade.id)) return false;
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
          : `${trade.username} ${offeredNames} ${wantedNames} ${displayTradeNote(trade)}`;
      return haystack.toLocaleLowerCase('fr').includes(query);
    });

    result = [...result].sort((a, b) => {
      if (state.sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt) || a.id.localeCompare(b.id);
      if (state.sort === 'response-desc') return b.responseCount - a.responseCount || new Date(b.createdAt) - new Date(a.createdAt);
      if (state.sort === 'value-desc') return linesValue(b.offered, b.mode) - linesValue(a.offered, a.mode) || new Date(b.createdAt) - new Date(a.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt) || a.id.localeCompare(b.id);
    });

    return result;
  }

  function tradeCard(trade) {
    const mode = modeCopy(trade.mode);
    const status = tradeStatusMeta(trade.status);
    const saved = state.saved.has(trade.id);
    const responses = trade.responseCount;
    const primaryAction = primaryTradeAction(trade);
    const headingId = `trade-title-${trade.id}`;
    return `
      <article class="trade-card${trade.owned ? ' is-owned' : ''}" data-trade-card="${escapeHtml(trade.id)}" aria-labelledby="${escapeHtml(headingId)}">
        <header class="trade-card-head">
          <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(trade.username))}</span>
          <div class="trade-card-user"><h3 id="${escapeHtml(headingId)}">${escapeHtml(trade.username)}</h3><small title="${escapeHtml(fullDate(trade.createdAt))}">${escapeHtml(formatRelative(trade.createdAt))}</small></div>
          <span class="trade-card-head-meta">
            <span class="trade-card-format"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.label}</span>
            <span class="trade-status${status.className}"><i class="fa-solid fa-circle" aria-hidden="true"></i>${escapeHtml(l(status.key, status.fallback))}</span>
          </span>
          <button class="trade-save-button${saved ? ' active' : ''}" type="button" data-save-trade="${escapeHtml(trade.id)}" aria-label="${escapeHtml(saved
            ? l('trading.saved.removeAria', `Retirer l'offre de ${trade.username} des sauvegardées`, { username: trade.username })
            : l('trading.saved.addAria', `Ajouter l'offre de ${trade.username} aux sauvegardées`, { username: trade.username }))}" aria-pressed="${saved}">
            <i class="fa-${saved ? 'solid' : 'regular'} fa-bookmark" aria-hidden="true"></i>
          </button>
        </header>
        ${trustMarkup(trade)}
        <div class="trade-card-exchange">
          ${sideMarkup(trade.offered, trade.mode, 'give')}
          <div class="trade-card-swap" aria-hidden="true"><span><i class="fa-solid fa-arrow-right-arrow-left"></i></span></div>
          ${sideMarkup(trade.wanted, trade.mode, 'want')}
        </div>
        ${displayTradeNote(trade) ? `<p class="trade-card-note"><i class="fa-regular fa-message" aria-hidden="true"></i>${escapeHtml(displayTradeNote(trade))}</p>` : ''}
        ${interactionMarkup(trade)}
        <footer class="trade-card-footer">
          <span class="trade-response-count"><i class="fa-regular fa-comments" aria-hidden="true"></i>${escapeHtml(responses === 1
            ? l('trading.responseCount.one', '1 contre-offre', { count: responses })
            : l('trading.responseCount.many', `${responses} contre-offres`, { count: responses }))}</span>
          <a class="btn btn-secondary trade-calculator-link trade-calculator-link-compact" href="${escapeHtml(calculatorUrlForTrade(trade))}" aria-label="${escapeHtml(calculatorAriaLabel(trade))}" title="${escapeHtml(calculatorAriaLabel(trade))}"><i class="fa-solid fa-calculator" aria-hidden="true"></i></a>
          <button class="btn btn-secondary trade-share-button" type="button" data-share-trade="${escapeHtml(trade.id)}" aria-label="${l('trading.share', "Partager l’offre")} ${escapeHtml(trade.username)}"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${l('trading.shareShort', 'Partager')}</button>
          <button class="btn btn-primary trade-primary-action" type="button" data-view-trade="${escapeHtml(trade.id)}" data-trade-intent="${primaryAction.intent}" aria-haspopup="dialog" aria-controls="trade-detail-modal">${escapeHtml(l(primaryAction.key, primaryAction.fallback))} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        </footer>
      </article>`;
  }

  function updateCounts(filteredCount) {
    const visibleTrades = state.trades.filter((trade) => !state.blocked.has(trade.id));
    const mine = visibleTrades.filter((trade) => trade.owned).length;
    byId('all-trades-count').textContent = visibleTrades.length;
    byId('my-trades-count').textContent = mine;
    byId('saved-trades-count').textContent = visibleTrades.filter((trade) => state.saved.has(trade.id)).length;
    byId('open-trades-stat').textContent = state.stats.open;
    byId('counteroffers-stat').textContent = state.stats.responses;
    byId('trade-results-count').textContent = filteredCount === 1
      ? l('trading.results.one', '1 offre communautaire affichée', { count: filteredCount })
      : l('trading.results.many', `${filteredCount} offres communautaires affichées`, { count: filteredCount });
  }

  function hasActiveFilters() {
    return Boolean(state.search) || state.side !== 'both' || state.mode !== 'all' || state.status !== 'open' || state.sort !== 'newest' || state.view !== 'all';
  }

  function updateValueSortAvailability() {
    const option = $('#trade-sort option[value="value-desc"]');
    if (!option) return;
    const mixedUnits = state.mode === 'all';
    option.disabled = mixedUnits;
    option.textContent = mixedUnits
      ? l('trading.sort.chooseFormat', 'Valeur (choisir un format)')
      : l('trading.sort.value', 'Plus grande valeur');
    if (mixedUnits && state.sort === 'value-desc') {
      state.sort = 'newest';
      byId('trade-sort').value = 'newest';
    }
  }

  function renderApiStatus() {
    const banner = byId('trade-api-status');
    if (!banner) return;
    const title = $('[data-api-status-title]', banner);
    const copy = $('[data-api-status-copy]', banner);
    const retry = byId('retry-trading-load');
    const icon = $('.local-demo-icon i', banner);
    banner.dataset.status = state.apiStatus;
    if (state.apiStatus === 'loading') {
      title.textContent = l('trading.api.loadingTitle', 'Chargement des offres communautaires');
      copy.textContent = l('trading.api.loadingCopy', 'Itemsouq récupère les dernières offres et réponses.');
      icon.className = 'fa-solid fa-spinner fa-spin';
      retry.hidden = true;
    } else if (state.apiStatus === 'error') {
      title.textContent = l('trading.api.errorTitle', 'Le marché Trading est indisponible');
      copy.textContent = state.apiError || l('trading.api.errorCopy', 'Réessaie dans quelques instants. Aucun faux contenu ne sera affiché.');
      icon.className = 'fa-solid fa-triangle-exclamation';
      retry.hidden = false;
    } else {
      title.textContent = l('trading.api.liveTitle', 'Marché communautaire partagé');
      copy.textContent = l('trading.api.liveCopy', 'Les offres et réponses sont enregistrées par Itemsouq et visibles par les autres joueurs.');
      icon.className = 'fa-solid fa-cloud';
      retry.hidden = true;
    }
  }

  async function loadTrades() {
    state.apiStatus = 'loading';
    state.apiError = '';
    renderApiStatus();
    renderTrades();
    try {
      const data = await apiRequest(`${API.trades}?status=all&limit=100`);
      const source = Array.isArray(data?.trades) ? data.trades : [];
      state.trades = sanitizeTrades(source);
      state.stats = {
        open: clampInteger(data?.stats?.open, 0, 999999999, state.trades.filter((trade) => trade.status === 'open').length),
        responses: clampInteger(data?.stats?.responses, 0, 999999999, state.trades.reduce((total, trade) => total + trade.responseCount, 0))
      };
      state.responsesLoaded = new Set(source
        .filter((trade) => Array.isArray(trade?.responses))
        .map((trade) => trade.id));
      state.responseErrors.clear();
      state.apiStatus = 'ready';
    } catch (error) {
      state.trades = [];
      state.stats = { open: 0, responses: 0 };
      state.apiStatus = 'error';
      state.apiError = error.message;
    }
    renderApiStatus();
    renderTrades();
  }

  function replaceTrade(rawTrade) {
    const clean = sanitizeTrade(rawTrade);
    if (!clean) throw new TradingApiError(l('trading.api.invalidResponse', 'Le serveur a renvoyé une offre invalide.'), 0, 'invalid_response');
    const index = state.trades.findIndex((trade) => trade.id === clean.id);
    if (index === -1) state.trades.unshift(clean);
    else state.trades[index] = clean;
    return clean;
  }

  async function loadTradeResponses(tradeId, { quiet = false } = {}) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return false;
    if (!quiet) {
      state.responseErrors.delete(tradeId);
      renderTradeDetail();
    }
    try {
      const data = await apiRequest(`${API.responses}?tradeId=${encodeURIComponent(tradeId)}`);
      const source = Array.isArray(data?.responses) ? data.responses : [];
      trade.responses = source.map((response) => sanitizeResponse(response, trade.mode)).filter(Boolean);
      trade.responseCount = clampInteger(data?.responseCount, trade.responses.length, 999999, trade.responses.length);
      if (data?.trade && typeof data.trade === 'object') {
        data.trade.responses = trade.responses;
        data.trade.responseCount = trade.responseCount;
        replaceTrade(data.trade);
      }
      state.responsesLoaded.add(tradeId);
      state.responseErrors.delete(tradeId);
      return true;
    } catch (error) {
      state.responseErrors.set(tradeId, error.message);
      return false;
    } finally {
      if (state.activeTradeId === tradeId) renderTradeDetail();
      renderTrades();
    }
  }

  function renderTrades() {
    if (state.apiStatus === 'loading' && !state.trades.length) {
      byId('trade-grid').innerHTML = '';
      byId('trade-grid').hidden = true;
      byId('trade-empty').hidden = false;
      byId('trade-empty-title').textContent = l('trading.api.loadingTitle', 'Chargement des offres communautaires');
      byId('trade-empty-copy').textContent = l('trading.api.loadingCopy', 'Itemsouq récupère les dernières offres et réponses.');
      byId('trade-empty-action').hidden = true;
      updateCounts(0);
      return;
    }
    if (state.apiStatus === 'error' && !state.trades.length) {
      byId('trade-grid').innerHTML = '';
      byId('trade-grid').hidden = true;
      byId('trade-empty').hidden = false;
      byId('trade-empty-title').textContent = l('trading.api.errorTitle', 'Le marché Trading est indisponible');
      byId('trade-empty-copy').textContent = state.apiError || l('trading.api.errorCopy', 'Réessaie dans quelques instants.');
      byId('trade-empty-action').hidden = false;
      byId('trade-empty-action').textContent = l('trading.api.retry', 'Réessayer');
      byId('trade-empty-action').dataset.emptyMode = 'retry';
      updateCounts(0);
      return;
    }
    byId('trade-empty-action').hidden = false;
    byId('trade-empty-title').textContent = l('trading.emptyTitle', 'Aucune offre dans cette vue');
    const result = filteredTrades();
    byId('trade-grid').innerHTML = result.map(tradeCard).join('');
    byId('trade-grid').hidden = !result.length;
    byId('trade-empty').hidden = Boolean(result.length);
    byId('clear-trade-filters').hidden = !hasActiveFilters();
    updateCounts(result.length);

    if (!result.length) {
      const emptyCopy = byId('trade-empty-copy');
      const emptyAction = byId('trade-empty-action');
      const blockedMatches = state.blocked.size
        ? filteredTrades(true).filter((trade) => state.blocked.has(trade.id))
        : [];
      if (blockedMatches.length) {
        emptyCopy.textContent = l('trading.empty.blocked', 'Toutes les offres de cette vue sont masquées sur cet appareil.');
        emptyAction.textContent = l('trading.moderation.restoreAll', 'Réafficher les offres masquées');
        emptyAction.dataset.emptyMode = 'unblock-all';
      } else if (state.view === 'mine') {
        emptyCopy.textContent = l('trading.empty.mine', 'Tu n’as encore publié aucune offre sur cet appareil.');
        emptyAction.textContent = l('trading.create', 'Publier une offre');
        emptyAction.dataset.emptyMode = 'create';
      } else if (state.view === 'saved') {
        emptyCopy.textContent = l('trading.empty.saved', 'Sauvegarde une offre avec l’icône marque-page pour la retrouver ici.');
        emptyAction.textContent = l('trading.viewAll', 'Voir toutes les offres');
        emptyAction.dataset.emptyMode = 'reset';
      } else {
        emptyCopy.textContent = l('trading.empty.filtered', 'Essaie une autre recherche ou réinitialise les filtres.');
        emptyAction.textContent = l('trading.clearFilters', 'Réinitialiser les filtres');
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

  function applyCalculatorHandoff() {
    const query = new URLSearchParams(window.location.search);
    const requestedMode = query.get('mode');
    const requestedSearch = String(query.get('q') || '').trim().slice(0, 60);
    let applied = false;

    if (['physical', 'permanent'].includes(requestedMode)) {
      state.mode = requestedMode;
      byId('trade-mode-filter').value = requestedMode;
      applied = true;
    }
    if (requestedSearch) {
      state.search = requestedSearch;
      byId('trade-search').value = requestedSearch;
      applied = true;
    }
    return applied;
  }

  function pickerSelection(kind) {
    if (kind === 'counter') return state.counter;
    return state.create[kind];
  }

  function pickerMode(kind) {
    if (kind === 'counter') {
      return state.trades.find((trade) => trade.id === state.activeTradeId)?.mode || 'physical';
    }
    return byId('trade-mode')?.value === 'permanent' ? 'permanent' : 'physical';
  }

  function slotHelperCopy(mode) {
    return mode === 'permanent'
      ? l('trading.selectSlotsPermanent', 'Ajoute jusqu’à 4 fruits permanents différents · un exemplaire chacun')
      : l('trading.selectSlots', 'Ajoute jusqu’à 4 fruits au total · doublons inclus');
  }

  function updateCreateSlotHelpers() {
    const mode = pickerMode('offered');
    $$('[data-trade-slot-helper]').forEach((helper) => {
      helper.textContent = slotHelperCopy(mode);
    });
  }

  function pickerOpposite(kind) {
    if (kind === 'offered') return state.create.wanted;
    if (kind === 'wanted') return state.create.offered;
    const activeTrade = state.trades.find((trade) => trade.id === state.activeTradeId);
    return new Set(activeTrade?.offered.map((line) => line.fruitId) || []);
  }

  function pickerContainer(kind) {
    return byId(kind === 'counter' ? 'counter-picker' : `${kind}-picker`);
  }

  function renderSelected(kind) {
    const container = byId(kind === 'counter' ? 'counter-selected' : `${kind}-selected`);
    if (!container) return;
    const selected = pickerSelection(kind);
    const mode = pickerMode(kind);
    const usedSlots = selectionSlots(selected);
    const selectedMarkup = [...selected.entries()].map(([fruitId, quantity]) => {
      const fruit = fruitById.get(fruitId);
      if (!fruit) return '';
      const quantityControl = mode === 'permanent'
        ? `<span class="selected-fruit-fixed" aria-label="${escapeHtml(l('trading.quantityAria', `Quantité ${quantity}`, { count: quantity }))}"><i class="fa-solid fa-infinity" aria-hidden="true"></i><b>${quantity}</b></span>`
        : `<span class="selected-fruit-stepper" role="group" aria-label="${escapeHtml(l('aria.fruitQuantity', `Quantité de ${fruit.name}`, { fruit: fruit.name }))}">
            <button type="button" data-picker-quantity="${kind}" data-fruit-id="${escapeHtml(fruitId)}" data-quantity-delta="-1" aria-label="${escapeHtml(l('aria.decreaseFruit', `Diminuer ${fruit.name}`, { fruit: fruit.name }))}" ${quantity <= 1 ? 'disabled' : ''}><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
            <b aria-label="${escapeHtml(l('trading.quantityAria', `Quantité ${quantity}`, { count: quantity }))}">${quantity}</b>
            <button type="button" data-picker-quantity="${kind}" data-fruit-id="${escapeHtml(fruitId)}" data-quantity-delta="1" aria-label="${escapeHtml(l('aria.increaseFruit', `Augmenter ${fruit.name}`, { fruit: fruit.name }))}" ${usedSlots >= MAX_FRUITS ? 'disabled' : ''}><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
          </span>`;
      return `<div class="selected-fruit-chip">
        <img src="${fruitImagePath(fruit)}" alt="" width="512" height="512">
        <span class="selected-fruit-name"><strong>${escapeHtml(fruit.name)}</strong><small>×${quantity}</small></span>
        ${quantityControl}
        <button class="selected-fruit-remove" type="button" data-picker-remove="${kind}" data-fruit-id="${escapeHtml(fruitId)}" aria-label="${escapeHtml(l('trading.quantity.removeAria', `Retirer complètement ${fruit.name}`, { fruit: fruit.name }))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>`;
    }).join('');
    const emptyMarkup = selected.size
      ? ''
      : `<span class="selected-fruits-empty">${escapeHtml(l('trading.noneSelected', 'Aucun fruit sélectionné'))}</span>`;
    const isFull = usedSlots >= MAX_FRUITS;
    const slotsCopy = isFull
      ? l('trading.slots.full', `${usedSlots}/${MAX_FRUITS} places · limite atteinte`, { used: usedSlots, limit: MAX_FRUITS })
      : l('trading.slots.count', `${usedSlots}/${MAX_FRUITS} places utilisées`, { used: usedSlots, limit: MAX_FRUITS });
    const slotsAria = isFull
      ? l('trading.slots.fullAria', `${usedSlots} places utilisées sur ${MAX_FRUITS}. Limite atteinte.`, { used: usedSlots, limit: MAX_FRUITS })
      : l('trading.slots.countAria', `${usedSlots} places utilisées sur ${MAX_FRUITS}`, { used: usedSlots, limit: MAX_FRUITS });
    container.innerHTML = `${selectedMarkup}${emptyMarkup}<span class="selected-slot-count${isFull ? ' is-full' : ''}" aria-label="${escapeHtml(slotsAria)}"><i class="fa-solid fa-layer-group" aria-hidden="true"></i>${escapeHtml(slotsCopy)}</span>`;
  }

  function renderPicker(kind, query = '') {
    const container = pickerContainer(kind);
    if (!container) return;
    const selected = pickerSelection(kind);
    const opposite = pickerOpposite(kind);
    const usedSlots = selectionSlots(selected);
    const normalized = query.trim().toLocaleLowerCase('fr');
    const matches = fruits.filter((fruit) => !normalized || fruit.name.toLocaleLowerCase('fr').includes(normalized));

    if (!matches.length) {
      container.innerHTML = `<div class="picker-no-results"><p>${escapeHtml(l('trading.noneFound', 'Aucun fruit trouvé.'))}</p><button type="button" data-clear-picker-search="${kind}">${escapeHtml(l('trading.picker.clearSearch', 'Effacer la recherche'))}</button></div>`;
      renderSelected(kind);
      return;
    }

    let hasTabStop = false;
    container.innerHTML = matches.map((fruit) => {
      const fruitId = slugify(fruit.name);
      const isSelected = selected.has(fruitId);
      const quantity = selected.get(fruitId) || 0;
      const unavailableReason = !isSelected && opposite.has(fruitId)
        ? 'opposite'
        : !isSelected && usedSlots >= MAX_FRUITS
          ? 'full'
          : '';
      const isUnavailable = Boolean(unavailableReason);
      const isTabStop = !hasTabStop;
      if (isTabStop) hasTabStop = true;
      const pickerLabel = isSelected
        ? l('trading.picker.removeAria', `Retirer ${fruit.name}`, { fruit: fruit.name })
        : unavailableReason === 'opposite'
          ? l('trading.picker.oppositeAria', `${fruit.name} indisponible : déjà sélectionné de l’autre côté`, { fruit: fruit.name })
          : unavailableReason === 'full'
            ? l('trading.picker.fullAria', `${fruit.name} indisponible : les ${MAX_FRUITS} places sont utilisées`, { fruit: fruit.name, limit: MAX_FRUITS })
            : l('trading.picker.addAria', `Ajouter ${fruit.name}`, { fruit: fruit.name });
      return `
        <button class="fruit-picker-option${isSelected ? ' is-selected' : ''}" type="button" data-picker="${kind}" data-fruit-id="${escapeHtml(fruitId)}" aria-pressed="${isSelected}" aria-label="${escapeHtml(pickerLabel)}"${isUnavailable ? ` title="${escapeHtml(pickerLabel)}" aria-disabled="true"` : ''} tabindex="${isTabStop ? '0' : '-1'}">
          <img src="${fruitImagePath(fruit)}" alt="" width="512" height="512" loading="lazy" decoding="async">
          <span><strong>${escapeHtml(fruit.name)}</strong><small>${escapeHtml(rarityLabel(fruit.rarity))}</small></span>
          <span class="picker-check" aria-hidden="true"><i class="fa-solid fa-check"></i>${quantity > 1 ? `<b>×${quantity}</b>` : ''}</span>
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
      const opposite = pickerOpposite(kind);
      if (opposite.has(fruitId)) {
        showToast(l('trading.validation.sameFruitBothSides', 'Un même fruit ne peut pas être des deux côtés.'), 'warning');
        return;
      }
      if (selectionSlots(selected) >= MAX_FRUITS) {
        showToast(l('trading.validation.slotLimit', `Maximum ${MAX_FRUITS} fruits au total par côté, doublons inclus.`, { limit: MAX_FRUITS }), 'warning');
        return;
      }
      selected.set(fruitId, 1);
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
    const fruit = fruitById.get(fruitId);
    const usedSlots = selectionSlots(selected);
    if (fruit) {
      announce(selected.has(fruitId)
        ? l('trading.feedback.quantityChanged', `Quantité de ${fruit.name} : ${selected.get(fruitId)}. ${usedSlots}/${MAX_FRUITS} places utilisées.`, {
          fruit: fruit.name, count: selected.get(fruitId), used: usedSlots, limit: MAX_FRUITS
        })
        : l('trading.feedback.fruitRemoved', `${fruit.name} retiré. ${usedSlots}/${MAX_FRUITS} places utilisées.`, {
          fruit: fruit.name, used: usedSlots, limit: MAX_FRUITS
        }));
    }
  }

  function changePickerQuantity(kind, fruitId, delta, focusControl = 'quantity') {
    const selected = pickerSelection(kind);
    const fruit = fruitById.get(fruitId);
    if (!fruit || !selected.has(fruitId)) return;
    const mode = pickerMode(kind);
    const current = selected.get(fruitId) || 1;
    if (delta > 0) {
      if (mode === 'permanent') {
        showToast(l('trading.feedback.permanentNormalized', 'Les fruits permanents sont limités à un exemplaire chacun.'), 'info');
        return;
      }
      if (selectionSlots(selected) >= MAX_FRUITS) {
        showToast(l('trading.validation.slotLimit', `Maximum ${MAX_FRUITS} fruits au total par côté, doublons inclus.`, { limit: MAX_FRUITS }), 'warning');
        return;
      }
      selected.set(fruitId, current + 1);
    } else if (current > 1) {
      selected.set(fruitId, current - 1);
    } else {
      return;
    }

    if (kind === 'counter') {
      renderPicker('counter', $('[data-picker-search="counter"]')?.value || '');
      clearPickerError('counter');
    } else {
      renderAllPickers();
      clearPickerError(kind);
    }
    const usedSlots = selectionSlots(selected);
    announce(l('trading.feedback.quantityChanged', `Quantité de ${fruit.name} : ${selected.get(fruitId)}. ${usedSlots}/${MAX_FRUITS} places utilisées.`, {
      fruit: fruit.name, count: selected.get(fruitId), used: usedSlots, limit: MAX_FRUITS
    }));
    window.requestAnimationFrame(() => {
      const selector = `[data-picker-${focusControl}="${kind}"][data-fruit-id="${fruitId}"][data-quantity-delta="${delta > 0 ? '1' : '-1'}"]`;
      const target = document.querySelector(`${selector}:not([disabled])`)
        || document.querySelector(`[data-picker-quantity="${kind}"][data-fruit-id="${fruitId}"]:not([disabled])`)
        || document.querySelector(`[data-picker-remove="${kind}"][data-fruit-id="${fruitId}"]`);
      target?.focus();
    });
  }

  function removePickerFruit(kind, fruitId) {
    const selected = pickerSelection(kind);
    const fruit = fruitById.get(fruitId);
    if (!fruit || !selected.delete(fruitId)) return;
    if (kind === 'counter') {
      renderPicker('counter', $('[data-picker-search="counter"]')?.value || '');
      clearPickerError('counter');
    } else {
      renderAllPickers();
      clearPickerError(kind);
    }
    const usedSlots = selectionSlots(selected);
    announce(l('trading.feedback.fruitRemoved', `${fruit.name} retiré. ${usedSlots}/${MAX_FRUITS} places utilisées.`, {
      fruit: fruit.name, used: usedSlots, limit: MAX_FRUITS
    }));
    window.requestAnimationFrame(() => {
      const container = pickerContainer(kind);
      const options = $$('[data-picker]', container);
      const target = document.querySelector(`[data-picker="${kind}"][data-fruit-id="${fruitId}"]`)
        || options[0];
      if (target) {
        options.forEach((option) => { option.tabIndex = -1; });
        target.tabIndex = 0;
        target.focus();
      }
    });
  }

  function updateCreateValuePreview() {
    const mode = byId('trade-mode')?.value === 'permanent' ? 'permanent' : 'physical';
    const offered = selectionToLines(state.create.offered, mode);
    const wanted = selectionToLines(state.create.wanted, mode);
    const offeredValue = linesValue(offered, mode);
    const wantedValue = linesValue(wanted, mode);
    const largest = Math.max(offeredValue, wantedValue);
    const gap = largest ? Math.round(Math.abs(offeredValue - wantedValue) / largest * 100) : 0;
    byId('create-value-preview').innerHTML = `
      <span>${escapeHtml(l('trading.giveYou', 'Tu proposes'))}<strong>${formatValue(offeredValue, mode)}</strong></span>
      <b class="trade-value-gap"><i class="fa-solid fa-chart-simple" aria-hidden="true"></i>${escapeHtml(offeredValue && wantedValue
        ? l('trading.wikiGap', `Écart wiki ${gap}%`, { gap })
        : l('trading.addBothSides', 'Ajoute les deux côtés'))}</b>
      <span>${escapeHtml(l('trading.wantYou', 'Tu recherches'))}<strong>${formatValue(wantedValue, mode)}</strong></span>`;
  }

  function handleCreateModeChange() {
    const mode = byId('trade-mode')?.value === 'permanent' ? 'permanent' : 'physical';
    let normalized = false;
    if (mode === 'permanent') {
      [state.create.offered, state.create.wanted].forEach((selection) => {
        selection.forEach((quantity, fruitId) => {
          if (quantity > 1) {
            selection.set(fruitId, 1);
            normalized = true;
          }
        });
      });
    }
    updateCreateSlotHelpers();
    renderAllPickers();
    if (normalized) {
      showToast(l('trading.feedback.permanentNormalized', 'Les fruits permanents sont limités à un exemplaire chacun.'), 'info');
    }
  }

  function setPageInert(inert) {
    ['.announcement', '.site-header', 'main', '.site-footer', '.mobile-bottom-nav'].forEach((selector) => {
      const element = $(selector);
      if (element) element.inert = inert;
    });
  }

  function openModal(modal, trigger) {
    if (!modal) return;
    if (activeModal && activeModal !== modal) closeModal(activeModal, false);
    returnFocus = trigger || document.activeElement;
    activeModal = modal;
    if (modal.id === 'create-trade-modal') $$('[data-open-create]').forEach((item) => item.setAttribute('aria-expanded', 'true'));
    modal.hidden = false;
    document.body.classList.add('overlay-open');
    setPageInert(true);
  }

  function closeModal(modal, restoreFocus = true) {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    activeModal = null;
    if (modal.id === 'create-trade-modal') $$('[data-open-create]').forEach((item) => item.setAttribute('aria-expanded', 'false'));
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
        if (focusTarget) {
          focusTarget.focus({ preventScroll: true });
          if (document.activeElement !== focusTarget) {
            window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 0);
          }
        }
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
    updateCreateSlotHelpers();
    renderAllPickers();
  }

  function createDraftSnapshot() {
    const mode = byId('trade-mode').value === 'permanent' ? 'permanent' : 'physical';
    return {
      username: byId('trade-username').value.slice(0, 20),
      mode,
      offered: selectionToLines(state.create.offered, mode),
      wanted: selectionToLines(state.create.wanted, mode),
      note: byId('trade-note').value.slice(0, 180),
      savedAt: new Date().toISOString()
    };
  }

  function updateDraftPanel() {
    const panel = byId('trade-draft-panel');
    if (!panel) return;
    const title = byId('trade-draft-title');
    const status = byId('trade-draft-status');
    const restore = $('[data-restore-draft]', panel);
    const clear = $('[data-clear-draft]', panel);
    panel.classList.toggle('has-draft', Boolean(createDraft));
    restore.disabled = !createDraft;
    clear.hidden = !createDraft;
    if (!createDraft) {
      title.textContent = l('trading.draft.title', 'Brouillon local');
      status.textContent = l('trading.draft.none', 'Aucun brouillon enregistré sur cet appareil.');
      return;
    }
    title.textContent = l('trading.draft.ready', 'Brouillon prêt à restaurer');
    const fruitCount = lineSlots(createDraft.offered) + lineSlots(createDraft.wanted);
    const selectedCopy = fruitCount === 1
      ? l('trading.draft.fruit.one', '1 fruit sélectionné', { count: fruitCount })
      : l('trading.draft.fruit.many', `${fruitCount} fruits sélectionnés`, { count: fruitCount });
    status.textContent = l('trading.draft.savedStatus', `Enregistré ${formatRelative(createDraft.savedAt)} · ${selectedCopy}`, {
      time: formatRelative(createDraft.savedAt), count: fruitCount, fruits: selectedCopy
    });
  }

  function saveCreateDraft() {
    const draft = sanitizeDraft(createDraftSnapshot());
    if (!draft) {
      showToast(l('trading.draft.emptyWarning', 'Ajoute un pseudo, un fruit ou un message avant de sauvegarder.'), 'warning');
      return;
    }
    if (!safeJsonWrite(STORAGE.draft, draft)) return;
    createDraft = draft;
    updateDraftPanel();
    showToast(l('trading.draft.savedToast', 'Brouillon sauvegardé sur cet appareil.'));
    announce(l('trading.draft.savedAnnouncement', 'Brouillon de l’offre sauvegardé localement.'));
  }

  function removeCreateDraft(showFeedback = true) {
    try {
      localStorage.removeItem(STORAGE.draft);
    } catch (error) {
      if (showFeedback) showToast(l('trading.draft.deleteFailed', 'Impossible de supprimer le brouillon local.'), 'warning');
      return false;
    }
    createDraft = null;
    updateDraftPanel();
    if (showFeedback) {
      showToast(l('trading.draft.deletedToast', 'Brouillon supprimé de cet appareil.'));
      announce(l('trading.draft.deletedAnnouncement', 'Brouillon local supprimé.'));
    }
    return true;
  }

  function restoreCreateDraft() {
    if (!createDraft) {
      showToast(l('trading.draft.noneToRestore', 'Aucun brouillon à restaurer.'), 'warning');
      return;
    }
    byId('trade-username').value = createDraft.username;
    byId('trade-mode').value = createDraft.mode;
    byId('trade-note').value = createDraft.note;
    state.create.offered = selectionFromLines(createDraft.offered, createDraft.mode);
    state.create.wanted = selectionFromLines(createDraft.wanted, createDraft.mode);
    $$('[data-picker-search="offered"], [data-picker-search="wanted"]').forEach((input) => { input.value = ''; });
    clearCreateErrors();
    byId('trade-note-count').textContent = String(createDraft.note.length);
    updateCreateSlotHelpers();
    renderAllPickers();
    showToast(l('trading.draft.restoredToast', 'Brouillon restauré. Tu peux continuer ton offre.'));
    announce(l('trading.draft.restoredAnnouncement', 'Brouillon restauré dans le formulaire.'));
    window.requestAnimationFrame(() => byId('trade-username').focus());
  }

  function openCreate(trigger) {
    clearCreateErrors();
    updateDraftPanel();
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

  function setFormBusy(form, busy, message) {
    const button = form?.querySelector('[type="submit"]');
    if (!button) return;
    if (busy) {
      button.dataset.idleHtml = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = `<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> <span>${escapeHtml(message)}</span>`;
    } else {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (button.dataset.idleHtml) {
        button.innerHTML = button.dataset.idleHtml;
        delete button.dataset.idleHtml;
      }
    }
  }

  function validateCreateForm() {
    clearCreateErrors();
    const username = byId('trade-username').value.trim();
    const errors = [];
    const messages = [];
    if (!USERNAME_PATTERN.test(username)) {
      const message = l('trading.validation.username', 'Utilise 3 à 20 lettres, chiffres ou underscores.');
      setCreateError('username', message);
      errors.push(byId('trade-username'));
      messages.push(message);
    }
    if (!state.create.offered.size) {
      const message = l('trading.validation.offeredRequired', 'Sélectionne au moins un fruit à proposer.');
      setCreateError('offered', message);
      errors.push($('[data-picker-fieldset="offered"]'));
      messages.push(message);
    }
    if (!state.create.wanted.size) {
      const message = l('trading.validation.wantedRequired', 'Sélectionne au moins un fruit à rechercher.');
      setCreateError('wanted', message);
      errors.push($('[data-picker-fieldset="wanted"]'));
      messages.push(message);
    }
    const overlaps = [...state.create.offered.keys()].some((fruitId) => state.create.wanted.has(fruitId));
    if (overlaps) {
      const message = l('trading.validation.sameFruitBothSides', 'Le même fruit ne peut pas être proposé et recherché.');
      setCreateError('wanted', message);
      errors.push($('[data-picker-fieldset="wanted"]'));
      messages.push(message);
    }
    errors[0]?.focus();
    if (messages.length) announceError(messages[0]);
    return !errors.length;
  }

  async function submitCreate(event) {
    event.preventDefault();
    if (isSubmitting || !validateCreateForm()) return;
    if (!storageIsWritable()) {
      showToast(l('trading.api.storageRequired', "Le stockage du navigateur doit être disponible pour conserver ta clé de gestion."), 'warning');
      return;
    }
    isSubmitting = true;
    setFormBusy(event.currentTarget, true, l('trading.feedback.publishing', 'Publication…'));
    const mode = byId('trade-mode').value === 'permanent' ? 'permanent' : 'physical';
    const payload = {
      username: byId('trade-username').value.trim(),
      mode,
      offered: apiLines(selectionToLines(state.create.offered, mode)),
      wanted: apiLines(selectionToLines(state.create.wanted, mode)),
      note: byId('trade-note').value.trim().slice(0, 180)
    };
    const fingerprint = JSON.stringify(payload);
    if (!pendingCreateSubmission || pendingCreateSubmission.fingerprint !== fingerprint) {
      pendingCreateSubmission = { requestId: requestId(), fingerprint };
    }
    payload.requestId = pendingCreateSubmission.requestId;
    try {
      const data = await apiRequest(API.trades, { method: 'POST', body: payload });
      const token = typeof data?.manageToken === 'string' ? data.manageToken : '';
      const rawTrade = data?.trade;
      if (!rawTrade || !/^[A-Za-z0-9_-]{32,180}$/.test(token)) {
        throw new TradingApiError(l('trading.api.invalidResponse', 'Le serveur a renvoyé une réponse invalide.'), 0, 'invalid_response');
      }
      state.ownerTokens.set(rawTrade.id, token);
      if (!persistOwnerTokens()) {
        state.ownerTokens.delete(rawTrade.id);
        throw new TradingApiError(l('trading.api.tokenSaveFailed', "L'offre a été publiée, mais sa clé de gestion n'a pas pu être sauvegardée. Contacte Itemsouq avant de fermer cette page."), 0, 'token_storage_failed');
      }
      const trade = replaceTrade(rawTrade);
      trade.owned = true;
      trade.responses = [];
      trade.responseCount = 0;
      state.stats.open += 1;
      state.responsesLoaded.add(trade.id);
      pendingCreateSubmission = null;
      state.tracker.set(trade.id, { stage: 'prepared', updatedAt: new Date().toISOString() });
      persistTracker();
      removeCreateDraft(false);
      resetFilters();
      resetCreateForm();
      closeCreate();
      showToast(l('trading.feedback.published', 'Ton offre est maintenant visible par la communauté.'));
      announce(l('trading.feedback.publishedAnnouncement', 'Offre communautaire publiée.'));
    } catch (error) {
      showToast(error.message || l('trading.api.requestFailed', "Impossible de publier l'offre."), 'warning');
    } finally {
      isSubmitting = false;
      setFormBusy(byId('create-trade-form'), false, '');
    }
  }

  function canRespondToTrade(trade) {
    const stateName = interactionState(trade);
    return !trade.owned
      && trade.status === 'open'
      && !['offer_sent', 'accepted', 'completed'].includes(stateName);
  }

  function responseOutcomeMeta(outcome) {
    if (outcome === 'accepted') return { key: 'trading.response.accepted', fallback: 'Acceptée', icon: 'fa-check' };
    if (outcome === 'declined') return { key: 'trading.response.declined', fallback: 'Refusée', icon: 'fa-xmark' };
    if (outcome === 'withdrawn') return { key: 'trading.response.withdrawn', fallback: 'Retirée', icon: 'fa-ban' };
    return { key: 'trading.response.pending', fallback: 'À examiner', icon: 'fa-clock' };
  }

  function detailMarkup(trade) {
    const mode = modeCopy(trade.mode);
    const status = tradeStatusMeta(trade.status);
    const history = trade.responses.slice(-5).reverse();
    const responsesReady = state.responsesLoaded.has(trade.id);
    const responseError = state.responseErrors.get(trade.id);
    const responseMarkup = responseError
      ? `<div class="counter-empty is-error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><p>${escapeHtml(responseError)}</p><button class="btn btn-secondary" type="button" data-retry-responses>${escapeHtml(l('trading.api.retry', 'Réessayer'))}</button></div>`
      : !responsesReady
        ? `<div class="counter-empty"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><p>${escapeHtml(l('trading.response.loading', 'Chargement des réponses…'))}</p></div>`
        : history.length
      ? `<div class="counter-list">${history.map((response) => {
          const outcome = responseOutcomeMeta(response.outcome);
          const fruitNames = response.offered.map((line) => {
            const name = fruitById.get(line.fruitId)?.name || '';
            return line.quantity > 1 ? `${line.quantity}× ${name}` : name;
          }).join(' + ');
          const actions = trade.owned && trade.status === 'open' && response.outcome === 'pending'
            ? `<div class="counter-item-actions">
                <button type="button" data-response-action="accepted" data-response-id="${escapeHtml(response.id)}" aria-label="${escapeHtml(l('trading.response.acceptAria', `Accepter l’offre de ${response.username}`, { username: response.username }))}"><i class="fa-solid fa-check" aria-hidden="true"></i><span>${escapeHtml(l('trading.response.accept', 'Accepter'))}</span></button>
                <button type="button" data-response-action="declined" data-response-id="${escapeHtml(response.id)}" aria-label="${escapeHtml(l('trading.response.declineAria', `Refuser l’offre de ${response.username}`, { username: response.username }))}"><i class="fa-solid fa-xmark" aria-hidden="true"></i><span>${escapeHtml(l('trading.response.decline', 'Refuser'))}</span></button>
              </div>`
            : '';
          return `
          <div class="counter-item" data-response-item="${escapeHtml(response.id)}">
            <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(response.username))}</span>
            <span class="counter-item-copy"><strong>${escapeHtml(l('trading.response.proposes', `${response.username} propose ${fruitNames}`, {
              username: response.username,
              fruits: fruitNames
            }))}</strong><small>${displayResponseNote(response) ? escapeHtml(displayResponseNote(response)) : escapeHtml(l('trading.response.noMessage', 'Sans message supplémentaire'))}</small></span>
            <time datetime="${escapeHtml(response.createdAt)}">${escapeHtml(formatRelative(response.createdAt))}</time>
            <span class="counter-outcome outcome-${response.outcome}" tabindex="-1"><i class="fa-solid ${outcome.icon}" aria-hidden="true"></i>${escapeHtml(l(outcome.key, outcome.fallback))}</span>
            ${actions}
          </div>`;
        }).join('')}</div>`
      : `<div class="counter-empty"><i class="fa-regular fa-comments" aria-hidden="true"></i><p>${escapeHtml(l('trading.response.none', 'Aucune contre-offre pour le moment.'))}</p></div>`;

    return `
      <div class="detail-owner">
        <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(trade.username))}</span>
        <span class="detail-owner-copy"><strong>${escapeHtml(trade.username)}</strong><small>${escapeHtml(l('trading.detail.publishedAt', `Publiée ${formatRelative(trade.createdAt)} · ${fullDate(trade.createdAt)}`, {
          relative: formatRelative(trade.createdAt), date: fullDate(trade.createdAt)
        }))}</small></span>
        <span class="detail-owner-badges">
          <span class="trade-card-format"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.label}</span>
          <span class="trade-status${status.className}"><i class="fa-solid fa-circle" aria-hidden="true"></i>${escapeHtml(l(status.key, status.fallback))}</span>
        </span>
      </div>
      ${trustMarkup(trade, true)}
      ${interactionMarkup(trade, true)}
      <div class="detail-exchange">
        ${sideMarkup(trade.offered, trade.mode, 'give')}
        <div class="trade-card-swap" aria-hidden="true"><span><i class="fa-solid fa-arrow-right-arrow-left"></i></span></div>
        ${sideMarkup(trade.wanted, trade.mode, 'want')}
      </div>
      ${displayTradeNote(trade) ? `<p class="detail-note"><i class="fa-regular fa-message" aria-hidden="true"></i> ${escapeHtml(displayTradeNote(trade))}</p>` : ''}
      <p class="detail-value-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>${escapeHtml(l('trading.detail.wikiNotice', `Les valeurs ${mode.unit} viennent du wiki Blox Fruits sur Fandom. Elles servent uniquement de repère et ne déterminent pas la demande réelle entre joueurs.`, { unit: mode.unit }))}</span></p>
      ${canRespondToTrade(trade) ? counterFormMarkup(trade) : ''}
      ${trackerMarkup(trade)}
      <section class="counteroffer-history" aria-labelledby="counter-history-title">
        <h3 id="counter-history-title">${escapeHtml(l('trading.response.title', `Réponses communautaires (${trade.responseCount})`, { count: trade.responseCount }))}</h3>
        <p>${escapeHtml(l('trading.response.sharedCopy', "Les réponses sont partagées avec la communauté. Le propriétaire de l'offre peut les accepter ou les refuser."))}</p>
        ${responseMarkup}
      </section>`;
  }

  function counterFormMarkup(trade) {
    const isCounter = interactionState(trade) === 'counter_received';
    const title = isCounter
      ? l('trading.counter.counterTitle', 'Faire une contre-offre')
      : l('trading.counter.makeTitle', 'Faire une offre');
    const submit = isCounter
      ? l('trading.counter.sendCounter', 'Envoyer la contre-offre')
      : l('trading.counter.sendOffer', 'Envoyer l’offre');
    return `
      <section class="counteroffer-panel" aria-labelledby="counteroffer-title" tabindex="-1">
        <h3 id="counteroffer-title">${escapeHtml(title)}</h3>
        <p>${escapeHtml(l('trading.counter.copy', "Indique ton pseudo et ce que tu proposes. Ta réponse sera visible par la communauté."))}</p>
        <form class="counteroffer-form" id="counteroffer-form" novalidate>
          <div class="form-grid">
            <div class="field-group">
              <label for="counter-username">${escapeHtml(l('trading.counter.usernameLabel', 'Ton pseudo Roblox'))}</label>
              <input id="counter-username" type="text" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" placeholder="Ex. AtlasGaming" autocomplete="off" aria-describedby="counter-username-error">
              <span class="field-error" id="counter-username-error" aria-live="polite"></span>
            </div>
            <div class="field-group trade-note-field">
              <label for="counter-note">${escapeHtml(l('trading.messageLabel', 'Message'))} <span>${escapeHtml(l('trading.optional', 'facultatif'))}</span></label>
              <input id="counter-note" type="text" maxlength="160" placeholder="${escapeHtml(l('trading.counter.notePlaceholder', 'Ex. Disponible maintenant'))}" autocomplete="off">
            </div>
          </div>
          <fieldset class="trade-fruit-fieldset counter-fruit-fieldset" data-picker-fieldset="counter" aria-describedby="counter-error" tabindex="-1">
            <legend><span class="picker-step give"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></span><span><strong>${escapeHtml(l('trading.counter.give', 'Tu proposes en échange'))}</strong><small>${escapeHtml(slotHelperCopy(trade.mode))}</small></span></legend>
            <label class="picker-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="sr-only">${escapeHtml(l('trading.counter.searchLabel', 'Rechercher un fruit pour la contre-offre'))}</span><input type="search" placeholder="${escapeHtml(l('trading.pickerSearchPlaceholder', 'Rechercher…'))}" data-picker-search="counter" autocomplete="off"></label>
            <div class="selected-fruits" id="counter-selected"><span>${escapeHtml(l('trading.noneSelected', 'Aucun fruit sélectionné'))}</span></div>
            <div class="fruit-picker-list" id="counter-picker" role="group" aria-label="${escapeHtml(l('trading.counter.groupAria', 'Fruits de la contre-offre'))}"></div>
            <span class="field-error" id="counter-error" aria-live="polite"></span>
          </fieldset>
          <div class="counter-form-actions">
            <button class="btn btn-secondary trade-share-button" type="button" data-share-active><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${escapeHtml(l('trading.counter.share', "Partager l'annonce"))}</button>
            <button class="btn btn-primary" type="submit"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> ${escapeHtml(submit)}</button>
          </div>
        </form>
      </section>`;
  }

  function detailFooter(trade) {
    const canComplete = ['open', 'matched'].includes(trade.status);
    const ownerActions = trade.owned
      ? `<div class="detail-owner-actions">
          <button class="btn btn-secondary" type="button" data-owner-status="${canComplete ? 'completed' : 'open'}"><i class="fa-solid ${canComplete ? 'fa-circle-check' : 'fa-rotate-left'}" aria-hidden="true"></i>${canComplete ? escapeHtml(l('trading.owner.complete', 'Marquer terminée')) : escapeHtml(l('trading.owner.reopen', 'Rouvrir'))}</button>
          <button class="btn btn-danger-soft" type="button" data-delete-trade><i class="fa-solid fa-trash-can" aria-hidden="true"></i> ${escapeHtml(l('trading.owner.delete', 'Supprimer'))}</button>
        </div>`
      : '';
    const action = primaryTradeAction(trade);
    const primary = canRespondToTrade(trade)
      ? `<button class="btn btn-primary detail-primary-action" type="button" data-focus-counter><i class="fa-solid fa-paper-plane" aria-hidden="true"></i>${escapeHtml(l(action.key, action.fallback))}</button>`
      : shouldShowTracker(trade)
        ? `<button class="btn btn-primary detail-primary-action" type="button" data-focus-tracker><i class="fa-solid fa-route" aria-hidden="true"></i>${escapeHtml(l('trading.tracker.view', 'Voir le suivi'))}</button>`
        : '';
    return `${ownerActions}
      <a class="btn btn-secondary trade-calculator-link detail-calculator-link" href="${escapeHtml(calculatorUrlForTrade(trade))}" aria-label="${escapeHtml(calculatorAriaLabel(trade))}"><i class="fa-solid fa-calculator" aria-hidden="true"></i><span>${escapeHtml(l('trading.calculateTrade', 'Calculer cet échange'))}</span></a>
      <button class="btn btn-secondary trade-share-button" type="button" data-share-active><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> ${escapeHtml(l('trading.shareShort', 'Partager'))}</button>
      <button class="btn btn-secondary detail-close-action" type="button" data-close-detail>${escapeHtml(l('trading.close', 'Fermer'))}</button>
      ${primary}`;
  }

  function renderTradeDetail() {
    const trade = state.trades.find((item) => item.id === state.activeTradeId);
    if (!trade) {
      closeDetail();
      return;
    }
    byId('trade-detail-title').textContent = l('trading.detail.offerBy', `Offre de ${trade.username}`, { username: trade.username });
    byId('trade-detail-body').innerHTML = detailMarkup(trade);
    byId('trade-detail-foot').innerHTML = detailFooter(trade);
    if (canRespondToTrade(trade)) renderPicker('counter');
  }

  async function openTradeDetail(tradeId, trigger, intent = 'view') {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    state.activeTradeId = tradeId;
    state.counter.clear();
    if (['offer', 'counter', 'manage', 'track'].includes(intent)) ensureTracker(tradeId, trade.status === 'completed' ? 'completed' : 'prepared');
    renderTradeDetail();
    const modal = byId('trade-detail-modal');
    $('.trade-detail-card', modal).scrollTop = 0;
    openModal(modal, trigger);
    window.requestAnimationFrame(() => byId('trade-detail-title').focus());
    if (!state.responsesLoaded.has(tradeId)) {
      await loadTradeResponses(tradeId);
    }
  }

  function closeDetail(restoreFocus = true) {
    closeModal(byId('trade-detail-modal'), restoreFocus);
    state.activeTradeId = null;
    state.counter.clear();
  }

  async function submitCounteroffer(event) {
    if (!event.target.matches('#counteroffer-form')) return;
    event.preventDefault();
    if (isSubmitting) return;
    const trade = state.trades.find((item) => item.id === state.activeTradeId);
    if (!trade || trade.status !== 'open' || trade.owned) {
      showToast(l('trading.feedback.cannotRespond', 'Cette offre ne peut plus recevoir de réponse.'), 'warning');
      return;
    }
    if (!storageIsWritable()) {
      showToast(l('trading.api.storageRequired', "Le stockage du navigateur doit être disponible pour conserver ta clé de réponse."), 'warning');
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
      usernameError.textContent = l('trading.validation.username', 'Utilise 3 à 20 lettres, chiffres ou underscores.');
      announceError(usernameError.textContent);
      usernameInput.focus();
      return;
    }
    if (!state.counter.size) {
      fieldset.classList.add('has-error');
      fieldset.setAttribute('aria-invalid', 'true');
      pickerError.textContent = l('trading.validation.counterRequired', 'Sélectionne au moins un fruit pour ta contre-offre.');
      announceError(pickerError.textContent);
      fieldset.focus();
      return;
    }
    const sourceIds = new Set(trade.offered.map((line) => line.fruitId));
    if ([...state.counter.keys()].some((fruitId) => sourceIds.has(fruitId))) {
      fieldset.classList.add('has-error');
      fieldset.setAttribute('aria-invalid', 'true');
      pickerError.textContent = l('trading.validation.counterDifferent', 'Choisis un fruit différent de ceux proposés par ce joueur.');
      announceError(pickerError.textContent);
      fieldset.focus();
      return;
    }

    isSubmitting = true;
    const wasCounteroffer = interactionState(trade) === 'counter_received';
    setFormBusy(event.target, true, l('trading.feedback.sendingOffer', 'Envoi…'));
    try {
      const payload = {
        username,
        offered: apiLines(selectionToLines(state.counter, trade.mode)),
        note: byId('counter-note').value.trim().slice(0, 160)
      };
      const fingerprint = JSON.stringify({ tradeId: trade.id, ...payload });
      if (!pendingResponseSubmission || pendingResponseSubmission.fingerprint !== fingerprint) {
        pendingResponseSubmission = { requestId: requestId(), fingerprint };
      }
      payload.requestId = pendingResponseSubmission.requestId;
      const data = await apiRequest(`${API.responses}?tradeId=${encodeURIComponent(trade.id)}`, {
        method: 'POST',
        body: payload
      });
      const response = sanitizeResponse(data?.response, trade.mode);
      const token = typeof data?.manageToken === 'string' ? data.manageToken : '';
      if (!response || !/^[A-Za-z0-9_-]{32,180}$/.test(token)) {
        throw new TradingApiError(l('trading.api.invalidResponse', 'Le serveur a renvoyé une réponse invalide.'), 0, 'invalid_response');
      }
      state.responseTokens.set(response.id, { tradeId: trade.id, token });
      if (!persistResponseTokens()) {
        showToast(l('trading.api.tokenSaveFailed', "La réponse a été publiée, mais sa clé de gestion n'a pas pu être sauvegardée."), 'warning');
      }
      const existingIndex = trade.responses.findIndex((item) => item.id === response.id);
      if (existingIndex === -1) trade.responses.push(response);
      else trade.responses[existingIndex] = response;
      if (existingIndex === -1) state.stats.responses += 1;
      trade.responseCount = clampInteger(data?.responseCount, trade.responses.length, 999999, trade.responses.length);
      state.responsesLoaded.add(trade.id);
      pendingResponseSubmission = null;
      ensureTracker(trade.id, 'player_contacted');
      state.counter.clear();
      await loadTradeResponses(trade.id, { quiet: true });
      renderTrades();
      renderTradeDetail();
      window.requestAnimationFrame(() => $('[data-interaction-state]', byId('trade-detail-modal'))?.focus());
      showToast(wasCounteroffer
        ? l('trading.feedback.counterSent', 'Ta contre-offre est visible par la communauté.')
        : l('trading.feedback.offerSent', 'Ta réponse est visible par la communauté.'));
      announce(wasCounteroffer
        ? l('trading.feedback.counterSentAnnouncement', 'Contre-offre communautaire publiée.')
        : l('trading.feedback.offerSentAnnouncement', 'Réponse communautaire publiée.'));
    } catch (error) {
      showToast(error.message || l('trading.api.requestFailed', "Impossible d'envoyer la réponse."), 'warning');
    } finally {
      isSubmitting = false;
      setFormBusy(event.target, false, '');
    }
  }

  function toggleSaved(tradeId) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    if (state.saved.has(tradeId)) {
      state.saved.delete(tradeId);
      showToast(l('trading.feedback.unsaved', 'Offre retirée des sauvegardées.'));
    } else {
      state.saved.add(tradeId);
      showToast(l('trading.feedback.saved', 'Offre sauvegardée sur cet appareil.'));
    }
    persistSaved();
    renderTrades();
    window.requestAnimationFrame(() => document.querySelector(`[data-save-trade="${tradeId}"]`)?.focus());
  }

  function focusAfterRender(selector, fallbackSelector) {
    window.requestAnimationFrame(() => {
      const modalTarget = activeModal ? $(selector, activeModal) : null;
      const candidate = modalTarget || $(selector);
      const target = candidate && !candidate.disabled ? candidate : fallbackSelector ? $(fallbackSelector) : null;
      target?.focus({ preventScroll: true });
    });
  }

  function updateBlockUndo() {
    const undo = byId('trade-block-undo');
    if (!undo) return;
    const trade = state.trades.find((item) => item.id === state.lastBlockedTradeId && state.blocked.has(item.id));
    undo.hidden = !trade;
    if (trade) {
      byId('trade-block-undo-message').textContent = l('trading.moderation.blockedNamed', `Le profil de ${trade.username} est masqué sur cet appareil.`, { username: trade.username });
    }
  }

  function blockTrade(tradeId) {
    const trade = state.trades.find((item) => item.id === tradeId && !item.owned);
    if (!trade || state.blocked.has(tradeId)) return;
    state.trades
      .filter((item) => !item.owned && item.username === trade.username)
      .forEach((item) => state.blocked.add(item.id));
    state.lastBlockedTradeId = tradeId;
    persistModeration();
    if (state.activeTradeId === tradeId) closeDetail(false);
    renderTrades();
    updateBlockUndo();
    focusAfterRender('[data-undo-block]', '#trade-empty-action');
    const message = l('trading.feedback.blocked', `Profil de ${trade.username} masqué. Tu peux annuler cette action.`, { username: trade.username });
    showToast(message, 'info');
    announce(message);
  }

  function undoBlock() {
    const tradeId = state.lastBlockedTradeId;
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!tradeId || !state.blocked.has(tradeId)) return;
    state.trades
      .filter((item) => item.username === trade?.username)
      .forEach((item) => state.blocked.delete(item.id));
    state.lastBlockedTradeId = null;
    persistModeration();
    renderTrades();
    updateBlockUndo();
    focusAfterRender(`[data-view-trade="${tradeId}"]`, '#trade-empty-action');
    const message = l('trading.feedback.unblocked', `Le profil de ${trade?.username || ''} est de nouveau visible.`, { username: trade?.username || '' });
    showToast(message);
    announce(message);
  }

  function unblockAll() {
    if (!state.blocked.size) return;
    state.blocked.clear();
    state.lastBlockedTradeId = null;
    persistModeration();
    renderTrades();
    updateBlockUndo();
    focusAfterRender('[data-view-trade]', '#trade-empty-action');
    const message = l('trading.feedback.unblockedAll', 'Toutes les offres masquées sont de nouveau visibles.');
    showToast(message);
    announce(message);
  }

  function handleCapabilityFailure(error, tradeId) {
    if (!(error instanceof TradingApiError) || ![403, 404].includes(error.status)) return false;
    state.ownerTokens.delete(tradeId);
    persistOwnerTokens();
    const trade = state.trades.find((item) => item.id === tradeId);
    if (trade) trade.owned = false;
    showToast(l('trading.api.managementLost', "La clé de gestion de cette offre n'est plus valide sur cet appareil."), 'warning');
    renderTrades();
    if (state.activeTradeId === tradeId) renderTradeDetail();
    return true;
  }

  async function updateResponseOutcome(responseId, outcome) {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned && item.status === 'open');
    const response = trade?.responses.find((item) => item.id === responseId);
    if (!trade || !response || !['accepted', 'declined'].includes(outcome)) return;
    const token = state.ownerTokens.get(trade.id) || '';
    if (!token || isSubmitting) return;
    isSubmitting = true;
    try {
      const data = await apiRequest(API.responseAction, {
        method: 'POST',
        token,
        body: { tradeId: trade.id, responseId, action: 'set_outcome', outcome, version: trade.version }
      });
      const updated = replaceTrade(data?.trade);
      if (outcome === 'accepted') state.stats.open = Math.max(0, state.stats.open - 1);
      updated.responses = Array.isArray(data?.responses)
        ? data.responses.map((item) => sanitizeResponse(item, updated.mode)).filter(Boolean)
        : [];
      updated.responseCount = updated.responses.length;
      state.responsesLoaded.add(updated.id);
      if (outcome === 'accepted') ensureTracker(updated.id, 'exchange_pending');
      renderTrades();
      renderTradeDetail();
      focusAfterRender(`[data-response-item="${responseId}"] .counter-outcome`, '[data-interaction-state]');
      const message = outcome === 'accepted'
        ? l('trading.feedback.responseAccepted', "Contre-offre acceptée. Vérifie maintenant l'échange dans le jeu.")
        : l('trading.feedback.responseDeclined', 'Contre-offre refusée.');
      showToast(message);
      announce(message);
    } catch (error) {
      if (!handleCapabilityFailure(error, trade.id)) showToast(error.message, 'warning');
    } finally {
      isSubmitting = false;
    }
  }

  function advanceTracker(tradeId) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    const current = ensureTracker(tradeId, 'prepared');
    const currentIndex = TRACKER_STAGES.indexOf(current.stage);
    const nextStage = TRACKER_STAGES[currentIndex + 1];
    if (!nextStage) return;
    state.tracker.set(tradeId, { stage: nextStage, updatedAt: new Date().toISOString() });
    persistTracker();
    renderTrades();
    if (state.activeTradeId === tradeId) renderTradeDetail();
    focusAfterRender(`[data-advance-tracker="${tradeId}"]`, `[data-trade-tracker]`);
    const meta = trackerStageMeta(nextStage);
    const message = l('trading.feedback.trackerAdvanced', `Suivi mis à jour : ${l(meta.key, meta.fallback)}.`, { stage: l(meta.key, meta.fallback) });
    showToast(message);
    announce(message);
  }

  async function updateOwnedStatus(status) {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned);
    if (!trade || !['open', 'completed'].includes(status)) return;
    const token = state.ownerTokens.get(trade.id) || '';
    if (!token || isSubmitting) return;
    isSubmitting = true;
    try {
      const wasOpen = trade.status === 'open';
      const data = await apiRequest(API.tradeAction, {
        method: 'POST',
        token,
        body: { tradeId: trade.id, action: 'set_status', status, version: trade.version }
      });
      const updated = replaceTrade(data?.trade);
      const isOpen = updated.status === 'open';
      if (wasOpen && !isOpen) state.stats.open = Math.max(0, state.stats.open - 1);
      else if (!wasOpen && isOpen) state.stats.open += 1;
      if (status === 'completed') state.tracker.set(updated.id, { stage: 'completed', updatedAt: new Date().toISOString() });
      else state.tracker.set(updated.id, { stage: 'prepared', updatedAt: new Date().toISOString() });
      persistTracker();
      await loadTradeResponses(updated.id, { quiet: true });
      renderTrades();
      renderTradeDetail();
      focusAfterRender('[data-owner-status]', '[data-interaction-state]');
      showToast(status === 'completed'
        ? l('trading.feedback.completed', 'Offre marquée comme terminée pour toute la communauté.')
        : l('trading.feedback.reopened', 'Offre rouverte pour toute la communauté.'));
    } catch (error) {
      if (!handleCapabilityFailure(error, trade.id)) showToast(error.message, 'warning');
    } finally {
      isSubmitting = false;
    }
  }

  async function deleteOwnedTrade() {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned);
    if (!trade) return;
    if (!window.confirm(l('trading.confirm.delete', 'Retirer cette offre du marché communautaire ?'))) return;
    const token = state.ownerTokens.get(trade.id) || '';
    if (!token || isSubmitting) return;
    isSubmitting = true;
    try {
      const removedWasOpen = trade.status === 'open';
      const removedResponses = trade.responseCount;
      await apiRequest(API.tradeAction, {
        method: 'POST',
        token,
        body: { tradeId: trade.id, action: 'remove', version: trade.version }
      });
      if (removedWasOpen) state.stats.open = Math.max(0, state.stats.open - 1);
      state.stats.responses = Math.max(0, state.stats.responses - removedResponses);
      state.trades = state.trades.filter((item) => item.id !== trade.id);
      state.saved.delete(trade.id);
      state.blocked.delete(trade.id);
      state.ownerTokens.delete(trade.id);
      state.tracker.delete(trade.id);
      [...state.responseTokens.entries()].forEach(([responseId, record]) => {
        if (record.tradeId === trade.id) state.responseTokens.delete(responseId);
      });
      persistSaved();
      persistModeration();
      persistOwnerTokens();
      persistResponseTokens();
      persistTracker();
      closeDetail();
      renderTrades();
      showToast(l('trading.feedback.deleted', 'Offre retirée du marché communautaire.'));
      announce(l('trading.feedback.deletedAnnouncement', 'Offre retirée.'));
    } catch (error) {
      if (!handleCapabilityFailure(error, trade.id)) showToast(error.message, 'warning');
    } finally {
      isSubmitting = false;
    }
  }

  function tradeShareMessage(trade) {
    const mode = modeCopy(trade.mode);
    const list = (lines) => lines.map((line) => `${line.quantity > 1 ? `${line.quantity}× ` : ''}${fruitById.get(line.fruitId)?.name || ''}`).join(' + ');
    const note = displayTradeNote(trade);
    return [
      l('trading.shareMessage.intro', 'Salam, voici une offre Itemsouq Trading :'),
      '',
      l('trading.shareMessage.player', `Joueur : ${trade.username}`, { username: trade.username }),
      l('trading.shareMessage.format', `Format : ${mode.label}`, { mode: mode.label }),
      l('trading.shareMessage.offered', `Propose : ${list(trade.offered)} (${formatValue(linesValue(trade.offered, trade.mode), trade.mode)})`, {
        fruits: list(trade.offered), value: formatValue(linesValue(trade.offered, trade.mode), trade.mode)
      }),
      l('trading.shareMessage.wanted', `Recherche : ${list(trade.wanted)} (${formatValue(linesValue(trade.wanted, trade.mode), trade.mode)})`, {
        fruits: list(trade.wanted), value: formatValue(linesValue(trade.wanted, trade.mode), trade.mode)
      }),
      note ? l('trading.shareMessage.note', `Message : ${note}`, { note }) : '',
      '',
      l('trading.shareMessage.safety', 'Merci de tout vérifier dans la fenêtre d’échange. Ne partage jamais ton mot de passe, PIN ou OTP.')
    ].filter(Boolean).join('\n');
  }

  async function copyShareText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise((resolve, reject) => {
            window.setTimeout(() => reject(new Error('Clipboard timeout')), 900);
          })
        ]);
        return true;
      } catch (error) {
        // The hidden textarea fallback below also works on older mobile browsers.
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.inset = '0 auto auto -9999px';
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try {
      copied = typeof document.execCommand === 'function' && document.execCommand('copy');
    } catch (error) {
      copied = false;
    }
    textarea.remove();
    return copied;
  }

  function setShareBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    const icon = $('i', button);
    if (icon) icon.className = `fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-share-nodes'}`;
  }

  async function shareTrade(tradeId, trigger) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    const text = tradeShareMessage(trade);
    const shareData = { title: l('trading.shareMessage.title', `Offre Itemsouq de ${trade.username}`, { username: trade.username }), text };
    setShareBusy(trigger, true);
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share(shareData);
          showToast(l('trading.feedback.shareOpened', 'Offre envoyée au menu de partage.'), 'info');
          announce(l('trading.feedback.sharedAnnouncement', 'Offre partagée.'));
          return;
        } catch (error) {
          if (error && error.name === 'AbortError') {
            return;
          }
        }
      }
      const copied = await copyShareText(text);
      if (copied) {
        showToast(l('trading.feedback.copied', 'Offre copiée. Colle-la dans WhatsApp ou ton application préférée.'), 'info');
        announce(l('trading.feedback.copiedAnnouncement', 'Texte de l’offre copié dans le presse-papiers.'));
      } else {
        showToast(l('trading.feedback.shareFailed', 'Impossible d’ouvrir le partage ou de copier le texte.'), 'warning');
      }
    } finally {
      if (trigger?.isConnected) setShareBusy(trigger, false);
    }
  }

  function toggleMobileMenu(restoreFocus = false) {
    const menu = byId('mobile-menu');
    const trigger = $('.mobile-menu-trigger');
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-label', open
      ? l('trading.menu.close', 'Fermer le menu')
      : l('trading.menu.open', 'Ouvrir le menu'));
    $('i', trigger).className = `fa-solid ${open ? 'fa-xmark' : 'fa-bars'}`;
    if (!open && restoreFocus) {
      window.requestAnimationFrame(() => {
        const target = trigger.offsetParent !== null ? trigger : $('.desktop-nav .nav-active');
        target?.focus();
      });
    }
  }

  function applyPageLocale() {
    document.title = l('trading.meta.title', 'Trading communautaire · Itemsouq Fruits');
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', l('trading.meta.description', "Itemsouq Trading — publie et découvre des offres d'échange Blox Fruits au Maroc."));
    }
    if (byId('trade-toast')?.hidden) {
      byId('trade-toast-message').textContent = l('trading.published', 'Offre publiée');
    }
    const shortcut = $('.trade-search-control kbd');
    if (shortcut) {
      const platform = navigator.userAgentData?.platform || navigator.platform || '';
      shortcut.textContent = /Mac|iPhone|iPad/i.test(platform) ? '⌘ K' : 'Ctrl K';
    }

    $$('[data-language-toggle]').forEach((toggle) => {
      const targetKey = language() === 'ary' ? 'language.switchToFrench' : 'language.switchToDarija';
      const fallback = language() === 'ary' ? 'Afficher le site en français' : 'Afficher le site en Darija';
      toggle.setAttribute('aria-label', l(targetKey, fallback));
    });

    const menuTrigger = $('.mobile-menu-trigger');
    if (menuTrigger) {
      menuTrigger.setAttribute('aria-label', menuTrigger.getAttribute('aria-expanded') === 'true'
        ? l('trading.menu.close', 'Fermer le menu')
        : l('trading.menu.open', 'Ouvrir le menu'));
    }

    updateCreateSlotHelpers();

    let localizedStyle = byId('trading-localized-style');
    if (!localizedStyle) {
      localizedStyle = document.createElement('style');
      localizedStyle.id = 'trading-localized-style';
      document.head.append(localizedStyle);
    }
    localizedStyle.textContent = `.trade-card.is-owned::before { content: ${JSON.stringify(l('trading.ownedBadge', 'MON OFFRE'))}; }`;
    updateBlockUndo();
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
    $('[data-save-draft]').addEventListener('click', saveCreateDraft);
    $('[data-restore-draft]').addEventListener('click', restoreCreateDraft);
    $('[data-clear-draft]').addEventListener('click', () => removeCreateDraft(true));
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
      else if (event.currentTarget.dataset.emptyMode === 'unblock-all') unblockAll();
      else if (event.currentTarget.dataset.emptyMode === 'retry') loadTrades();
      else resetFilters();
    });
    byId('retry-trading-load').addEventListener('click', loadTrades);

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
      else if (view) openTradeDetail(view.dataset.viewTrade, view, view.dataset.tradeIntent || 'view');
      else if (share) shareTrade(share.dataset.shareTrade, share);
    });

    document.addEventListener('click', (event) => {
      const quantity = event.target.closest('[data-picker-quantity]');
      const picker = event.target.closest('[data-picker]');
      const remove = event.target.closest('[data-picker-remove]');
      const ownerStatus = event.target.closest('[data-owner-status]');
      const clearPickerSearch = event.target.closest('[data-clear-picker-search]');
      const blockTradeButton = event.target.closest('[data-block-trade]');
      const responseAction = event.target.closest('[data-response-action]');
      const trackerAdvance = event.target.closest('[data-advance-tracker]');
      if (quantity) changePickerQuantity(quantity.dataset.pickerQuantity, quantity.dataset.fruitId, Number(quantity.dataset.quantityDelta));
      else if (picker) togglePickerFruit(picker.dataset.picker, picker.dataset.fruitId);
      else if (remove) removePickerFruit(remove.dataset.pickerRemove, remove.dataset.fruitId);
      else if (ownerStatus) updateOwnedStatus(ownerStatus.dataset.ownerStatus);
      else if (clearPickerSearch) {
        const kind = clearPickerSearch.dataset.clearPickerSearch;
        const input = $(`[data-picker-search="${kind}"]`);
        if (input) {
          input.value = '';
          renderPicker(kind);
          input.focus();
          announce(l('trading.picker.searchCleared', 'Recherche effacée.'));
        }
      }
      else if (blockTradeButton) blockTrade(blockTradeButton.dataset.blockTrade);
      else if (event.target.closest('[data-undo-block]')) undoBlock();
      else if (responseAction) updateResponseOutcome(responseAction.dataset.responseId, responseAction.dataset.responseAction);
      else if (trackerAdvance) advanceTracker(trackerAdvance.dataset.advanceTracker);
      else if (event.target.closest('[data-retry-responses]') && state.activeTradeId) loadTradeResponses(state.activeTradeId);
      else if (event.target.closest('[data-focus-counter]')) {
        const panel = $('.counteroffer-panel', byId('trade-detail-modal'));
        panel?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        window.requestAnimationFrame(() => byId('counter-username')?.focus());
      }
      else if (event.target.closest('[data-focus-tracker]')) {
        const tracker = $('[data-trade-tracker]', byId('trade-detail-modal'));
        tracker?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        window.requestAnimationFrame(() => tracker?.focus());
      }
      else if (event.target.closest('[data-delete-trade]')) deleteOwnedTrade();
      else if (event.target.closest('[data-share-active]') && state.activeTradeId) {
        const shareButton = event.target.closest('[data-share-active]');
        shareTrade(state.activeTradeId, shareButton);
      }
      else if (event.target.closest('[data-close-detail]')) closeDetail();
    });

    $$('[data-picker-search]').forEach((input) => input.addEventListener('input', (event) => {
      renderPicker(event.target.dataset.pickerSearch, event.target.value);
    }));
    byId('trade-detail-body').addEventListener('input', (event) => {
      if (event.target.matches('[data-picker-search="counter"]')) renderPicker('counter', event.target.value);
    });
    byId('trade-mode').addEventListener('change', handleCreateModeChange);
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
        byId('trading-feed').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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

    document.addEventListener('itemsouq:languagechange', () => {
      applyPageLocale();
      renderTrades();
      renderAllPickers();
      updateDraftPanel();
      updateValueSortAvailability();
      if (activeModal?.id === 'trade-detail-modal' && state.activeTradeId) {
        const activeElement = document.activeElement;
        const focusSelector = activeElement?.dataset.advanceTracker
          ? `[data-advance-tracker="${activeElement.dataset.advanceTracker}"]`
          : activeElement?.dataset.ownerStatus
            ? '[data-owner-status]'
            : null;
        renderTradeDetail();
        if (focusSelector) focusAfterRender(focusSelector, '#trade-detail-title');
      }
    });
  }

  function validateDataset() {
    if (fruits.length !== 41) console.warn(`Itemsouq Trading: expected 41 fruits, received ${fruits.length}.`);
  }

  async function init() {
    validateDataset();
    hydrateState();
    const calculatorHandoff = applyCalculatorHandoff();
    attachEvents();
    updateDraftPanel();
    updateValueSortAvailability();
    applyPageLocale();
    renderAllPickers();
    renderTrades();
    await loadTrades();
    if (calculatorHandoff) {
      showToast(l('trading.feedback.calculatorPrepared', 'Offre chargée dans le calculateur.'));
    }
  }

  init().catch((error) => {
    state.apiStatus = 'error';
    state.apiError = error?.message || l('trading.api.unavailable', 'Le service Trading est momentanément indisponible.');
    renderApiStatus();
    renderTrades();
  });
  document.addEventListener('DOMContentLoaded', applyPageLocale, { once: true });
})();
