(() => {
  'use strict';

  const page = (() => {
    const classes = document.body.classList;
    if (classes.contains('gamepasses-page')) return 'gamepasses';
    if (classes.contains('services-page')) return 'services';
    if (classes.contains('calculator-page')) return 'calculator';
    if (classes.contains('trading-page')) return 'trading';
    return 'home';
  })();

  if (!document.getElementById('site-guide')) {
    document.body.insertAdjacentHTML('beforeend', `
      <aside class="site-guide" id="site-guide" data-guide-page="${page}" aria-label="Assistante ItemSouq" hidden>
        <div class="site-guide-bubble" id="site-guide-bubble" role="status" aria-live="polite" aria-atomic="true">
          <span class="site-guide-kicker"><i aria-hidden="true"></i><span id="site-guide-kicker">GUIDE ITEMSouq</span></span>
          <p id="site-guide-message">Salam ! Je suis là pour t'aider.</p>
          <button class="site-guide-minimize" type="button" data-guide-minimize aria-label="Réduire l’assistante" title="Réduire l’assistante">
            <i class="fa-solid fa-minus" aria-hidden="true"></i>
          </button>
        </div>
        <button class="site-guide-character" type="button" data-guide-toggle aria-label="Ouvrir l’assistante ItemSouq" aria-controls="site-guide-bubble" aria-expanded="true">
          <span class="site-guide-aura" aria-hidden="true"></span>
          <span class="site-guide-orbit site-guide-orbit-one" aria-hidden="true"><i></i></span>
          <span class="site-guide-orbit site-guide-orbit-two" aria-hidden="true"><i></i></span>
          <span class="site-guide-spark site-guide-spark-one" aria-hidden="true"><i class="fa-solid fa-sparkles"></i></span>
          <span class="site-guide-spark site-guide-spark-two" aria-hidden="true"><i class="fa-solid fa-star"></i></span>
          <span class="site-guide-portrait">
            <img src="assets/images/assistant/itemsouq-guide.webp" width="600" height="900" alt="" aria-hidden="true" decoding="async">
            <span class="site-guide-blink site-guide-blink-left" aria-hidden="true"></span>
            <span class="site-guide-blink site-guide-blink-right" aria-hidden="true"></span>
          </span>
          <span class="site-guide-presence"><i aria-hidden="true"></i><span id="site-guide-presence">EN LIGNE</span></span>
          <span class="site-guide-burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </button>
      </aside>
    `);
  }

  const guide = document.getElementById('site-guide');
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
      greetings: {
        home: 'Salam 👋 Je suis ta guide ItemSouq. Choisis un fruit et je t’accompagne.',
        gamepasses: 'Prêt à améliorer ton aventure ? Je peux t’aider à choisir le bon Game Pass.',
        services: 'Bienvenue aux services ItemSouq. Vérifie toujours les détails avant de nous contacter.',
        calculator: 'Ajoute les deux côtés : je t’aide à voir si l’échange est équilibré.',
        trading: 'Je peux t’aider à parcourir les offres ou à préparer ton propre échange.'
      },
      wave: 'Je suis là ! Dis-moi ce que tu veux explorer et je te guide.',
      detail: '{fruit} est un excellent choix. Vérifie bien le format et le stock.',
      added: '{fruit} rejoint ta commande. Je garde un œil dessus ✨',
      compare: 'Bonne idée ! Compare jusqu’à 3 fruits avant de décider.',
      favorite: '{fruit} est gardé dans tes favoris 💜',
      checkout: 'Parfait. Vérifie ton pseudo Roblox avant d’ouvrir WhatsApp.',
      whatsapp: 'Je te laisse avec notre vendeur. Ne partage jamais ton mot de passe.',
      catalogue: 'Astuce : utilise les filtres de rareté pour trouver ton fruit plus vite.',
      gamepassAdded: '{item} est ajouté. Tu peux préparer plusieurs passes dans la même demande.',
      gamepassCart: 'Voici ta demande. Vérifie les passes et le total avant WhatsApp.',
      gamepassFilter: 'Bien vu ! Les catégories rendent le bon Game Pass plus facile à trouver.',
      serviceContact: 'Tu regardes « {item} ». Confirme le prix et les conditions avant de continuer.',
      serviceSafety: 'Bon réflexe : aucun service légitime ne demande ton mot de passe ou ton code OTP.',
      calculatorPicker: 'Choisis maintenant les fruits de ce côté de l’échange.',
      calculatorFruit: '{fruit} est pris en compte. Complète les deux côtés pour voir le résultat.',
      calculatorResult: 'Nouveau résultat : {result}. Garde aussi la demande réelle du marché en tête.',
      calculatorSave: 'Calcul sauvegardé sur cet appareil. Tu pourras le reprendre plus tard.',
      calculatorShare: 'Ton résumé est prêt à être partagé.',
      tradingCreate: 'Super ! Ajoute ce que tu proposes, ce que tu recherches, puis vérifie tout avant de publier.',
      tradingView: 'Regarde les deux côtés et la valeur avant de répondre à cette offre.',
      tradingFruit: '{fruit} rejoint ta composition. Tu peux encore ajuster les quantités.',
      tradingSave: 'Offre gardée sur cet appareil pour la retrouver plus vite 💜',
      tradingShare: 'Bonne idée : partage uniquement les détails de l’offre, jamais tes identifiants.',
      tradingSubmit: 'Je vérifie la composition… ton offre sera visible après validation.',
      tradingPublished: 'C’est publié ! Surveille les réponses sans partager tes informations privées.',
      idle: {
        home: ['Je peux t’aider à comparer les fruits.', 'Un doute ? Ouvre l’aperçu rapide avant de choisir.', 'Les prix et le stock sont toujours confirmés sur WhatsApp.'],
        gamepasses: ['Compare la valeur Robux et le prix Itemsouq.', 'Tu peux regrouper plusieurs Game Passes dans une demande.', 'Aucun vendeur fiable ne demande ton mot de passe Roblox.'],
        services: ['Lis bien la disponibilité et les conditions de chaque service.', 'Les offres affichées ici sont publiées par ItemSouq.', 'Garde toujours ton mot de passe et tes codes privés.'],
        calculator: ['Compose les deux côtés pour obtenir une comparaison claire.', 'La valeur wiki est un repère, pas une garantie de marché.', 'Tu peux sauvegarder tes calculs sur cet appareil.'],
        trading: ['Vérifie la valeur des deux côtés avant de répondre.', 'Tu peux sauvegarder une offre pour la retrouver plus tard.', 'Ne partage jamais ton mot de passe dans une offre.']
      }
    },
    ary: {
      kicker: 'GUIDE ITEMSouq',
      presence: 'ONLINE',
      open: '7ell guide dyal ItemSouq',
      minimize: 'Sgher l guide',
      greetings: {
        home: 'Salam 👋 Ana guide dyalk f ItemSouq. Khtar fruit w nb9a m3ak.',
        gamepasses: 'Wajed tzid t9ewa f lgame? N9der n3awnek tkhtar Game Pass.',
        services: 'Mer7ba f services ItemSouq. Chouf details 9bel ma tcontactina.',
        calculator: 'Zid joj jwaneb w n3awnek tchouf wach trade mizan.',
        trading: 'N9der n3awnek tchouf l3orod wela twjed trade dyalk.'
      },
      wave: 'Ana hna! Goul lia ach bghiti tchouf w n3awnek.',
      detail: '{fruit} choix zwine. Chouf nno3 w stock 9bel ma tzidou.',
      added: '{fruit} tzad l talab dyalk. Ghadi nb9a m3ak ✨',
      compare: 'Fekra zwina! Qaren 7tta 3 fruits 9bel ma t9rer.',
      favorite: '{fruit} t7fed f favoris dyalk 💜',
      checkout: 'Kamel! T2ekked mn pseudo Roblox 9bel WhatsApp.',
      whatsapp: 'Ghadi n7ellek WhatsApp. 3emrek tpartaji mot de passe dyalk.',
      catalogue: 'Nsi7a: sta3mel filtre dyal nodora bach tl9a fruit b ser3a.',
      gamepassAdded: '{item} tzad. T9der tjme3 ktar mn pass f talab wa7ed.',
      gamepassCart: 'Hadi hiya talab dyalk. T2ekked mn passes w total 9bel WhatsApp.',
      gamepassFilter: 'Mzyan! Categories ghadi y3awnouk tl9a Game Pass b ser3a.',
      serviceContact: 'Katshof « {item} ». T2ekked mn taman w chorot 9bel ma tkemmel.',
      serviceSafety: 'Bravo: service mezyan ma kaytlobch mot de passe wela code OTP.',
      calculatorPicker: 'Daba khtar lfruits dyal had jiha f trade.',
      calculatorFruit: '{fruit} t7seb. Kemmel joj jwaneb bach tchouf natija.',
      calculatorResult: 'Natija jdida: {result}. Matnsach talab dyal sou9 7tta howa.',
      calculatorSave: 'L7sab t7fed f had lappareil bach trje3 lih.',
      calculatorShare: 'Résumé dyalk wajed bach tpartajih.',
      tradingCreate: 'Zwin! Zid ach kat3ti, ach baghi, w t2ekked 9bel ma tposti.',
      tradingView: 'Chouf joj jwaneb w l9ima 9bel ma tjawb 3la l’offre.',
      tradingFruit: '{fruit} tzad l trade. T9der mazal tbdel quantité.',
      tradingSave: 'L’offre t7fdat f had lappareil bach tl9aha b ser3a 💜',
      tradingShare: 'Partaji ghir details dyal l’offre, 3emrek tpartaji les identifiants.',
      tradingSubmit: 'Kanchecki composition… l’offre ghadi tban mn b3d validation.',
      tradingPublished: 'Tpostat! Tbe3 ljwabat bla ma tpartaji infos privées.',
      idle: {
        home: ['N9der n3awnek t9aren bin lfruits.', 'Ma m2ekedch? 7ell l aperçu srii3 9bel ma tkhtar.', 'Taman w stock kayt2ekdo dima f WhatsApp.'],
        gamepasses: ['Qaren l9ima Robux m3a taman Itemsouq.', 'T9der tjme3 ktar mn Game Pass f talab wa7ed.', '3emrek t3ti mot de passe Roblox dyalk.'],
        services: ['Qra disponibilité w chorot dyal kol service.', 'Had l3orod kayzidhom ItemSouq.', 'Khalli mot de passe w codes dyalk sirriyin.'],
        calculator: ['Kemmel joj jwaneb bach tchouf comparaison.', 'L9ima dyal wiki ghir dalil, machi daman dyal sou9.', 'T9der t7fed l7sabat f had lappareil.'],
        trading: ['Chouf l9ima dyal joj jwaneb 9bel ma tjawb.', 'T9der t7fed offre bach tl9aha mnb3d.', 'Matpartajich mot de passe f chi offre.']
      }
    }
  };

  let hideTimer = 0;
  let speakingTimer = 0;
  let burstTimer = 0;
  let idleTimer = 0;
  let idleIndex = 0;
  let lastToastMessage = '';

  function language() {
    return window.ITEMSOUQ_I18N?.getLanguage?.() === 'ary' ? 'ary' : 'fr';
  }

  function text(key) {
    return copy[language()][key];
  }

  function pageText(group) {
    const values = text(group);
    return values?.[page] ?? values?.home ?? '';
  }

  function interpolate(value, variables = {}) {
    return String(value).replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);
  }

  function fruitName(id) {
    return fruits.get(id)?.name || id || (language() === 'ary' ? 'Had fruit' : 'Ce fruit');
  }

  function namedCard(control, cardSelector) {
    return control?.closest(cardSelector)?.querySelector('h3')?.textContent?.trim() || (language() === 'ary' ? 'Had l’offre' : 'Cette offre');
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

  function burst() {
    if (reduceMotion.matches) return;
    window.clearTimeout(burstTimer);
    guide.classList.remove('has-burst');
    void guide.offsetWidth;
    guide.classList.add('has-burst');
    burstTimer = window.setTimeout(() => guide.classList.remove('has-burst'), 760);
  }

  function speak(key, variables = {}, duration = 5200, mood = 'helpful') {
    window.clearTimeout(hideTimer);
    window.clearTimeout(speakingTimer);
    setMinimized(false, false);
    guide.dataset.mood = mood;
    messageNode.textContent = interpolate(text(key), variables);
    guide.classList.remove('is-speaking');
    void guide.offsetWidth;
    guide.classList.add('is-speaking');
    burst();
    speakingTimer = window.setTimeout(() => guide.classList.remove('is-speaking'), 520);
    if (duration > 0) hideTimer = window.setTimeout(() => setMinimized(true, false), duration);
  }

  function speakGreeting(duration = 5200) {
    window.clearTimeout(hideTimer);
    setMinimized(false, false);
    guide.dataset.mood = page === 'calculator' ? 'thinking' : page === 'trading' ? 'excited' : 'helpful';
    messageNode.textContent = pageText('greetings');
    burst();
    if (duration > 0) hideTimer = window.setTimeout(() => setMinimized(true, false), duration);
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
      const messages = pageText('idle');
      messageNode.textContent = messages[idleIndex % messages.length];
      idleIndex += 1;
      guide.classList.add('is-speaking');
      window.setTimeout(() => guide.classList.remove('is-speaking'), 520);
    }, 24000);
  }

  function speakCalculatorResult() {
    const result = document.getElementById('calc-result-label')?.textContent?.trim();
    const waiting = document.getElementById('calc-result')?.classList.contains('is-waiting');
    if (result && !waiting) speak('calculatorResult', { result }, 6200, 'thinking');
  }

  toggle.addEventListener('click', () => {
    if (guide.classList.contains('is-minimized')) {
      setMinimized(false);
      speak('wave', {}, 5200, 'excited');
    } else {
      wave();
      speak('wave', {}, 5200, 'excited');
    }
  });

  minimize.addEventListener('click', (event) => {
    event.stopPropagation();
    setMinimized(true);
    toggle.focus({ preventScroll: true });
  });

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (page === 'home') {
      const quick = target.closest('[data-quick-view]');
      const add = target.closest('[data-quick-add]');
      const compare = target.closest('[data-compare], [data-quick-compare]');
      const favorite = target.closest('[data-favorite]');
      const checkout = target.closest('#checkout-open');
      const whatsapp = target.closest('.whatsapp-general, #checkout-submit, #checkout-whatsapp-fallback');
      if (add) speak('added', { fruit: fruitName(add.dataset.quickAdd) }, 5200, 'success');
      else if (quick) speak('detail', { fruit: fruitName(quick.dataset.quickView) }, 5200, 'thinking');
      else if (compare) speak('compare', {}, 5200, 'thinking');
      else if (favorite) speak('favorite', { fruit: fruitName(favorite.dataset.favorite) }, 5200, 'excited');
      else if (checkout) speak('checkout', {}, 5600, 'helpful');
      else if (whatsapp) speak('whatsapp', {}, 7000, 'warning');
      return;
    }

    if (page === 'gamepasses') {
      const add = target.closest('[data-add-gamepass]');
      if (add) speak('gamepassAdded', { item: namedCard(add, '.gamepass-card') }, 5400, 'success');
      else if (target.closest('[data-open-gamepass-cart]')) speak('gamepassCart', {}, 5600, 'thinking');
      else if (target.closest('[data-gamepass-category]')) speak('gamepassFilter', {}, 4200, 'helpful');
      else if (target.closest('#gamepass-cart-whatsapp, #gamepass-general-whatsapp, #gamepass-whatsapp-fab')) speak('whatsapp', {}, 7000, 'warning');
      return;
    }

    if (page === 'services') {
      const contact = target.closest('.service-offer-contact');
      if (contact) speak('serviceContact', { item: namedCard(contact, '.service-offer-card') }, 6500, 'warning');
      else if (target.closest('[href="#service-safety"]')) speak('serviceSafety', {}, 6200, 'success');
      return;
    }

    if (page === 'calculator') {
      const pickerFruit = target.closest('[data-picker-fruit]');
      if (target.closest('[data-open-picker]')) speak('calculatorPicker', {}, 4600, 'thinking');
      else if (pickerFruit) {
        speak('calculatorFruit', { fruit: fruitName(pickerFruit.dataset.fruitId) }, 4800, 'success');
        window.setTimeout(speakCalculatorResult, 220);
      } else if (target.closest('[data-close-picker]')) window.setTimeout(speakCalculatorResult, 220);
      else if (target.closest('#calc-save')) speak('calculatorSave', {}, 5200, 'success');
      else if (target.closest('#calc-share, #calc-copy')) speak('calculatorShare', {}, 4800, 'excited');
      else if (target.closest('#calc-whatsapp')) speak('whatsapp', {}, 7000, 'warning');
      return;
    }

    if (page === 'trading') {
      const picker = target.closest('[data-picker]');
      if (target.closest('[data-open-create]')) speak('tradingCreate', {}, 6200, 'excited');
      else if (target.closest('[data-view-trade]')) speak('tradingView', {}, 5600, 'thinking');
      else if (picker) speak('tradingFruit', { fruit: fruitName(picker.dataset.fruitId) }, 4800, 'success');
      else if (target.closest('[data-save-trade]')) speak('tradingSave', {}, 4800, 'excited');
      else if (target.closest('[data-share-trade], [data-share-active]')) speak('tradingShare', {}, 6000, 'helpful');
      else if (target.closest('.trade-calculator-link')) speak('calculatorPicker', {}, 4600, 'thinking');
    }
  });

  document.addEventListener('submit', (event) => {
    if (page === 'trading' && event.target.matches('#create-trade-form')) speak('tradingSubmit', {}, 6200, 'thinking');
  });

  document.addEventListener('itemsouq:languagechange', () => {
    syncLabels();
    speakGreeting(4600);
    startIdleMessages();
  });

  if (page === 'trading') {
    const toast = document.getElementById('trade-toast');
    if (toast) {
      new MutationObserver(() => {
        const message = document.getElementById('trade-toast-message')?.textContent?.trim() || '';
        if (!toast.hidden && message && message !== lastToastMessage) {
          lastToastMessage = message;
          if (/publi|post|visible/i.test(message)) speak('tradingPublished', {}, 6500, 'success');
        }
      }).observe(toast, { attributes: true, childList: true, subtree: true });
    }
  }

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
  messageNode.textContent = pageText('greetings');
  guide.dataset.mood = page === 'calculator' ? 'thinking' : page === 'trading' ? 'excited' : 'helpful';
  guide.hidden = false;
  startIdleMessages();

  if (!guide.classList.contains('is-minimized')) {
    burst();
    hideTimer = window.setTimeout(() => setMinimized(true, false), 7200);
  }
})();
