(() => {
  'use strict';

  const guide = document.getElementById('site-guide');
  if (!guide) return;

  const bubble = document.getElementById('site-guide-bubble');
  const messageNode = document.getElementById('site-guide-message');
  const kickerNode = document.getElementById('site-guide-kicker');
  const presenceNode = document.getElementById('site-guide-presence');
  const toggle = guide.querySelector('[data-guide-toggle]');
  const minimize = guide.querySelector('[data-guide-minimize]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const storageKey = 'itemsouq-guide-minimized';
  const fruits = new Map((Array.isArray(window.ITEMSOUQ_FRUITS) ? window.ITEMSOUQ_FRUITS : []).map((fruit) => [fruit.id, fruit]));

  const copy = {
    fr: {
      kicker: 'GUIDE ITEMSouq',
      presence: 'EN LIGNE',
      open: 'Ouvrir l’assistante ItemSouq',
      minimize: 'Réduire l’assistante',
      greeting: 'Salam 👋 Je suis ta guide ItemSouq. Clique sur moi si tu veux un petit conseil.',
      wave: 'Je suis là ! Choisis un fruit et je t’accompagne jusqu’à ta demande.',
      detail: '{fruit} est un excellent choix. Vérifie bien le format et le stock.',
      added: '{fruit} rejoint ta commande. Je garde un œil dessus ✨',
      compare: 'Bonne idée ! Compare jusqu’à 3 fruits avant de décider.',
      favorite: '{fruit} est gardé dans tes favoris 💜',
      checkout: 'Parfait. Vérifie ton pseudo Roblox avant d’ouvrir WhatsApp.',
      whatsapp: 'Je te laisse avec notre vendeur. Ne partage jamais ton mot de passe.',
      catalogue: 'Astuce : utilise les filtres de rareté pour trouver ton fruit plus vite.',
      idle: ['Je peux t’aider à comparer les fruits.', 'Un doute ? Ouvre l’aperçu rapide avant de choisir.', 'Les prix et le stock sont toujours confirmés sur WhatsApp.']
    },
    ary: {
      kicker: 'GUIDE ITEMSouq',
      presence: 'ONLINE',
      open: '7ell guide dyal ItemSouq',
      minimize: 'Sgher l guide',
      greeting: 'Salam 👋 Ana guide dyalk f ItemSouq. Kliki 3liya ila bghiti n3awnek.',
      wave: 'Ana hna! Khtar fruit w nb9a m3ak 7tta tsift talab dyalk.',
      detail: '{fruit} choix zwine. Chouf nno3 w stock 9bel ma tzidou.',
      added: '{fruit} tzad l talab dyalk. Ghadi nb9a m3ak ✨',
      compare: 'Fekra zwina! Qaren 7tta 3 fruits 9bel ma t9rer.',
      favorite: '{fruit} t7fed f favoris dyalk 💜',
      checkout: 'Kamel! T2ekked mn pseudo Roblox 9bel WhatsApp.',
      whatsapp: 'Ghadi n7ellek WhatsApp. 3emrek tpartaji mot de passe dyalk.',
      catalogue: 'Nsi7a: sta3mel filtre dyal nodora bach tl9a fruit b ser3a.',
      idle: ['N9der n3awnek t9aren bin lfruits.', 'Ma m2ekedch? 7ell l aperçu srii3 9bel ma tkhtar.', 'Taman w stock kayt2ekdo dima f WhatsApp.']
    }
  };

  let hideTimer = 0;
  let speakingTimer = 0;
  let idleTimer = 0;
  let idleIndex = 0;

  function language() {
    return window.ITEMSOUQ_I18N?.getLanguage?.() === 'ary' ? 'ary' : 'fr';
  }

  function text(key) {
    return copy[language()][key];
  }

  function interpolate(value, variables = {}) {
    return String(value).replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);
  }

  function fruitName(id) {
    return fruits.get(id)?.name || id || (language() === 'ary' ? 'Had fruit' : 'Ce fruit');
  }

  function safeStoredMinimized() {
    try { return localStorage.getItem(storageKey) === '1'; } catch (error) { return false; }
  }

  function storeMinimized(value) {
    try { localStorage.setItem(storageKey, value ? '1' : '0'); } catch (error) { /* State still works for this visit. */ }
  }

  function syncLabels() {
    kickerNode.textContent = text('kicker');
    presenceNode.textContent = text('presence');
    toggle.setAttribute('aria-label', text('open'));
    minimize.setAttribute('aria-label', text('minimize'));
    minimize.setAttribute('title', text('minimize'));
  }

  function setMinimized(value, persist = true) {
    guide.classList.toggle('is-minimized', value);
    toggle.setAttribute('aria-expanded', value ? 'false' : 'true');
    bubble.setAttribute('aria-hidden', value ? 'true' : 'false');
    if (persist) storeMinimized(value);
  }

  function speak(key, variables = {}, duration = 5200) {
    window.clearTimeout(hideTimer);
    window.clearTimeout(speakingTimer);
    setMinimized(false, false);
    messageNode.textContent = interpolate(text(key), variables);
    guide.classList.remove('is-speaking');
    void guide.offsetWidth;
    guide.classList.add('is-speaking');
    speakingTimer = window.setTimeout(() => guide.classList.remove('is-speaking'), 520);
    if (duration > 0) {
      hideTimer = window.setTimeout(() => {
        setMinimized(true, false);
      }, duration);
    }
  }

  function wave() {
    guide.classList.remove('is-waving');
    void guide.offsetWidth;
    guide.classList.add('is-waving');
    window.setTimeout(() => guide.classList.remove('is-waving'), 760);
  }

  function startIdleMessages() {
    window.clearInterval(idleTimer);
    idleTimer = window.setInterval(() => {
      if (document.hidden || document.body.classList.contains('overlay-open') || guide.classList.contains('is-minimized')) return;
      const messages = text('idle');
      messageNode.textContent = messages[idleIndex % messages.length];
      idleIndex += 1;
      guide.classList.add('is-speaking');
      window.setTimeout(() => guide.classList.remove('is-speaking'), 520);
    }, 24000);
  }

  toggle.addEventListener('click', () => {
    if (guide.classList.contains('is-minimized')) {
      setMinimized(false);
      speak('wave');
    } else {
      wave();
      speak('wave');
    }
  });

  minimize.addEventListener('click', (event) => {
    event.stopPropagation();
    setMinimized(true);
    toggle.focus({ preventScroll: true });
  });

  document.addEventListener('click', (event) => {
    const quick = event.target.closest('[data-quick-view]');
    const add = event.target.closest('[data-quick-add]');
    const compare = event.target.closest('[data-compare], [data-quick-compare]');
    const favorite = event.target.closest('[data-favorite]');
    const checkout = event.target.closest('#checkout-open');
    const whatsapp = event.target.closest('.whatsapp-general, #checkout-submit, #checkout-whatsapp-fallback');

    if (add) speak('added', { fruit: fruitName(add.dataset.quickAdd) });
    else if (quick) speak('detail', { fruit: fruitName(quick.dataset.quickView) });
    else if (compare) speak('compare');
    else if (favorite) speak('favorite', { fruit: fruitName(favorite.dataset.favorite) });
    else if (checkout) speak('checkout');
    else if (whatsapp) speak('whatsapp', {}, 7000);
  }, true);

  document.addEventListener('itemsouq:languagechange', () => {
    syncLabels();
    speak('greeting', {}, 4200);
    startIdleMessages();
  });

  if (precisePointer.matches && !reduceMotion.matches) {
    document.addEventListener('pointermove', (event) => {
      const x = ((event.clientX / window.innerWidth) - .5) * 9;
      const y = ((event.clientY / window.innerHeight) - .5) * 6;
      guide.style.setProperty('--guide-x', `${x.toFixed(2)}px`);
      guide.style.setProperty('--guide-y', `${y.toFixed(2)}px`);
      guide.style.setProperty('--guide-rotate', `${(x * .12).toFixed(2)}deg`);
    }, { passive: true });
  }

  syncLabels();
  setMinimized(safeStoredMinimized(), false);
  messageNode.textContent = text('greeting');
  guide.hidden = false;
  startIdleMessages();

  if (!guide.classList.contains('is-minimized')) {
    hideTimer = window.setTimeout(() => setMinimized(true, false), 7200);
  }
})();
