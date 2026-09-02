/* Itemsouq Trading — static localStorage demo */
(function () {
  'use strict';

  const fruits = Array.isArray(window.ITEMSOUQ_FRUITS) ? window.ITEMSOUQ_FRUITS : [];
  const i18n = window.ITEMSOUQ_I18N;
  const l = (key, fallback, variables) => i18n?.t(key, fallback, variables) ?? fallback;
  const language = () => i18n?.getLanguage?.() || 'fr';
  const STORAGE = {
    trades: 'itemsouq:trading:v3:listings',
    saved: 'itemsouq:trading:v3:saved',
    draft: 'itemsouq:trading:v3:draft',
    tracker: 'itemsouq:trading:v1:tracker',
    reported: 'itemsouq:trading:v1:reported',
    blocked: 'itemsouq:trading:v1:blocked'
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
  const RESPONSE_OUTCOMES = new Set(['pending', 'accepted', 'declined']);
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
      offered: new Set(),
      wanted: new Set()
    },
    counter: new Set(),
    activeTradeId: null,
    tracker: new Map(),
    reported: new Set(),
    blocked: new Set(),
    lastBlockedTradeId: null
  };

  let activeModal = null;
  let returnFocus = null;
  let toastTimer = null;
  let isSubmitting = false;
  let createDraft = null;

  const trustSeed = (username) => [...String(username)].reduce((total, character) => total + character.charCodeAt(0), 0);

  function defaultTrust(username, owned = false) {
    const seed = trustSeed(username);
    const joinedYear = owned ? new Date().getFullYear() : 2021 + (seed % 4);
    const joinedMonth = String((seed % 12) + 1).padStart(2, '0');
    const joinedDay = String((seed % 27) + 1).padStart(2, '0');
    return {
      reputationPercent: owned ? 100 : 94 + (seed % 6),
      completedTrades: owned ? 0 : 12 + (seed % 113),
      responseMinutes: owned ? 30 : 8 + (seed % 43),
      memberSince: owned ? new Date().toISOString().slice(0, 10) : `${joinedYear}-${joinedMonth}-${joinedDay}`
    };
  }

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
        trust: { reputationPercent: 98, completedTrades: 73, responseMinutes: 12, memberSince: '2022-06-18' },
        localInteraction: { responseId: 'counter-demo-1', state: 'counter_received', updatedAt: minutesAgo(3) },
        offered: [{ fruitId: 'dragon', quantity: 1 }],
        wanted: [{ fruitId: 'kitsune', quantity: 1 }, { fruitId: 'dough', quantity: 1 }],
        note: 'Disponible ce soir. Je vérifie tous les fruits dans la fenêtre d’échange.',
        createdAt: minutesAgo(18),
        responses: [
          { id: 'counter-demo-1', username: 'CasaFruit', offered: [{ fruitId: 'kitsune', quantity: 1 }], note: 'Kitsune disponible maintenant.', createdAt: minutesAgo(8), local: true, outcome: 'pending' }
        ]
      },
      {
        id: 'demo-dough-spirit',
        username: 'Aya_Blox',
        mode: 'physical',
        status: 'open',
        owned: false,
        trust: { reputationPercent: 96, completedTrades: 41, responseMinutes: 28, memberSince: '2023-01-04' },
        localInteraction: null,
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
        trust: { reputationPercent: 99, completedTrades: 124, responseMinutes: 9, memberSince: '2021-11-20' },
        localInteraction: null,
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
        trust: { reputationPercent: 94, completedTrades: 19, responseMinutes: 45, memberSince: '2024-02-12' },
        localInteraction: null,
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
        trust: { reputationPercent: 97, completedTrades: 88, responseMinutes: 16, memberSince: '2022-09-03' },
        localInteraction: { responseId: null, state: 'completed', updatedAt: minutesAgo(1310) },
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

  const DEMO_NOTE_KEYS = {
    'demo-dragon-kitsune': 'trading.demo.dragonKitsune.note',
    'demo-dough-spirit': 'trading.demo.doughSpirit.note',
    'demo-buddha-portal': 'trading.demo.buddhaPortal.note',
    'demo-permanent-buddha': 'trading.demo.permanentBuddha.note',
    'demo-tiger-yeti': 'trading.demo.tigerYeti.note'
  };

  const DEMO_RESPONSE_NOTE_KEYS = {
    'counter-demo-1': 'trading.demo.response.kitsuneNow',
    'counter-demo-3': 'trading.demo.response.verifyInGame'
  };

  function displayTradeNote(trade) {
    const key = DEMO_NOTE_KEYS[trade.id];
    return key ? l(key, trade.note) : trade.note;
  }

  function displayResponseNote(response) {
    const key = DEMO_RESPONSE_NOTE_KEYS[response.id];
    return key ? l(key, response.note) : response.note;
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

  function clampInteger(value, minimum, maximum, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
  }

  function sanitizeTrust(input, username, owned) {
    const fallback = defaultTrust(username, owned);
    const source = input && typeof input === 'object' ? input : {};
    const memberDate = new Date(source.memberSince);
    const memberSince = Number.isNaN(memberDate.getTime()) || memberDate.getTime() > Date.now()
      ? fallback.memberSince
      : memberDate.toISOString().slice(0, 10);
    return {
      reputationPercent: clampInteger(source.reputationPercent, 0, 100, fallback.reputationPercent),
      completedTrades: clampInteger(source.completedTrades, 0, 9999, fallback.completedTrades),
      responseMinutes: clampInteger(source.responseMinutes, 1, 1440, fallback.responseMinutes),
      memberSince
    };
  }

  function sanitizeLocalInteraction(input, trade) {
    const seededDemoState = trade.id === 'demo-dragon-kitsune' && trade.responses.length
      ? 'counter_received'
      : null;
    const fallbackState = trade.status === 'completed'
      ? 'completed'
      : trade.owned
        ? trade.responses.length ? 'counter_received' : 'awaiting_response'
        : seededDemoState;
    const source = input && typeof input === 'object' ? input : null;
    const stateName = source && INTERACTION_STATES.has(source.state) ? source.state : fallbackState;
    if (!stateName) return null;
    const responseIds = new Set(trade.responses.map((response) => response.id));
    const responseId = source && typeof source.responseId === 'string' && responseIds.has(source.responseId)
      ? source.responseId
      : seededDemoState === 'counter_received' ? trade.responses[0].id : null;
    const updatedDate = new Date(source?.updatedAt || trade.createdAt);
    return {
      responseId,
      state: trade.status === 'completed' ? 'completed' : stateName,
      updatedAt: Number.isNaN(updatedDate.getTime()) ? trade.createdAt : updatedDate.toISOString()
    };
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
      local: Boolean(response.local),
      outcome: RESPONSE_OUTCOMES.has(response.outcome) ? response.outcome : 'pending'
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

    const normalized = {
      id,
      username,
      mode,
      status,
      owned: Boolean(trade.owned),
      offered,
      wanted,
      note: typeof trade.note === 'string' ? trade.note.trim().slice(0, 180) : '',
      createdAt: date.toISOString(),
      responses,
      trust: sanitizeTrust(trade.trust, username, Boolean(trade.owned))
    };
    normalized.localInteraction = sanitizeLocalInteraction(trade.localInteraction, normalized);
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
    const offered = sanitizeLines(Array.isArray(input.offered) ? input.offered.map((fruitId) => ({ fruitId, quantity: 1 })) : [], mode)
      .map((line) => line.fruitId);
    const offeredIds = new Set(offered);
    const wanted = sanitizeLines(Array.isArray(input.wanted) ? input.wanted.map((fruitId) => ({ fruitId, quantity: 1 })) : [], mode)
      .map((line) => line.fruitId)
      .filter((fruitId) => !offeredIds.has(fruitId));
    const username = typeof input.username === 'string' ? input.username.slice(0, 20) : '';
    const note = typeof input.note === 'string' ? input.note.slice(0, 180) : '';
    const savedAt = new Date(input.savedAt);
    if (Number.isNaN(savedAt.getTime())) return null;
    if (!username.trim() && !note.trim() && !offered.length && !wanted.length) return null;
    return { username, mode, offered, wanted, note, savedAt: savedAt.toISOString() };
  }

  function sanitizeIdSet(input, validIds) {
    return new Set(Array.isArray(input)
      ? input.filter((id) => typeof id === 'string' && validIds.has(id)).slice(0, 100)
      : []);
  }

  function sanitizeTracker(input, validIds) {
    const result = new Map();
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
    for (const [tradeId, record] of Object.entries(input)) {
      if (!validIds.has(tradeId) || !record || typeof record !== 'object') continue;
      const stage = TRACKER_STAGES.includes(record.stage) ? record.stage : '';
      const updatedAt = new Date(record.updatedAt);
      if (!stage || Number.isNaN(updatedAt.getTime())) continue;
      result.set(tradeId, { stage, updatedAt: updatedAt.toISOString() });
      if (result.size === 100) break;
    }
    return result;
  }

  function hydrateState() {
    const storedTrades = safeJsonRead(STORAGE.trades, null);
    const cleanTrades = sanitizeTrades(storedTrades);
    const fallbackTrades = sanitizeTrades(demoTrades());
    state.trades = Array.isArray(storedTrades)
      ? storedTrades.length && !cleanTrades.length ? fallbackTrades : cleanTrades
      : fallbackTrades;

    const storedSaved = safeJsonRead(STORAGE.saved, []);
    const validIds = new Set(state.trades.map((trade) => trade.id));
    state.saved = sanitizeIdSet(storedSaved, validIds);
    state.reported = sanitizeIdSet(safeJsonRead(STORAGE.reported, []), validIds);
    state.blocked = sanitizeIdSet(safeJsonRead(STORAGE.blocked, []), validIds);
    state.tracker = sanitizeTracker(safeJsonRead(STORAGE.tracker, {}), validIds);
    state.trades.forEach((trade) => {
      const tracker = state.tracker.get(trade.id);
      if (trade.status === 'completed') {
        trade.localInteraction = { responseId: trade.localInteraction?.responseId || null, state: 'completed', updatedAt: trade.localInteraction?.updatedAt || trade.createdAt };
        state.tracker.set(trade.id, { stage: 'completed', updatedAt: tracker?.updatedAt || trade.createdAt });
      } else if (tracker?.stage === 'completed') {
        trade.localInteraction = { responseId: trade.localInteraction?.responseId || null, state: 'completed', updatedAt: tracker.updatedAt };
        if (trade.owned) trade.status = 'completed';
      }
    });

    createDraft = sanitizeDraft(safeJsonRead(STORAGE.draft, null));

    persistTrades();
    persistSaved();
    persistModeration();
    persistTracker();
  }

  function persistTrades() {
    safeJsonWrite(STORAGE.trades, state.trades);
  }

  function persistSaved() {
    safeJsonWrite(STORAGE.saved, [...state.saved]);
  }

  function persistModeration() {
    safeJsonWrite(STORAGE.reported, [...state.reported]);
    safeJsonWrite(STORAGE.blocked, [...state.blocked]);
  }

  function persistTracker() {
    safeJsonWrite(STORAGE.tracker, Object.fromEntries(state.tracker));
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

  function accountAge(memberSince) {
    const joined = new Date(memberSince);
    const months = Math.max(0, Math.floor((Date.now() - joined.getTime()) / (30.4375 * 24 * 60 * 60 * 1000)));
    if (months < 1) return l('trading.trust.ageNew', 'Nouveau');
    if (months < 12) return l('trading.trust.ageMonths', `${months} mois`, { count: months });
    const years = Math.floor(months / 12);
    return l('trading.trust.ageYears', `${years} an${years > 1 ? 's' : ''}`, { count: years });
  }

  function interactionState(trade) {
    if (trade.status === 'completed') return 'completed';
    if (trade.localInteraction && INTERACTION_STATES.has(trade.localInteraction.state)) return trade.localInteraction.state;
    if (trade.owned) return trade.responses.length ? 'counter_received' : 'awaiting_response';
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
    const trust = trade.trust || defaultTrust(trade.username, trade.owned);
    const reported = state.reported.has(trade.id);
    const profileLabel = l('trading.trust.profileAria', `Profil de confiance de ${trade.username}`, { username: trade.username });
    const moderation = trade.owned ? '' : `
      <div class="trade-trust-actions">
        <button type="button" class="trade-trust-action report${reported ? ' active' : ''}" data-report-trade="${escapeHtml(trade.id)}" aria-pressed="${reported}" aria-label="${escapeHtml(reported
          ? l('trading.moderation.reportedAria', `Retirer le signalement local de ${trade.username}`, { username: trade.username })
          : l('trading.moderation.reportAria', `Signaler le profil de ${trade.username}`, { username: trade.username }))}"><i class="fa-${reported ? 'solid' : 'regular'} fa-flag" aria-hidden="true"></i><span>${escapeHtml(reported
            ? l('trading.moderation.reported', 'Signalé')
            : l('trading.moderation.report', 'Signaler'))}</span></button>
        <button type="button" class="trade-trust-action block" data-block-trade="${escapeHtml(trade.id)}" aria-label="${escapeHtml(l('trading.moderation.blockAria', `Masquer le profil de ${trade.username} sur cet appareil`, { username: trade.username }))}"><i class="fa-solid fa-user-slash" aria-hidden="true"></i><span>${escapeHtml(l('trading.moderation.block', 'Masquer'))}</span></button>
      </div>`;
    return `
      <section class="trade-trust${detail ? ' is-detail' : ''}" aria-label="${escapeHtml(profileLabel)}">
        <div class="trade-trust-metrics">
          <span class="trade-trust-metric"><i class="fa-solid fa-star" aria-hidden="true"></i><span><strong>${trust.reputationPercent}%</strong><small>${escapeHtml(l('trading.trust.reputation', 'Réputation'))}</small></span></span>
          <span class="trade-trust-metric"><i class="fa-solid fa-handshake" aria-hidden="true"></i><span><strong>${formatNumber(trust.completedTrades)}</strong><small>${escapeHtml(l('trading.trust.completedTrades', 'Échanges réussis'))}</small></span></span>
          <span class="trade-trust-metric"><i class="fa-solid fa-bolt" aria-hidden="true"></i><span><strong>${escapeHtml(l('trading.trust.responseValue', `≈ ${trust.responseMinutes} min`, { count: trust.responseMinutes }))}</strong><small>${escapeHtml(l('trading.trust.responseTime', 'Temps de réponse'))}</small></span></span>
          <span class="trade-trust-metric"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i><span><strong>${escapeHtml(accountAge(trust.memberSince))}</strong><small>${escapeHtml(l('trading.trust.accountAge', 'Ancienneté'))}</small></span></span>
        </div>
        ${moderation}
      </section>`;
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
    return trade.owned || Boolean(trade.localInteraction) || state.tracker.has(trade.id);
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
    const primaryAction = primaryTradeAction(trade);
    const headingId = `trade-title-${trade.id}`;
    return `
      <article class="trade-card${trade.owned ? ' is-owned' : ''}" data-trade-card="${escapeHtml(trade.id)}" aria-labelledby="${escapeHtml(headingId)}">
        <header class="trade-card-head">
          <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(trade.username))}</span>
          <div class="trade-card-user"><h3 id="${escapeHtml(headingId)}">${escapeHtml(trade.username)}</h3><small title="${escapeHtml(fullDate(trade.createdAt))}">${escapeHtml(formatRelative(trade.createdAt))}</small></div>
          <span class="trade-card-head-meta">
            <span class="trade-card-format"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.label}</span>
            <span class="trade-status${trade.status === 'completed' ? ' completed' : ''}"><i class="fa-solid fa-circle" aria-hidden="true"></i>${trade.status === 'completed' ? l('trading.status.completed', 'Terminée') : l('trading.status.open', 'Ouverte')}</span>
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
    const open = visibleTrades.filter((trade) => trade.status === 'open').length;
    const counteroffers = visibleTrades.reduce((total, trade) => total + trade.responses.length, 0);
    byId('all-trades-count').textContent = visibleTrades.length;
    byId('my-trades-count').textContent = mine;
    byId('saved-trades-count').textContent = visibleTrades.filter((trade) => state.saved.has(trade.id)).length;
    byId('open-trades-stat').textContent = open;
    byId('counteroffers-stat').textContent = counteroffers;
    byId('trade-results-count').textContent = filteredCount === 1
      ? l('trading.results.one', '1 offre affichée · données locales', { count: filteredCount })
      : l('trading.results.many', `${filteredCount} offres affichées · données locales`, { count: filteredCount });
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

  function pickerContainer(kind) {
    return byId(kind === 'counter' ? 'counter-picker' : `${kind}-picker`);
  }

  function renderSelected(kind) {
    const container = byId(kind === 'counter' ? 'counter-selected' : `${kind}-selected`);
    if (!container) return;
    const selected = pickerSelection(kind);
    if (!selected.size) {
      container.innerHTML = `<span>${l('trading.noneSelected', 'Aucun fruit sélectionné')}</span>`;
      return;
    }
    container.innerHTML = [...selected].map((fruitId) => {
      const fruit = fruitById.get(fruitId);
      if (!fruit) return '';
      return `<button class="selected-fruit-chip" type="button" data-picker-remove="${kind}" data-fruit-id="${escapeHtml(fruitId)}" aria-label="${escapeHtml(l('trading.picker.removeAria', `Retirer ${fruit.name}`, { fruit: fruit.name }))}"><img src="${fruitImagePath(fruit)}" alt="" width="512" height="512">${escapeHtml(fruit.name)} <i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`;
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
      container.innerHTML = `<div class="picker-no-results"><p>${escapeHtml(l('trading.noneFound', 'Aucun fruit trouvé.'))}</p><button type="button" data-clear-picker-search="${kind}">${escapeHtml(l('trading.picker.clearSearch', 'Effacer la recherche'))}</button></div>`;
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
          <span><strong>${escapeHtml(fruit.name)}</strong><small>${escapeHtml(rarityLabel(fruit.rarity))}</small></span>
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
        showToast(l('trading.validation.sameFruitBothSides', 'Un même fruit ne peut pas être des deux côtés.'), 'warning');
        return;
      }
      if (selected.size >= MAX_FRUITS) {
        showToast(l('trading.validation.maxPerSide', `Maximum ${MAX_FRUITS} fruits par côté.`, { count: MAX_FRUITS }), 'warning');
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
      <span>${escapeHtml(l('trading.giveYou', 'Tu proposes'))}<strong>${formatValue(offeredValue, mode)}</strong></span>
      <b class="trade-value-gap"><i class="fa-solid fa-chart-simple" aria-hidden="true"></i>${escapeHtml(offeredValue && wantedValue
        ? l('trading.wikiGap', `Écart wiki ${gap}%`, { gap })
        : l('trading.addBothSides', 'Ajoute les deux côtés'))}</b>
      <span>${escapeHtml(l('trading.wantYou', 'Tu recherches'))}<strong>${formatValue(wantedValue, mode)}</strong></span>`;
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
    renderAllPickers();
  }

  function createDraftSnapshot() {
    return {
      username: byId('trade-username').value.slice(0, 20),
      mode: byId('trade-mode').value === 'permanent' ? 'permanent' : 'physical',
      offered: [...state.create.offered],
      wanted: [...state.create.wanted],
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
    const fruitCount = createDraft.offered.length + createDraft.wanted.length;
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
    state.create.offered = new Set(createDraft.offered);
    state.create.wanted = new Set(createDraft.wanted);
    $$('[data-picker-search="offered"], [data-picker-search="wanted"]').forEach((input) => { input.value = ''; });
    clearCreateErrors();
    byId('trade-note-count').textContent = String(createDraft.note.length);
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
    const overlaps = [...state.create.offered].some((fruitId) => state.create.wanted.has(fruitId));
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

  function submitCreate(event) {
    event.preventDefault();
    if (isSubmitting || !validateCreateForm()) return;
    isSubmitting = true;
    setFormBusy(event.currentTarget, true, l('trading.feedback.publishing', 'Publication…'));
    const mode = byId('trade-mode').value === 'permanent' ? 'permanent' : 'physical';
    const trade = {
      id: uniqueId('trade'),
      username: byId('trade-username').value.trim(),
      mode,
      status: 'open',
      owned: true,
      trust: defaultTrust(byId('trade-username').value.trim(), true),
      localInteraction: { responseId: null, state: 'awaiting_response', updatedAt: new Date().toISOString() },
      offered: [...state.create.offered].map((fruitId) => ({ fruitId, quantity: 1 })),
      wanted: [...state.create.wanted].map((fruitId) => ({ fruitId, quantity: 1 })),
      note: byId('trade-note').value.trim().slice(0, 180),
      createdAt: new Date().toISOString(),
      responses: []
    };
    state.trades.unshift(trade);
    state.tracker.set(trade.id, { stage: 'prepared', updatedAt: new Date().toISOString() });
    persistTrades();
    persistTracker();
    removeCreateDraft(false);
    resetFilters();
    resetCreateForm();
    closeCreate();
    showToast(l('trading.feedback.published', 'Ton offre a été ajoutée à cette démo locale.'));
    announce(l('trading.feedback.publishedAnnouncement', 'Offre publiée localement.'));
    window.setTimeout(() => {
      isSubmitting = false;
      setFormBusy(byId('create-trade-form'), false, '');
    }, 0);
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
    return { key: 'trading.response.pending', fallback: 'À examiner', icon: 'fa-clock' };
  }

  function detailMarkup(trade) {
    const mode = modeCopy(trade.mode);
    const history = trade.responses.slice(-5).reverse();
    const responseMarkup = history.length
      ? `<div class="counter-list">${history.map((response) => {
          const outcome = responseOutcomeMeta(response.outcome);
          const fruitNames = response.offered.map((line) => fruitById.get(line.fruitId)?.name || '').join(' + ');
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
      : `<div class="counter-empty"><i class="fa-regular fa-comments" aria-hidden="true"></i><p>${escapeHtml(l('trading.response.none', 'Aucune contre-offre locale pour le moment.'))}</p></div>`;

    return `
      <div class="detail-owner">
        <span class="trade-user-avatar" aria-hidden="true">${escapeHtml(initials(trade.username))}</span>
        <span class="detail-owner-copy"><strong>${escapeHtml(trade.username)}</strong><small>${escapeHtml(l('trading.detail.publishedAt', `Publiée ${formatRelative(trade.createdAt)} · ${fullDate(trade.createdAt)}`, {
          relative: formatRelative(trade.createdAt), date: fullDate(trade.createdAt)
        }))}</small></span>
        <span class="detail-owner-badges">
          <span class="trade-card-format"><i class="fa-solid ${mode.icon}" aria-hidden="true"></i>${mode.label}</span>
          <span class="trade-status${trade.status === 'completed' ? ' completed' : ''}"><i class="fa-solid fa-circle" aria-hidden="true"></i>${trade.status === 'completed' ? l('trading.status.completed', 'Terminée') : l('trading.status.open', 'Ouverte')}</span>
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
        <h3 id="counter-history-title">${escapeHtml(l('trading.response.title', `Réponses locales (${trade.responses.length})`, { count: trade.responses.length }))}</h3>
        <p>${escapeHtml(l('trading.response.localCopy', "Ces réponses simulent l'activité sur cet appareil ; elles ne sont pas envoyées au joueur."))}</p>
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
        <p>${escapeHtml(l('trading.counter.copy', "Indique ton pseudo et ce que tu proposes. Rien n'est envoyé hors de ce navigateur."))}</p>
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
            <legend><span class="picker-step give"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></span><span><strong>${escapeHtml(l('trading.counter.give', 'Tu proposes en échange'))}</strong><small>${escapeHtml(l('trading.selectOneToFour', 'Sélectionne 1 à 4 fruits'))}</small></span></legend>
            <label class="picker-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="sr-only">${escapeHtml(l('trading.counter.searchLabel', 'Rechercher un fruit pour la contre-offre'))}</span><input type="search" placeholder="${escapeHtml(l('trading.pickerSearchPlaceholder', 'Rechercher…'))}" data-picker-search="counter" autocomplete="off"></label>
            <div class="selected-fruits" id="counter-selected" aria-live="polite"><span>${escapeHtml(l('trading.noneSelected', 'Aucun fruit sélectionné'))}</span></div>
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
    const ownerActions = trade.owned
      ? `<div class="detail-owner-actions">
          <button class="btn btn-secondary" type="button" data-owner-status="${trade.status === 'open' ? 'completed' : 'open'}"><i class="fa-solid ${trade.status === 'open' ? 'fa-circle-check' : 'fa-rotate-left'}" aria-hidden="true"></i>${trade.status === 'open' ? escapeHtml(l('trading.owner.complete', 'Marquer terminée')) : escapeHtml(l('trading.owner.reopen', 'Rouvrir'))}</button>
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

  function openTradeDetail(tradeId, trigger, intent = 'view') {
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
  }

  function closeDetail(restoreFocus = true) {
    closeModal(byId('trade-detail-modal'), restoreFocus);
    state.activeTradeId = null;
    state.counter.clear();
  }

  function submitCounteroffer(event) {
    if (!event.target.matches('#counteroffer-form')) return;
    event.preventDefault();
    if (isSubmitting) return;
    const trade = state.trades.find((item) => item.id === state.activeTradeId);
    if (!trade || trade.status !== 'open' || trade.owned) {
      showToast(l('trading.feedback.cannotRespond', 'Cette offre ne peut plus recevoir de réponse.'), 'warning');
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
    if ([...state.counter].some((fruitId) => sourceIds.has(fruitId))) {
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
    const responseId = uniqueId('counter');
    trade.responses.push({
      id: responseId,
      username,
      offered: [...state.counter].map((fruitId) => ({ fruitId, quantity: 1 })),
      note: byId('counter-note').value.trim().slice(0, 160),
      createdAt: new Date().toISOString(),
      local: true,
      outcome: 'pending'
    });
    trade.localInteraction = { responseId, state: 'offer_sent', updatedAt: new Date().toISOString() };
    ensureTracker(trade.id, 'player_contacted');
    persistTrades();
    state.counter.clear();
    renderTrades();
    renderTradeDetail();
    window.requestAnimationFrame(() => $('[data-interaction-state]', byId('trade-detail-modal'))?.focus());
    showToast(wasCounteroffer
      ? l('trading.feedback.counterSent', 'Contre-offre enregistrée sur cet appareil.')
      : l('trading.feedback.offerSent', 'Offre enregistrée sur cet appareil.'));
    announce(wasCounteroffer
      ? l('trading.feedback.counterSentAnnouncement', 'Contre-offre enregistrée localement.')
      : l('trading.feedback.offerSentAnnouncement', 'Offre enregistrée localement.'));
    window.setTimeout(() => { isSubmitting = false; }, 0);
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

  function toggleReported(tradeId) {
    const trade = state.trades.find((item) => item.id === tradeId && !item.owned);
    if (!trade) return;
    const removing = state.reported.has(tradeId);
    if (removing) state.reported.delete(tradeId);
    else state.reported.add(tradeId);
    persistModeration();
    renderTrades();
    if (state.activeTradeId === tradeId) renderTradeDetail();
    focusAfterRender(`[data-report-trade="${tradeId}"]`, `[data-view-trade="${tradeId}"]`);
    const message = removing
      ? l('trading.feedback.reportRemoved', 'Signalement local retiré.')
      : l('trading.feedback.reported', 'Profil signalé sur cet appareil.');
    showToast(message);
    announce(message);
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

  function updateResponseOutcome(responseId, outcome) {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned && item.status === 'open');
    const response = trade?.responses.find((item) => item.id === responseId);
    if (!trade || !response || !['accepted', 'declined'].includes(outcome)) return;
    response.outcome = outcome;
    trade.localInteraction = { responseId, state: outcome, updatedAt: new Date().toISOString() };
    if (outcome === 'accepted') ensureTracker(trade.id, 'exchange_pending');
    persistTrades();
    renderTrades();
    renderTradeDetail();
    focusAfterRender(`[data-response-item="${responseId}"] .counter-outcome`, '[data-interaction-state]');
    const message = outcome === 'accepted'
      ? l('trading.feedback.responseAccepted', 'Offre acceptée localement. Vérifie maintenant l’échange dans le jeu.')
      : l('trading.feedback.responseDeclined', 'Offre refusée localement.');
    showToast(message);
    announce(message);
  }

  function advanceTracker(tradeId) {
    const trade = state.trades.find((item) => item.id === tradeId);
    if (!trade) return;
    const current = ensureTracker(tradeId, 'prepared');
    const currentIndex = TRACKER_STAGES.indexOf(current.stage);
    const nextStage = TRACKER_STAGES[currentIndex + 1];
    if (!nextStage) return;
    state.tracker.set(tradeId, { stage: nextStage, updatedAt: new Date().toISOString() });
    if (nextStage === 'completed') {
      trade.localInteraction = { responseId: trade.localInteraction?.responseId || null, state: 'completed', updatedAt: new Date().toISOString() };
      if (trade.owned) trade.status = 'completed';
      persistTrades();
    }
    persistTracker();
    renderTrades();
    if (state.activeTradeId === tradeId) renderTradeDetail();
    focusAfterRender(`[data-advance-tracker="${tradeId}"]`, `[data-trade-tracker]`);
    const meta = trackerStageMeta(nextStage);
    const message = l('trading.feedback.trackerAdvanced', `Suivi mis à jour : ${l(meta.key, meta.fallback)}.`, { stage: l(meta.key, meta.fallback) });
    showToast(message);
    announce(message);
  }

  function updateOwnedStatus(status) {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned);
    if (!trade || !['open', 'completed'].includes(status)) return;
    trade.status = status;
    if (status === 'completed') {
      trade.localInteraction = { responseId: trade.localInteraction?.responseId || null, state: 'completed', updatedAt: new Date().toISOString() };
      state.tracker.set(trade.id, { stage: 'completed', updatedAt: new Date().toISOString() });
    } else {
      const pendingResponse = trade.responses.find((response) => response.outcome === 'pending');
      trade.localInteraction = {
        responseId: pendingResponse?.id || null,
        state: pendingResponse ? 'counter_received' : 'awaiting_response',
        updatedAt: new Date().toISOString()
      };
      state.tracker.set(trade.id, { stage: pendingResponse ? 'exchange_pending' : 'prepared', updatedAt: new Date().toISOString() });
    }
    persistTrades();
    persistTracker();
    renderTrades();
    renderTradeDetail();
    focusAfterRender('[data-owner-status]', '[data-interaction-state]');
    showToast(status === 'completed'
      ? l('trading.feedback.completed', 'Offre marquée comme terminée.')
      : l('trading.feedback.reopened', 'Offre rouverte.'));
  }

  function deleteOwnedTrade() {
    const trade = state.trades.find((item) => item.id === state.activeTradeId && item.owned);
    if (!trade) return;
    if (!window.confirm(l('trading.confirm.delete', 'Supprimer définitivement cette offre locale ?'))) return;
    state.trades = state.trades.filter((item) => item.id !== trade.id);
    state.saved.delete(trade.id);
    state.reported.delete(trade.id);
    state.blocked.delete(trade.id);
    state.tracker.delete(trade.id);
    persistTrades();
    persistSaved();
    persistModeration();
    persistTracker();
    closeDetail();
    renderTrades();
    showToast(l('trading.feedback.deleted', 'Offre locale supprimée.'));
    announce(l('trading.feedback.deletedAnnouncement', 'Offre supprimée.'));
  }

  function tradeShareMessage(trade) {
    const mode = modeCopy(trade.mode);
    const list = (lines) => lines.map((line) => `${line.quantity > 1 ? `${line.quantity}× ` : ''}${fruitById.get(line.fruitId)?.name || ''}`).join(' + ');
    const note = displayTradeNote(trade);
    return [
      l('trading.shareMessage.intro', 'Salam, voici une offre Itemsouq Trading (démo) :'),
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

  function resetTradingDemo() {
    if (!window.confirm(l('trading.confirm.resetAll', 'Réinitialiser les offres, favoris, suivis, profils masqués et brouillon Trading de ce navigateur ?'))) return;
    try {
      localStorage.removeItem(STORAGE.trades);
      localStorage.removeItem(STORAGE.saved);
      localStorage.removeItem(STORAGE.draft);
      localStorage.removeItem(STORAGE.tracker);
      localStorage.removeItem(STORAGE.reported);
      localStorage.removeItem(STORAGE.blocked);
    } catch (error) {
      showToast(l('trading.feedback.storageResetFailed', 'Impossible de modifier le stockage local.'), 'warning');
      return;
    }
    state.trades = sanitizeTrades(demoTrades());
    state.saved.clear();
    state.tracker.clear();
    state.reported.clear();
    state.blocked.clear();
    state.lastBlockedTradeId = null;
    createDraft = null;
    resetCreateForm();
    updateDraftPanel();
    persistTrades();
    persistSaved();
    persistTracker();
    persistModeration();
    updateBlockUndo();
    resetFilters();
    showToast(l('trading.feedback.reset', 'La démo Trading a été réinitialisée.'));
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
      else if (view) openTradeDetail(view.dataset.viewTrade, view, view.dataset.tradeIntent || 'view');
      else if (share) shareTrade(share.dataset.shareTrade, share);
    });

    document.addEventListener('click', (event) => {
      const picker = event.target.closest('[data-picker]');
      const remove = event.target.closest('[data-picker-remove]');
      const ownerStatus = event.target.closest('[data-owner-status]');
      const clearPickerSearch = event.target.closest('[data-clear-picker-search]');
      const reportTrade = event.target.closest('[data-report-trade]');
      const blockTradeButton = event.target.closest('[data-block-trade]');
      const responseAction = event.target.closest('[data-response-action]');
      const trackerAdvance = event.target.closest('[data-advance-tracker]');
      if (picker) togglePickerFruit(picker.dataset.picker, picker.dataset.fruitId);
      else if (remove) togglePickerFruit(remove.dataset.pickerRemove, remove.dataset.fruitId);
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
      else if (reportTrade) toggleReported(reportTrade.dataset.reportTrade);
      else if (blockTradeButton) blockTrade(blockTradeButton.dataset.blockTrade);
      else if (event.target.closest('[data-undo-block]')) undoBlock();
      else if (responseAction) updateResponseOutcome(responseAction.dataset.responseId, responseAction.dataset.responseAction);
      else if (trackerAdvance) advanceTracker(trackerAdvance.dataset.advanceTracker);
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
        const focusSelector = activeElement?.dataset.reportTrade
          ? `[data-report-trade="${activeElement.dataset.reportTrade}"]`
          : activeElement?.dataset.advanceTracker
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

  function init() {
    validateDataset();
    hydrateState();
    const calculatorHandoff = applyCalculatorHandoff();
    attachEvents();
    updateDraftPanel();
    updateValueSortAvailability();
    applyPageLocale();
    renderAllPickers();
    renderTrades();
    if (calculatorHandoff) {
      showToast(l('trading.feedback.calculatorPrepared', 'Offre chargée dans le calculateur.'));
    }
  }

  init();
  document.addEventListener('DOMContentLoaded', applyPageLocale, { once: true });
})();
