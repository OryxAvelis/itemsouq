/* Itemsouq Services — public, owner-managed service catalogue */
(function () {
  'use strict';

  const API_URL = 'api/v1/services.php';
  const config = window.ITEMSOUQ_CONFIG && typeof window.ITEMSOUQ_CONFIG === 'object'
    ? window.ITEMSOUQ_CONFIG
    : {};
  const sellerWhatsAppNumber = String(config.whatsappNumber || '').replace(/\D/g, '');
  const i18n = window.ITEMSOUQ_I18N && typeof window.ITEMSOUQ_I18N === 'object'
    ? window.ITEMSOUQ_I18N
    : null;

  const copy = {
    fr: {
      pageTitle: 'Services · Itemsouq',
      pageDescription: 'Découvre les services numériques proposés et vérifiés directement par le propriétaire d’Itemsouq.',
      skip: 'Aller aux services',
      announcementOwner: 'Services publiés par le propriétaire Itemsouq',
      announcementSafe: 'Aucun mot de passe ni code confidentiel demandé',
      brandHome: 'Itemsouq, accueil',
      primaryNav: 'Navigation principale',
      mobileNav: 'Navigation mobile',
      quickNav: 'Navigation rapide',
      openMenu: 'Ouvrir le menu',
      closeMenu: 'Fermer le menu',
      navHome: 'Accueil',
      navCatalogue: 'Catalogue',
      navGamepasses: 'Game Passes',
      navTrading: 'Trading',
      navCalculator: 'Calculateur',
      navServices: 'Services',
      shopCta: 'Voir la boutique',
      heroEyebrow: 'NOUVEL ESPACE · GÉRÉ PAR ITEMSOUQ',
      heroTitleStart: 'Des services clairs,',
      heroTitleAccent: 'ajoutés avec soin.',
      heroCopy: 'Chaque offre est vérifiée puis publiée directement par le propriétaire, avec un prix, une disponibilité et des conditions claires.',
      heroBrowse: 'Voir les services',
      heroSafety: 'Nos règles de sécurité',
      guarantees: 'Garanties de la section',
      trustOwner: 'Publication par le propriétaire',
      trustCredentials: 'Jamais d’identifiants demandés',
      comingSoon: 'Catalogue prêt',
      showcaseKicker: 'OFFRES GÉRÉES PAR ITEMSOUQ',
      showcaseTitle: 'Des offres simples et transparentes',
      showcaseCopy: 'Prix, disponibilité et détails affichés clairement.',
      floatingVerified: 'Vérifié',
      floatingSafe: 'Accès protégé',
      offersKicker: 'CATALOGUE DE SERVICES',
      offersTitle: 'Les offres disponibles',
      offersCopy: 'Seuls les services publiés par le propriétaire apparaissent ici.',
      statusLoading: 'Chargement des offres…',
      statusEmpty: 'Aucune offre publiée',
      statusLiveOne: '1 service disponible',
      statusLiveMany: '{count} services disponibles',
      statusError: 'Catalogue indisponible',
      loadingTitle: 'Préparation de la section',
      loadingCopy: 'Nous vérifions les services publiés par le propriétaire.',
      emptyTitle: 'Les services arrivent bientôt',
      emptyCopy: 'Aucune offre n’est publiée pour le moment. Le propriétaire Itemsouq les ajoutera ici depuis son espace privé.',
      errorTitle: 'Impossible de charger les services',
      errorCopy: 'La section est temporairement indisponible. Réessaie dans quelques instants.',
      retry: 'Réessayer',
      safetyKicker: 'SIMPLE ET SÛR',
      safetyTitle: 'Des règles claires avant chaque service',
      safetyCopy: 'Itemsouq ne demande jamais l’accès à ton compte, ton mot de passe ou tes codes de sécurité.',
      safetyOwnerTitle: 'Offres contrôlées',
      safetyOwnerCopy: 'Le propriétaire ajoute et met à jour chaque service depuis son espace privé.',
      safetyAccountTitle: 'Ton compte reste privé',
      safetyAccountCopy: 'Ne partage jamais ton mot de passe, ton PIN, un code OTP ou tes cookies de connexion.',
      safetyDetailsTitle: 'Détails transparents',
      safetyDetailsCopy: 'Lis le prix, la disponibilité et les conditions affichées avant de contacter Itemsouq.',
      safetyNoteLabel: 'À retenir :',
      safetyNoteCopy: 'aucun service légitime ne nécessite de transférer ton compte ou de communiquer tes identifiants.',
      footerCopy: 'Une marketplace marocaine avec des offres publiées et suivies par le propriétaire.',
      footerExplore: 'Explorer',
      footerHelp: 'Aide',
      footerHow: 'Comment acheter',
      footerFaq: 'Questions fréquentes',
      footerSafety: 'Règles de sécurité',
      footerImportant: 'Important',
      footerImportantCopy: 'Itemsouq ne vend pas de comptes et ne demande jamais de données de connexion.',
      footerCopyright: '© 2026 Itemsouq · Marketplace marocaine',
      footerDisclaimer: 'Non affilié à Roblox ou Blox Fruits',
      mobileHome: 'Accueil',
      mobileShop: 'Boutique',
      mobilePasses: 'Passes',
      mobileTrade: 'Trading',
      mobileServices: 'Services',
      offerCategory: 'Service Itemsouq',
      available: 'Disponible',
      onRequest: 'Sur demande',
      unavailable: 'Indisponible',
      priceLabel: 'Prix',
      priceOnRequest: 'Sur demande',
      ownerPublished: 'Publié par Itemsouq',
      featured: 'Mis en avant',
      contact: 'Contacter sur WhatsApp',
      contactAria: 'Contacter Itemsouq pour {title}',
      whatsappMessage: 'Salam Itemsouq 👋\n\nJe suis intéressé par le service « {title} » ({price}).\nMerci de confirmer sa disponibilité, le prix final et les conditions.\n\nJe ne partagerai aucun mot de passe, PIN, code OTP ou cookie.'
    },
    ary: {
      pageTitle: 'Services · Itemsouq',
      pageDescription: 'Chof services numériques li kay9tr7hom w kayt2kked menhom moul Itemsouq.',
      skip: 'Sir l services',
      announcementOwner: 'Services kaynzlhom moul Itemsouq',
      announcementSafe: 'Ma kanTalbo la mot de passe la code sirri',
      brandHome: 'Itemsouq, rissiya',
      primaryNav: 'Navigation l2assassiya',
      mobileNav: 'Navigation dyal telephone',
      quickNav: 'Navigation sri3a',
      openMenu: '7ell menu',
      closeMenu: 'Sedd menu',
      navHome: 'Rissiya',
      navCatalogue: 'Lfruits',
      navGamepasses: 'Game Passes',
      navTrading: 'Tbdal',
      navCalculator: 'L7assaba',
      navServices: 'Services',
      shopCta: 'Chof l7anout',
      heroEyebrow: 'BLASSA JDIDA · KAYSSIRHA ITEMSOUQ',
      heroTitleStart: 'Services wad7in,',
      heroTitleAccent: 'mzadin b l3inaya.',
      heroCopy: 'Kol 3ard kaytchaf w kaytncher direct mn 3nd moul site, b taman, disponibilité w chourout wad7in.',
      heroBrowse: 'Chof services',
      heroSafety: '9awa3id dyal l2aman',
      guarantees: 'Damanat dyal had l9ism',
      trustOwner: 'Moul site howa li kayncher',
      trustCredentials: '3mrna ma kanTalbo identifiants',
      comingSoon: 'Catalogue wajed',
      showcaseKicker: '3OROD KAYSSIRHOM ITEMSOUQ',
      showcaseTitle: '3orod sahlin w wad7in',
      showcaseCopy: 'Taman, disponibilité w tafasil kaybano b wodou7.',
      floatingVerified: 'Mchouf',
      floatingSafe: 'Dkhol m7mi',
      offersKicker: 'CATALOGUE DYAL SERVICES',
      offersTitle: 'Services li kaynin',
      offersCopy: 'Ghir services li kayncher moul site kaybano hna.',
      statusLoading: 'Kanjibou services…',
      statusEmpty: 'Mazal ma kayn 7ta 3ard',
      statusLiveOne: 'Service wa7ed kayn',
      statusLiveMany: '{count} services kaynin',
      statusError: 'Catalogue ma khddamch',
      loadingTitle: 'Kant2kkdo mn l9ism',
      loadingCopy: 'Kanchoufo services li ncher moul site.',
      emptyTitle: 'Services ghadi yjiw 9riban',
      emptyCopy: 'Daba mazal ma kayn 7ta 3ard. Moul Itemsouq ghadi yzidhom hna mn l’espace privé dyalo.',
      errorTitle: 'Ma 9drnach njibou services',
      errorCopy: 'Had l9ism ma khddamch daba. 3awed jreb mn b3d chwya.',
      retry: '3awed jreb',
      safetyKicker: 'SAHL W AMN',
      safetyTitle: '9awa3id wad7in 9bel ay service',
      safetyCopy: 'Itemsouq 3mro ma kayTalb dkhol l compte, mot de passe wla codes dyal l2aman.',
      safetyOwnerTitle: '3orod mra9bin',
      safetyOwnerCopy: 'Moul site howa li kayzid w kaybeddel kol service mn l’espace privé dyalo.',
      safetyAccountTitle: 'Compte dyalk kayb9a privé',
      safetyAccountCopy: 'Matpartajich mot de passe, PIN, code OTP wla cookies dyal dkhol.',
      safetyDetailsTitle: 'Tafasil wad7in',
      safetyDetailsCopy: '9ra taman, disponibilité w chourout 9bel ma ttwasel m3a Itemsouq.',
      safetyNoteLabel: 'Tdfkker:',
      safetyNoteCopy: '7ta service 9anouni ma kay7taj t3ti compte dyalk wla identifiants dyalk.',
      footerCopy: 'Marketplace mghribi b 3orod kayncherhom w kaytb3hom moul site.',
      footerExplore: 'Chof',
      footerHelp: 'Mosa3ada',
      footerHow: 'Kifach tchri',
      footerFaq: 'As2ila mt3awda',
      footerSafety: '9awa3id dyal l2aman',
      footerImportant: 'Mohim',
      footerImportantCopy: 'Itemsouq ma kaybi3ch comptes w ma kayTalbch ma3loumat dyal dkhol.',
      footerCopyright: '© 2026 Itemsouq · Marketplace mghribi',
      footerDisclaimer: 'Ma mtab3ch l Roblox wla Blox Fruits',
      mobileHome: 'Rissiya',
      mobileShop: 'L7anout',
      mobilePasses: 'Passes',
      mobileTrade: 'Tbdal',
      mobileServices: 'Services',
      offerCategory: 'Service Itemsouq',
      available: 'Kayna',
      onRequest: 'B talab',
      unavailable: 'Ma kaynach',
      priceLabel: 'Taman',
      priceOnRequest: 'B talab',
      ownerPublished: 'Nchro Itemsouq',
      featured: 'M7tot f lwla',
      contact: 'Twasel f WhatsApp',
      contactAria: 'Twasel m3a Itemsouq 3la {title}',
      whatsappMessage: 'Salam Itemsouq 👋\n\nAna mhtem b service « {title} » ({price}).\n3afak 2ekked liya disponibilité, taman l2akhir w chourout.\n\nMa ghadi npartaji la mot de passe, la PIN, la code OTP, la cookie.'
    }
  };

  const state = {
    phase: 'loading',
    services: []
  };

  const elements = {
    menu: document.getElementById('mobile-menu'),
    menuToggle: document.querySelector('[data-services-menu-toggle]'),
    status: document.getElementById('services-data-status'),
    stateCard: document.getElementById('services-state'),
    grid: document.getElementById('services-offers-grid'),
    retry: document.getElementById('services-retry')
  };

  function language() {
    return i18n?.getLanguage?.() === 'ary' ? 'ary' : 'fr';
  }

  function t(key, variables = {}) {
    const value = copy[language()][key] ?? copy.fr[key] ?? key;
    return String(value).replace(/\{(\w+)\}/g, (match, name) => (
      Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
    ));
  }

  function applyLanguage() {
    document.title = t('pageTitle');
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', t('pageDescription'));

    document.querySelectorAll('[data-services-i18n]').forEach((element) => {
      element.textContent = t(element.dataset.servicesI18n);
    });
    document.querySelectorAll('[data-services-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', t(element.dataset.servicesI18nAria));
    });

    if (elements.menuToggle) {
      elements.menuToggle.setAttribute('aria-label', t(elements.menuToggle.getAttribute('aria-expanded') === 'true' ? 'closeMenu' : 'openMenu'));
    }
    renderCatalogue();
  }

  function closeMenu() {
    if (!elements.menu || !elements.menuToggle) return;
    elements.menu.hidden = true;
    elements.menuToggle.setAttribute('aria-expanded', 'false');
    elements.menuToggle.setAttribute('aria-label', t('openMenu'));
    const icon = elements.menuToggle.querySelector('i');
    icon?.classList.remove('fa-xmark');
    icon?.classList.add('fa-bars');
  }

  function toggleMenu() {
    if (!elements.menu || !elements.menuToggle) return;
    const willOpen = elements.menu.hidden;
    elements.menu.hidden = !willOpen;
    elements.menuToggle.setAttribute('aria-expanded', String(willOpen));
    elements.menuToggle.setAttribute('aria-label', t(willOpen ? 'closeMenu' : 'openMenu'));
    const icon = elements.menuToggle.querySelector('i');
    icon?.classList.toggle('fa-bars', !willOpen);
    icon?.classList.toggle('fa-xmark', willOpen);
  }

  function stringValue(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function numberValue(...values) {
    for (const value of values) {
      if (value === null || value === undefined || value === '') continue;
      const number = Number(value);
      if (Number.isFinite(number) && number >= 0) return number;
    }
    return null;
  }

  function normalizeService(item, index) {
    if (!item || typeof item !== 'object') return null;
    const sourceTitleFr = stringValue(item.titleFr, stringValue(item.title, stringValue(item.name)));
    const sourceTitleAry = stringValue(item.titleAry);
    const titleFr = sourceTitleFr || sourceTitleAry;
    const titleAry = sourceTitleAry || titleFr;
    if (!titleFr && !titleAry) return null;
    const sourceDescriptionFr = stringValue(item.descriptionFr, stringValue(item.description, stringValue(item.summary)));
    const sourceDescriptionAry = stringValue(item.descriptionAry);
    const status = stringValue(item.availability, stringValue(item.status, 'available')).toLowerCase();
    return {
      id: stringValue(String(item.id ?? ''), `service-${index + 1}`),
      titleFr,
      titleAry,
      descriptionFr: sourceDescriptionFr || sourceDescriptionAry,
      descriptionAry: sourceDescriptionAry || sourceDescriptionFr,
      category: stringValue(item.category, stringValue(item.type)),
      priceMad: numberValue(item.price_mad, item.priceMad, item.price),
      image: stringValue(item.image_url, stringValue(item.imageUrl, stringValue(item.image))),
      availability: item.available === false && status === 'available' ? 'out_of_stock' : status,
      isFeatured: item.isFeatured === true || item.is_featured === true || Number(item.isFeatured ?? item.is_featured) === 1
    };
  }

  function localizedField(service, field) {
    const suffix = language() === 'ary' ? 'Ary' : 'Fr';
    return stringValue(service[`${field}${suffix}`], stringValue(service[`${field}Fr`]));
  }

  function normalizePayload(payload) {
    const data = payload && typeof payload === 'object' && !Array.isArray(payload) && payload.data !== undefined
      ? payload.data
      : payload;
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data?.services)
        ? data.services
        : Array.isArray(data?.items) ? data.items : [];
    return items.map(normalizeService).filter(Boolean);
  }

  function safeImageUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(value, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function formatPrice(value) {
    if (!Number.isFinite(value)) return t('priceOnRequest');
    return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(value)} MAD`;
  }

  function whatsappUrl(message) {
    const recipient = sellerWhatsAppNumber ? `/${sellerWhatsAppNumber}` : '';
    return `https://wa.me${recipient}/?text=${encodeURIComponent(message)}`;
  }

  function createOfferCard(service) {
    const serviceTitle = localizedField(service, 'title');
    const serviceDescription = localizedField(service, 'description');
    const available = ['available', 'in_stock'].includes(service.availability);
    const unavailable = ['out_of_stock', 'unavailable', 'disabled', 'sold_out'].includes(service.availability);
    const article = document.createElement('article');
    article.className = `service-offer-card${service.isFeatured ? ' is-featured' : ''}`;
    article.dataset.serviceId = service.id;

    const visual = document.createElement('div');
    visual.className = 'service-offer-visual';
    const imageUrl = safeImageUrl(service.image);
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = serviceTitle;
      image.width = 640;
      image.height = 360;
      image.loading = 'lazy';
      visual.append(image);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'service-offer-fallback';
      fallback.setAttribute('aria-hidden', 'true');
      fallback.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
      visual.append(fallback);
    }

    const availability = document.createElement('span');
    availability.className = `service-offer-status${available ? '' : unavailable ? ' is-unavailable' : ' is-request'}`;
    availability.textContent = t(available ? 'available' : unavailable ? 'unavailable' : 'onRequest');
    visual.append(availability);
    if (service.isFeatured) {
      const featured = document.createElement('span');
      featured.className = 'service-offer-featured';
      featured.innerHTML = '<i class="fa-solid fa-star" aria-hidden="true"></i>';
      featured.append(document.createTextNode(` ${t('featured')}`));
      visual.append(featured);
    }

    const body = document.createElement('div');
    body.className = 'service-offer-body';
    const category = document.createElement('span');
    category.className = 'service-offer-category';
    category.textContent = service.category || t('offerCategory');
    const title = document.createElement('h3');
    title.textContent = serviceTitle;
    const description = document.createElement('p');
    description.textContent = serviceDescription || t('showcaseCopy');

    const foot = document.createElement('div');
    foot.className = 'service-offer-foot';
    const price = document.createElement('span');
    price.className = 'service-offer-price';
    const priceLabel = document.createElement('small');
    priceLabel.textContent = t('priceLabel');
    const priceValue = document.createElement('strong');
    priceValue.textContent = formatPrice(service.priceMad);
    price.append(priceLabel, priceValue);
    const owner = document.createElement('span');
    owner.className = 'service-offer-owner';
    owner.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>';
    owner.append(document.createTextNode(` ${t('ownerPublished')}`));
    foot.append(price, owner);
    const contact = document.createElement('a');
    contact.className = 'btn btn-primary service-offer-contact';
    contact.href = whatsappUrl(t('whatsappMessage', { title: serviceTitle, price: formatPrice(service.priceMad) }));
    contact.target = '_blank';
    contact.rel = 'noopener noreferrer';
    contact.setAttribute('aria-label', t('contactAria', { title: serviceTitle }));
    contact.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i>';
    contact.append(document.createTextNode(` ${t('contact')}`));
    body.append(category, title, description, foot, contact);
    article.append(visual, body);
    return article;
  }

  function setStatus(className, iconClass, label) {
    if (!elements.status) return;
    elements.status.className = `services-data-status ${className}`;
    elements.status.replaceChildren();
    const icon = document.createElement('i');
    icon.className = iconClass;
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = label;
    elements.status.append(icon, text);
  }

  function renderState(kind, iconClass, titleKey, copyKey, retryVisible) {
    if (!elements.stateCard) return;
    elements.stateCard.hidden = false;
    elements.stateCard.className = `services-state-card is-${kind}`;
    const icon = elements.stateCard.querySelector('.services-state-icon i');
    if (icon) icon.className = iconClass;
    const title = elements.stateCard.querySelector('h3');
    const paragraph = elements.stateCard.querySelector('p');
    if (title) title.textContent = t(titleKey);
    if (paragraph) paragraph.textContent = t(copyKey);
    if (elements.retry) elements.retry.hidden = !retryVisible;
  }

  function renderCatalogue() {
    if (!elements.grid || !elements.stateCard) return;
    elements.grid.hidden = true;
    elements.grid.replaceChildren();

    if (state.phase === 'loading') {
      setStatus('is-loading', 'fa-solid fa-circle-notch fa-spin', t('statusLoading'));
      renderState('loading', 'fa-solid fa-circle-notch fa-spin', 'loadingTitle', 'loadingCopy', false);
      return;
    }

    if (state.phase === 'error') {
      setStatus('is-error', 'fa-solid fa-triangle-exclamation', t('statusError'));
      renderState('error', 'fa-solid fa-cloud-arrow-down', 'errorTitle', 'errorCopy', true);
      return;
    }

    if (state.services.length === 0) {
      setStatus('is-empty', 'fa-regular fa-clock', t('statusEmpty'));
      renderState('empty', 'fa-solid fa-wand-magic-sparkles', 'emptyTitle', 'emptyCopy', false);
      return;
    }

    const countLabel = state.services.length === 1
      ? t('statusLiveOne')
      : t('statusLiveMany', { count: state.services.length });
    setStatus('is-live', 'fa-solid fa-circle-check', countLabel);
    elements.stateCard.hidden = true;
    state.services.forEach((service) => elements.grid.append(createOfferCard(service)));
    elements.grid.hidden = false;
  }

  async function loadServices() {
    state.phase = 'loading';
    renderCatalogue();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error?.code || `HTTP_${response.status}`);
      state.services = normalizePayload(payload);
      state.phase = 'ready';
    } catch (error) {
      state.services = [];
      state.phase = 'error';
    } finally {
      window.clearTimeout(timeout);
      renderCatalogue();
    }
  }

  elements.menuToggle?.addEventListener('click', toggleMenu);
  elements.menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  elements.retry?.addEventListener('click', loadServices);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.menu && !elements.menu.hidden) {
      closeMenu();
      elements.menuToggle?.focus();
    }
  });
  document.addEventListener('itemsouq:languagechange', applyLanguage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyLanguage();
      loadServices();
    }, { once: true });
  } else {
    applyLanguage();
    loadServices();
  }
})();
