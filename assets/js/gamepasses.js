/* Itemsouq Game Passes — owner-managed catalogue with a safe local fallback */
(function () {
  'use strict';

  const API_URL = 'api/v1/game-passes.php';
  const CART_STORAGE_KEY = 'itemsouq:gamepasses:v1:cart';
  const config = window.ITEMSOUQ_CONFIG && typeof window.ITEMSOUQ_CONFIG === 'object'
    ? window.ITEMSOUQ_CONFIG
    : {};
  const sharedI18n = window.ITEMSOUQ_I18N && typeof window.ITEMSOUQ_I18N === 'object'
    ? window.ITEMSOUQ_I18N
    : null;
  const sellerWhatsAppNumber = String(config.whatsappNumber || '').replace(/\D/g, '');

  const IMAGE_BY_SLUG = Object.freeze({
    '2x-boss-drops-chance': 'assets/images/gamepasses/boss-drops.png',
    '2x-boss-drops': 'assets/images/gamepasses/boss-drops.png',
    'boss-drops': 'assets/images/gamepasses/boss-drops.png',
    'fast-boats': 'assets/images/gamepasses/fast-boats.png',
    '2x-money': 'assets/images/gamepasses/money.png',
    'money': 'assets/images/gamepasses/money.png',
    '2x-mastery': 'assets/images/gamepasses/mastery.png',
    'mastery': 'assets/images/gamepasses/mastery.png',
    'dark-blade': 'assets/images/gamepasses/dark-blade.png',
    'fruit-notifier': 'assets/images/gamepasses/notifier.png',
    'notifier': 'assets/images/gamepasses/notifier.png'
  });

  const CATEGORY_BY_SLUG = Object.freeze({
    '2x-boss-drops-chance': 'utility',
    '2x-boss-drops': 'utility',
    'boss-drops': 'utility',
    'fast-boats': 'exploration',
    '2x-money': 'progression',
    'money': 'progression',
    '2x-mastery': 'progression',
    'mastery': 'progression',
    'dark-blade': 'equipment',
    'fruit-notifier': 'exploration',
    'notifier': 'exploration'
  });

  const COPY = {
    fr: {
      'meta.title': 'Game Passes Blox Fruits au Maroc · Itemsouq',
      'meta.description': 'Découvre les Game Passes Blox Fruits proposés par Itemsouq au Maroc, avec prix et disponibilité confirmés sur WhatsApp.',
      'skip.catalogue': 'Aller aux Game Passes',
      'announcement.safe': 'Prix et disponibilité confirmés avant paiement',
      'announcement.delivery': 'Livraison numérique',
      'nav.fruits': 'Fruits',
      'nav.gamepasses': 'Game Passes',
      'nav.services': 'Services',
      'header.order': 'Ma commande',
      'mobile.passes': 'Passes',
      'mobile.order': 'Commande',
      'hero.eyebrow': 'Avantages permanents · Catalogue Itemsouq',
      'hero.title': 'Passe au niveau supérieur,<br><span>sans perdre ton temps.</span>',
      'hero.copy': 'Découvre les Game Passes Blox Fruits, consulte leur valeur Robux et demande le prix Itemsouq en dirhams.',
      'hero.explore': 'Voir les Game Passes',
      'hero.ask': 'Poser une question',
      'hero.checkPrice': 'Prix confirmé avant paiement',
      'hero.checkPassword': 'Aucun mot de passe demandé',
      'hero.featured': 'GAME PASS POPULAIRE',
      'hero.discovery': 'EXPLORATION',
      'stats.passes': 'Game Passes référencés',
      'stats.permanent': 'Permanents',
      'stats.permanentCopy': 'Avantages durables en jeu',
      'stats.confirmation': 'Confirmation humaine',
      'catalogue.kicker': 'LES GAME PASSES',
      'catalogue.title': 'Choisis ton prochain avantage',
      'catalogue.copy': 'Les valeurs Robux, descriptions et visuels viennent du Blox Fruits Wiki. Les prix MAD et disponibilités sont gérés par Itemsouq.',
      'catalogue.source': 'Source : Blox Fruits Wiki Shop',
      'status.loading': 'Chargement des prix et disponibilités Itemsouq…',
      'status.live': 'Prix et disponibilités mis à jour par Itemsouq.',
      'status.review': 'Catalogue chargé : certains prix attendent encore la confirmation du propriétaire.',
      'status.empty': 'Aucun Game Pass n’est publié pour le moment.',
      'status.fallback': 'Connexion à la base indisponible : catalogue de référence chargé, prix à demander sur WhatsApp.',
      'filter.searchLabel': 'Rechercher un Game Pass',
      'filter.searchPlaceholder': 'Rechercher Mastery, Dark Blade…',
      'filter.sortLabel': 'Trier les Game Passes',
      'filter.categoriesAria': 'Filtrer par catégorie',
      'filter.reset': 'Réinitialiser',
      'sort.featured': 'Recommandés',
      'sort.robuxAsc': 'Robux croissant',
      'sort.robuxDesc': 'Robux décroissant',
      'sort.priceAsc': 'Prix MAD croissant',
      'sort.name': 'Nom A–Z',
      'category.all': 'Tous',
      'category.progression': 'Progression',
      'category.utility': 'Utilité',
      'category.equipment': 'Équipement',
      'category.exploration': 'Exploration',
      'results.count': '{count} Game Pass(es) disponible(s)',
      'empty.title': 'Aucun Game Pass trouvé',
      'empty.copy': 'Essaie un autre mot ou réinitialise les filtres.',
      'empty.catalogueTitle': 'Le catalogue est momentanément vide',
      'empty.catalogueCopy': 'Les Game Passes réapparaîtront ici dès que le propriétaire les republiera.',
      'card.permanent': 'PASS PERMANENT',
      'card.wikiValue': 'Valeur wiki',
      'card.itemsouqPrice': 'Prix Itemsouq',
      'card.add': 'Ajouter à la demande',
      'card.ask': 'Demander la disponibilité',
      'card.unavailable': 'Indisponible',
      'price.onRequest': 'Sur demande',
      'price.toConfirm': '{price} · à confirmer',
      'availability.available': 'Disponible',
      'availability.onRequest': 'Sur demande',
      'availability.outOfStock': 'Rupture de stock',
      'availability.review': 'À confirmer',
      'stock.count': '{count} en stock',
      'stock.available': 'Stock disponible',
      'stock.confirm': 'Stock à confirmer',
      'how.kicker': 'SIMPLE ET SÉCURISÉ',
      'how.title': 'Ta demande en trois étapes',
      'how.copy': 'Aucun paiement n’est traité sur le site. Le vendeur vérifie tout avec toi sur WhatsApp.',
      'how.chooseTitle': 'Choisis ton pass',
      'how.chooseCopy': 'Ajoute un ou plusieurs Game Passes à ta demande.',
      'how.confirmTitle': 'Confirme sur WhatsApp',
      'how.confirmCopy': 'Le vendeur confirme la disponibilité, le prix final et ton pseudo Roblox.',
      'how.receiveTitle': 'Reçois-le dans le jeu',
      'how.receiveCopy': 'La livraison est organisée uniquement après ta confirmation.',
      'safety.title': 'Rappel important :',
      'safety.copy': 'Itemsouq ne te demandera jamais ton mot de passe Roblox, ton PIN, un code OTP ou tes informations bancaires.',
      'footer.copy': 'La marketplace marocaine pour découvrir fruits et Game Passes Blox Fruits avec confirmation sur WhatsApp.',
      'footer.shop': 'Boutique',
      'footer.help': 'Aide',
      'footer.important': 'Important',
      'footer.warning': 'N’envoie jamais ton mot de passe, PIN ou code de sécurité. Prix et stock doivent être confirmés avant tout paiement.',
      'footer.copyright': '© 2026 Itemsouq · Marketplace marocaine',
      'footer.disclaimer': 'Non affilié à Roblox ou Blox Fruits',
      'cart.kicker': 'TA DEMANDE',
      'cart.title': 'Game Passes',
      'cart.emptyTitle': 'Ta demande est vide',
      'cart.emptyCopy': 'Ajoute un Game Pass depuis le catalogue pour commencer.',
      'cart.browse': 'Voir les Game Passes',
      'cart.notice': 'Les prix affichés restent à confirmer avec le vendeur.',
      'cart.estimatedTotal': 'Total affiché',
      'cart.prepare': 'Préparer sur WhatsApp',
      'cart.clear': 'Vider la demande',
      'cart.totalWithRequest': '{total} + prix sur demande',
      'toast.added': '{name} ajouté à ta demande.',
      'toast.removed': '{name} retiré de ta demande.',
      'toast.cleared': 'Demande vidée.',
      'toast.max': 'Quantité maximale atteinte pour {name}.',
      'aria.brandHome': 'Itemsouq, accueil',
      'aria.openCart': 'Ouvrir ma commande de Game Passes',
      'aria.closeCart': 'Fermer la commande',
      'aria.openMenu': 'Ouvrir le menu',
      'aria.closeMenu': 'Fermer le menu',
      'aria.guarantees': 'Garanties de la commande',
      'aria.summary': 'Résumé du catalogue',
      'aria.whatsapp': 'Contacter Itemsouq sur WhatsApp',
      'aria.add': 'Ajouter {name} à la demande',
      'aria.remove': 'Retirer {name}',
      'aria.decrease': 'Diminuer la quantité de {name}',
      'aria.increase': 'Augmenter la quantité de {name}',
      'whatsapp.general': 'Salam Itemsouq, je veux des informations sur vos Game Passes Blox Fruits.',
      'whatsapp.greeting': 'Salam Itemsouq 👋',
      'whatsapp.intro': 'Je souhaite vérifier cette demande de Game Passes :',
      'whatsapp.lineKnown': '• {name} × {quantity} — {price}',
      'whatsapp.lineReview': '• {name} × {quantity} — {price} indicatif, à confirmer',
      'whatsapp.lineRequest': '• {name} × {quantity} — prix sur demande',
      'whatsapp.total': 'Total affiché : {total}',
      'whatsapp.requestNotice': 'Un ou plusieurs prix sont à confirmer.',
      'whatsapp.closing': 'Merci de confirmer le stock, le prix final et la livraison dans Roblox avant tout paiement.',
      'description.2x-boss-drops-chance': 'Double les chances qu’un boss laisse tomber un objet comme une épée ou un accessoire.',
      'description.2x-boss-drops': 'Double les chances qu’un boss laisse tomber un objet comme une épée ou un accessoire.',
      'description.fast-boats': 'Donne accès aux bateaux exclusifs Miracle et The Sentinel pour voyager plus vite.',
      'description.2x-money': 'Double l’argent obtenu avec les PNJ et les quêtes, hors récompenses des coffres.',
      'description.2x-mastery': 'Double toute l’expérience de maîtrise reçue en battant des PNJ.',
      'description.dark-blade': 'Débloque l’épée mythique Dark Blade, améliorable grâce à une quête dédiée.',
      'description.fruit-notifier': 'Indique la distance jusqu’aux fruits qui apparaissent dans ton serveur.'
    },
    ary: {
      'meta.title': 'Game Passes Blox Fruits f lmghrib · Itemsouq',
      'meta.description': 'Chouf Game Passes dyal Blox Fruits f Itemsouq, b taman w stock kayt2ekdo f WhatsApp.',
      'skip.catalogue': 'Sir l Game Passes',
      'announcement.safe': 'Taman w stock kayt2ekdo 9bel lkhlass',
      'announcement.delivery': 'Twasil digital',
      'nav.fruits': 'Lfruits',
      'nav.gamepasses': 'Game Passes',
      'nav.services': 'Services',
      'header.order': 'Talabi',
      'mobile.passes': 'Passes',
      'mobile.order': 'Talab',
      'hero.eyebrow': 'Avantages daymin · Catalogue Itemsouq',
      'hero.title': 'Tla3 niveau dyalk,<br><span>bla ma tdiye3 lwe9t.</span>',
      'hero.copy': 'Chouf Game Passes dyal Blox Fruits, 9imthom b Robux w sewwel 3la taman Itemsouq b dirham.',
      'hero.explore': 'Chouf Game Passes',
      'hero.ask': 'Sewwelna',
      'hero.checkPrice': 'Taman kayt2ekked 9bel lkhlass',
      'hero.checkPassword': 'Ma kansowloukch 3la password',
      'hero.featured': 'GAME PASS MCHHOUR',
      'hero.discovery': 'L2ISTIKCHAF',
      'stats.passes': 'Game Passes f catalogue',
      'stats.permanent': 'Daymin',
      'stats.permanentCopy': 'Avantages kayb9aw f game',
      'stats.confirmation': 'Ta2kid m3a lbaya3',
      'catalogue.kicker': 'GAME PASSES',
      'catalogue.title': 'Khtar lavantage jdid dyalk',
      'catalogue.copy': '9iyam Robux, chro7at w tsawer jayyin mn Blox Fruits Wiki. Taman b MAD w stock kaydirhom Itemsouq.',
      'catalogue.source': 'Lmasdar: Blox Fruits Wiki Shop',
      'status.loading': 'Kan7emlo taman w stock dyal Itemsouq…',
      'status.live': 'Taman w stock t7edto mn Itemsouq.',
      'status.review': 'Catalogue t7emmel: chi taman mazal khas mol site y2ekdo.',
      'status.empty': 'Daba ma kayn 7tta Game Pass mnchour.',
      'status.fallback': 'Ma 9drnach ntaslo b database: catalogue l2asasi khddam, sewwel 3la taman f WhatsApp.',
      'filter.searchLabel': 'Qelleb 3la Game Pass',
      'filter.searchPlaceholder': 'Qelleb 3la Mastery, Dark Blade…',
      'filter.sortLabel': 'Retteb Game Passes',
      'filter.categoriesAria': 'Sefi b catégorie',
      'filter.reset': 'Rjje3 mn lwel',
      'sort.featured': 'Li mnss7o bihom',
      'sort.robuxAsc': 'Robux mn sghir lkbir',
      'sort.robuxDesc': 'Robux mn lkbira lsghira',
      'sort.priceAsc': 'Taman MAD mn sghir lkbir',
      'sort.name': 'Smya A–Z',
      'category.all': 'Kolchi',
      'category.progression': 'Tt9eddom',
      'category.utility': 'Lmanfa3a',
      'category.equipment': 'L3tad',
      'category.exploration': 'L2istikchaf',
      'results.count': '{count} Game Pass(es) kaynin',
      'empty.title': 'Ma l9ina 7tta Game Pass',
      'empty.copy': 'Jrreb kelma okhra wela rjje3 lfiltres mn lwel.',
      'empty.catalogueTitle': 'Catalogue khawi daba',
      'empty.catalogueCopy': 'Game Passes ghaybano hna mlli mol site y3awed yncherhom.',
      'card.permanent': 'PASS DAYEM',
      'card.wikiValue': '9ima wiki',
      'card.itemsouqPrice': 'Taman Itemsouq',
      'card.add': 'Zid l talab',
      'card.ask': 'Sewwel 3la stock',
      'card.unavailable': 'Ma kaynch daba',
      'price.onRequest': 'Sewwel 3la taman',
      'price.toConfirm': '{price} · khas ta2kid',
      'availability.available': 'Kayn',
      'availability.onRequest': 'B talab',
      'availability.outOfStock': 'Stock sala',
      'availability.review': 'Khas ta2kid',
      'stock.count': '{count} f stock',
      'stock.available': 'Stock kayn',
      'stock.confirm': 'Khas ta2kid dyal stock',
      'how.kicker': 'SAHEL W AMEN',
      'how.title': 'Talab dyalk f 3 khotwat',
      'how.copy': 'Ma kayn 7tta khlass f site. Lbaya3 kay2ekked m3ak kolchi f WhatsApp.',
      'how.chooseTitle': 'Khtar lpass dyalk',
      'how.chooseCopy': 'Zid Game Pass wa7ed wela kter l talab dyalk.',
      'how.confirmTitle': '2ekked f WhatsApp',
      'how.confirmCopy': 'Lbaya3 kay2ekked stock, taman l2akhir w pseudo Roblox dyalk.',
      'how.receiveTitle': 'Tsselmo f game',
      'how.receiveCopy': 'Twasil kaytretteb ghir mn be3d ma t2ekked nta.',
      'safety.title': 'Tdkira mohimma:',
      'safety.copy': 'Itemsouq 3emro ysowlek 3la password Roblox, PIN, code OTP wela ma3lomat bankiya.',
      'footer.copy': 'Marketplace mghribi bach tchouf fruits w Game Passes Blox Fruits, b ta2kid f WhatsApp.',
      'footer.shop': 'Boutique',
      'footer.help': 'Lmosa3ada',
      'footer.important': 'Mohim',
      'footer.warning': 'Ma tsiftch password, PIN wela code dyal l2aman. Taman w stock khas ytt2ekdo 9bel lkhlass.',
      'footer.copyright': '© 2026 Itemsouq · Marketplace mghribi',
      'footer.disclaimer': 'Ma mratbtch b Roblox wela Blox Fruits',
      'cart.kicker': 'TALAB DYALK',
      'cart.title': 'Game Passes',
      'cart.emptyTitle': 'Talab dyalk khawi',
      'cart.emptyCopy': 'Zid Game Pass mn catalogue bach tbda.',
      'cart.browse': 'Chouf Game Passes',
      'cart.notice': 'Taman li kayban khas lbaya3 y2ekdo m3ak.',
      'cart.estimatedTotal': 'Total li kayban',
      'cart.prepare': 'Wjjed f WhatsApp',
      'cart.clear': 'Khawwi talab',
      'cart.totalWithRequest': '{total} + taman khas tsowwel 3lih',
      'toast.added': '{name} tzad l talab dyalk.',
      'toast.removed': '{name} t7yed mn talab dyalk.',
      'toast.cleared': 'Talab tkhwa.',
      'toast.max': 'Wslti l l3adad l2a9sa dyal {name}.',
      'aria.brandHome': 'Itemsouq, rje3 l page lwla',
      'aria.openCart': '7ell talab dyal Game Passes',
      'aria.closeCart': 'Sed talab',
      'aria.openMenu': '7ell lmenu',
      'aria.closeMenu': 'Sed lmenu',
      'aria.guarantees': 'Damanat dyal talab',
      'aria.summary': 'Molakhas dyal catalogue',
      'aria.whatsapp': 'Twasel m3a Itemsouq f WhatsApp',
      'aria.add': 'Zid {name} l talab',
      'aria.remove': '7yed {name}',
      'aria.decrease': 'N9es l3adad dyal {name}',
      'aria.increase': 'Zid l3adad dyal {name}',
      'whatsapp.general': 'Salam Itemsouq, bghit ma3lomat 3la Game Passes dyal Blox Fruits.',
      'whatsapp.greeting': 'Salam Itemsouq 👋',
      'whatsapp.intro': 'Bghit n2ekked mn had talab dyal Game Passes:',
      'whatsapp.lineKnown': '• {name} × {quantity} — {price}',
      'whatsapp.lineReview': '• {name} × {quantity} — {price} ghir ta9ribi, khas ta2kid',
      'whatsapp.lineRequest': '• {name} × {quantity} — taman khas nsowwel 3lih',
      'whatsapp.total': 'Total li kayban: {total}',
      'whatsapp.requestNotice': 'Chi taman mazal khas ytt2ekked.',
      'whatsapp.closing': '3afak 2ekked stock, taman l2akhir w twasil f Roblox 9bel ay khlass.',
      'description.2x-boss-drops-chance': 'Kaydoubli chance bach boss yti7 lik objet b7al seif wela accessoire.',
      'description.2x-boss-drops': 'Kaydoubli chance bach boss yti7 lik objet b7al seif wela accessoire.',
      'description.fast-boats': 'Kay7ell lik bateaux Miracle w The Sentinel bach tsafr bser3a.',
      'description.2x-money': 'Kaydoubli lflous li katjme3 mn NPCs w quests, bla flous dyal chests.',
      'description.2x-mastery': 'Kaydoubli kol XP dyal mastery li katakhod mlli katghleb NPCs.',
      'description.dark-blade': 'Kay7ell lik seif mythique Dark Blade li t9der ttewro b quest.',
      'description.fruit-notifier': 'Kay3tik lmasaafa 7tta lfruits li kaybano f server dyalk.'
    }
  };

  const FALLBACK_GAME_PASSES = [
    { id: '2x-boss-drops', name: '2x Boss Drops Chance', robux: 350, category: 'utility', sortOrder: 1, image: IMAGE_BY_SLUG['2x-boss-drops'] },
    { id: 'fast-boats', name: 'Fast Boats', robux: 350, category: 'exploration', sortOrder: 2, image: IMAGE_BY_SLUG['fast-boats'] },
    { id: '2x-money', name: '2x Money', robux: 450, category: 'progression', sortOrder: 3, image: IMAGE_BY_SLUG['2x-money'] },
    { id: '2x-mastery', name: '2x Mastery', robux: 450, category: 'progression', sortOrder: 4, image: IMAGE_BY_SLUG['2x-mastery'] },
    { id: 'dark-blade', name: 'Dark Blade', robux: 1200, category: 'equipment', sortOrder: 5, image: IMAGE_BY_SLUG['dark-blade'] },
    { id: 'fruit-notifier', name: 'Fruit Notifier', robux: 2700, category: 'exploration', sortOrder: 6, image: IMAGE_BY_SLUG['fruit-notifier'] }
  ].map((gamePass) => ({
    ...gamePass,
    offering: {
      priceMad: null,
      availability: 'on_request',
      quantityAvailable: null,
      needsOwnerReview: true,
      version: 0,
      updatedAt: null
    },
    source: 'fallback'
  }));

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byId = (id) => document.getElementById(id);

  const state = {
    gamePasses: [],
    search: '',
    category: 'all',
    sort: 'featured',
    cart: [],
    apiStatus: 'loading',
    reviewCount: 0
  };

  let toastTimer = null;
  let cartReturnFocus = null;

  function currentLanguage() {
    return sharedI18n?.getLanguage?.() === 'ary' ? 'ary' : 'fr';
  }

  function interpolate(value, variables) {
    return String(value).replace(/\{(\w+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(variables || {}, key) ? variables[key] : match
    ));
  }

  function l(key, fallback = key, variables = {}) {
    const language = currentLanguage();
    return interpolate(COPY[language]?.[key] ?? COPY.fr[key] ?? fallback, variables);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  function normalizeSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function safeImagePath(value, slug) {
    const normalized = String(value || '').replace(/\\/g, '/');
    if (/^assets\/images\/gamepasses\/[a-z0-9-]+\.(?:png|webp|svg)$/i.test(normalized)) {
      return normalized;
    }
    return IMAGE_BY_SLUG[slug] || 'assets/images/gamepasses/mastery.png';
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeAvailability(value) {
    const normalized = String(value || '').toLowerCase().replace(/-/g, '_');
    if (['available', 'on_request', 'out_of_stock', 'hidden'].includes(normalized)) return normalized;
    if (['unavailable', 'sold_out'].includes(normalized)) return 'out_of_stock';
    return 'on_request';
  }

  function normalizeGamePass(raw, index) {
    const rawSlug = raw?.id ?? raw?.slug ?? raw?.gamePassSlug ?? raw?.game_pass_slug ?? raw?.name;
    const slug = normalizeSlug(rawSlug);
    if (!slug) return null;

    const fallback = FALLBACK_GAME_PASSES.find((item) => item.id === slug)
      || FALLBACK_GAME_PASSES.find((item) => item.name.toLowerCase() === String(raw?.name || '').toLowerCase());
    const offering = raw?.offering && typeof raw.offering === 'object' ? raw.offering : raw;
    const priceMad = finiteNumber(offering?.priceMad ?? offering?.price_mad);
    const quantityAvailable = finiteNumber(offering?.quantityAvailable ?? offering?.quantity_available);
    const availability = normalizeAvailability(offering?.availability);

    return {
      id: slug,
      name: String(raw?.name || fallback?.name || slug).trim().slice(0, 80),
      description: String(raw?.description || fallback?.description || '').trim().slice(0, 420),
      robux: Math.max(0, finiteNumber(raw?.robux ?? raw?.robuxValue ?? raw?.robux_value) ?? fallback?.robux ?? 0),
      category: String(raw?.category || fallback?.category || CATEGORY_BY_SLUG[slug] || 'utility').toLowerCase(),
      sortOrder: finiteNumber(raw?.sortOrder ?? raw?.sort_order) ?? fallback?.sortOrder ?? index + 1,
      image: safeImagePath(raw?.image ?? raw?.imagePath ?? raw?.image_path, slug),
      offering: {
        priceMad: priceMad !== null && priceMad >= 0 ? priceMad : null,
        availability: quantityAvailable === 0 && availability === 'available' ? 'out_of_stock' : availability,
        quantityAvailable: quantityAvailable !== null && quantityAvailable >= 0 ? Math.floor(quantityAvailable) : null,
        needsOwnerReview: Boolean(offering?.needsOwnerReview ?? offering?.needs_owner_review),
        version: Math.max(0, finiteNumber(offering?.version) ?? 0),
        updatedAt: offering?.updatedAt ?? offering?.updated_at ?? null
      },
      source: 'api'
    };
  }

  function formatNumber(value) {
    return new Intl.NumberFormat(currentLanguage() === 'ary' ? 'fr-MA' : 'fr-FR', {
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatMad(value) {
    return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(value)} MAD`;
  }

  function descriptionFor(gamePass) {
    const localized = l(`description.${gamePass.id}`, '');
    return localized || gamePass.description || '';
  }

  function categoryLabel(category) {
    return l(`category.${category}`, category);
  }

  function availabilityView(gamePass) {
    const offering = gamePass.offering;
    if (offering.availability === 'out_of_stock') {
      return { className: 'is-out', label: l('availability.outOfStock', 'Rupture de stock'), orderable: false };
    }
    if (offering.needsOwnerReview) {
      return { className: 'is-review', label: l('availability.review', 'À confirmer'), orderable: true };
    }
    if (offering.availability === 'on_request') {
      return { className: 'is-request', label: l('availability.onRequest', 'Sur demande'), orderable: true };
    }
    return { className: 'is-available', label: l('availability.available', 'Disponible'), orderable: true };
  }

  function stockLabel(gamePass) {
    const { offering } = gamePass;
    if (offering.availability === 'out_of_stock') return l('availability.outOfStock', 'Rupture de stock');
    if (offering.needsOwnerReview || offering.availability === 'on_request') return l('stock.confirm', 'Stock à confirmer');
    if (offering.quantityAvailable !== null) {
      return l('stock.count', `${offering.quantityAvailable} en stock`, { count: offering.quantityAvailable });
    }
    return l('stock.available', 'Stock disponible');
  }

  function isRequestOnly(gamePass) {
    const offering = gamePass?.offering;
    return !offering
      || offering.priceMad === null
      || offering.needsOwnerReview
      || offering.availability === 'on_request';
  }

  function maxQuantity(gamePass) {
    const stock = gamePass?.offering?.quantityAvailable;
    return Number.isFinite(stock) && stock > 0 ? Math.min(10, stock) : 10;
  }

  function gamePassById(id) {
    return state.gamePasses.find((gamePass) => gamePass.id === id);
  }

  function safeReadCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({ id: normalizeSlug(item?.id), quantity: Math.floor(Number(item?.quantity)) }))
        .filter((item) => item.id && Number.isFinite(item.quantity) && item.quantity > 0)
        .slice(0, 20);
    } catch (error) {
      return [];
    }
  }

  function persistCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
    } catch (error) {
      // The cart remains usable for the current page session.
    }
  }

  function reconcileCart() {
    state.cart = state.cart
      .map((item) => {
        const gamePass = gamePassById(item.id);
        if (!gamePass || gamePass.offering.availability === 'hidden' || gamePass.offering.availability === 'out_of_stock') return null;
        return { id: item.id, quantity: Math.min(item.quantity, maxQuantity(gamePass)) };
      })
      .filter(Boolean);
    persistCart();
  }

  function visibleGamePasses() {
    const query = state.search
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const filtered = state.gamePasses.filter((gamePass) => {
      if (gamePass.offering.availability === 'hidden') return false;
      if (state.category !== 'all' && gamePass.category !== state.category) return false;
      if (!query) return true;
      const haystack = `${gamePass.name} ${descriptionFor(gamePass)} ${categoryLabel(gamePass.category)}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return haystack.includes(query);
    });

    return filtered.sort((a, b) => {
      if (state.sort === 'robux-asc') return a.robux - b.robux || a.name.localeCompare(b.name);
      if (state.sort === 'robux-desc') return b.robux - a.robux || a.name.localeCompare(b.name);
      if (state.sort === 'price-asc') {
        const aPrice = a.offering.priceMad ?? Number.POSITIVE_INFINITY;
        const bPrice = b.offering.priceMad ?? Number.POSITIVE_INFINITY;
        return aPrice - bPrice || a.sortOrder - b.sortOrder;
      }
      if (state.sort === 'name') return a.name.localeCompare(b.name);
      return a.sortOrder - b.sortOrder;
    });
  }

  function renderCatalogue() {
    const grid = byId('gamepass-grid');
    const empty = byId('gamepass-empty');
    const results = visibleGamePasses();
    if (!grid || !empty) return;

    grid.setAttribute('aria-busy', 'false');
    byId('gamepass-results-count').textContent = l('results.count', `${results.length} Game Pass(es) disponible(s)`, { count: results.length });
    const filtersActive = Boolean(state.search || state.category !== 'all' || state.sort !== 'featured');
    byId('gamepass-reset-filters').hidden = !filtersActive;

    if (!results.length) {
      const catalogueEmpty = state.gamePasses.length === 0 && !filtersActive;
      const emptyIcon = $('i', empty);
      const emptyTitle = $('h3', empty);
      const emptyCopy = $('p', empty);
      const emptyReset = $('[data-reset-gamepass-filters]', empty);
      emptyIcon.className = catalogueEmpty ? 'fa-solid fa-box-open' : 'fa-solid fa-magnifying-glass';
      emptyTitle.textContent = l(catalogueEmpty ? 'empty.catalogueTitle' : 'empty.title', 'Aucun Game Pass trouvé');
      emptyCopy.textContent = l(catalogueEmpty ? 'empty.catalogueCopy' : 'empty.copy', 'Essaie un autre mot ou réinitialise les filtres.');
      emptyReset.hidden = catalogueEmpty;
      grid.innerHTML = '';
      grid.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    grid.hidden = false;
    grid.innerHTML = results.map((gamePass) => {
      const availability = availabilityView(gamePass);
      const price = gamePass.offering.priceMad;
      const requestOnly = isRequestOnly(gamePass);
      const actionLabel = !availability.orderable
        ? l('card.unavailable', 'Indisponible')
        : requestOnly
          ? l('card.ask', 'Demander la disponibilité')
          : l('card.add', 'Ajouter à la demande');
      const buttonIcon = requestOnly ? 'fa-regular fa-message' : 'fa-solid fa-plus';
      const priceText = price === null ? l('price.onRequest', 'Sur demande') : formatMad(price);
      const cardClass = availability.orderable ? '' : ' is-unavailable';
      return `
        <article class="gamepass-card${cardClass}" data-gamepass-id="${escapeAttribute(gamePass.id)}">
          <div class="gamepass-card-visual">
            <img src="${escapeAttribute(gamePass.image)}" alt="${escapeAttribute(gamePass.name)}" width="512" height="512" loading="lazy" decoding="async" data-gamepass-image="${escapeAttribute(gamePass.id)}">
            <span class="gamepass-type-badge"><i class="fa-solid fa-infinity" aria-hidden="true"></i> ${escapeHtml(l('card.permanent', 'PASS PERMANENT'))}</span>
            <span class="availability-chip ${availability.className}">${escapeHtml(availability.label)}</span>
          </div>
          <div class="gamepass-card-body">
            <div class="gamepass-card-heading">
              <div><span class="gamepass-category-label">${escapeHtml(categoryLabel(gamePass.category))}</span><h3>${escapeHtml(gamePass.name)}</h3></div>
              <span class="gamepass-robux" title="${escapeAttribute(l('card.wikiValue', 'Valeur wiki'))}"><i class="fa-solid fa-gem" aria-hidden="true"></i> ${escapeHtml(formatNumber(gamePass.robux))} R$</span>
            </div>
            <p class="gamepass-card-copy">${escapeHtml(descriptionFor(gamePass))}</p>
            <div class="gamepass-price-row">
              <span class="gamepass-price"><small>${escapeHtml(l('card.itemsouqPrice', 'Prix Itemsouq'))}</small><strong>${escapeHtml(priceText)}</strong></span>
              <span class="gamepass-stock"><i class="fa-solid fa-box" aria-hidden="true"></i> ${escapeHtml(stockLabel(gamePass))}</span>
            </div>
            <button class="gamepass-card-action${requestOnly ? ' is-request' : ''}" type="button" data-add-gamepass="${escapeAttribute(gamePass.id)}" ${availability.orderable ? '' : 'disabled'} aria-label="${escapeAttribute(l('aria.add', `Ajouter ${gamePass.name} à la demande`, { name: gamePass.name }))}"><i class="${buttonIcon}" aria-hidden="true"></i><span>${escapeHtml(actionLabel)}</span></button>
          </div>
        </article>`;
    }).join('');

    $$('[data-gamepass-image]', grid).forEach((image) => {
      image.addEventListener('error', () => {
        const id = image.dataset.gamepassImage;
        const fallback = IMAGE_BY_SLUG[id] || IMAGE_BY_SLUG.mastery;
        if (!image.src.endsWith(fallback)) image.src = fallback;
      }, { once: true });
    });
  }

  function renderDataStatus() {
    const status = byId('gamepass-data-status');
    if (!status) return;
    const icon = $('.status-icon i', status);
    const text = $('span:last-child', status);
    status.className = 'gamepass-data-status';
    if (state.apiStatus === 'live' && state.gamePasses.length === 0) {
      status.classList.add('is-review');
      icon.className = 'fa-solid fa-box-open';
      text.textContent = l('status.empty', 'Aucun Game Pass n’est publié pour le moment.');
    } else if (state.apiStatus === 'live' && state.reviewCount === 0) {
      status.classList.add('is-live');
      icon.className = 'fa-solid fa-circle-check';
      text.textContent = l('status.live', 'Prix et disponibilités mis à jour par Itemsouq.');
    } else if (state.apiStatus === 'live') {
      status.classList.add('is-review');
      icon.className = 'fa-solid fa-clock';
      text.textContent = l('status.review', 'Catalogue chargé : certains prix attendent encore la confirmation du propriétaire.');
    } else if (state.apiStatus === 'fallback') {
      status.classList.add('is-fallback');
      icon.className = 'fa-solid fa-cloud-arrow-down';
      text.textContent = l('status.fallback', 'Connexion à la base indisponible : catalogue de référence chargé, prix à demander sur WhatsApp.');
    } else {
      status.classList.add('is-loading');
      icon.className = 'fa-solid fa-circle-notch fa-spin';
      text.textContent = l('status.loading', 'Chargement des prix et disponibilités Itemsouq…');
    }
  }

  function cartQuantity() {
    return state.cart.reduce((total, item) => total + item.quantity, 0);
  }

  function cartTotals() {
    let knownTotal = 0;
    let requestCount = 0;
    state.cart.forEach((item) => {
      const gamePass = gamePassById(item.id);
      if (!gamePass) return;
      if (isRequestOnly(gamePass)) requestCount += item.quantity;
      else knownTotal += gamePass.offering.priceMad * item.quantity;
    });
    return { knownTotal, requestCount };
  }

  function buildWhatsAppMessage() {
    const lines = state.cart.map((item) => {
      const gamePass = gamePassById(item.id);
      if (!gamePass) return '';
      const price = gamePass.offering.priceMad;
      if (price === null) {
        return l('whatsapp.lineRequest', `• ${gamePass.name} × ${item.quantity} — prix sur demande`, { name: gamePass.name, quantity: item.quantity });
      }
      const formattedTotal = formatMad(price * item.quantity);
      return isRequestOnly(gamePass)
        ? l('whatsapp.lineReview', `• ${gamePass.name} × ${item.quantity} — ${formattedTotal} indicatif, à confirmer`, { name: gamePass.name, quantity: item.quantity, price: formattedTotal })
        : l('whatsapp.lineKnown', `• ${gamePass.name} × ${item.quantity} — ${formattedTotal}`, { name: gamePass.name, quantity: item.quantity, price: formattedTotal });
    }).filter(Boolean);
    const { knownTotal, requestCount } = cartTotals();
    const message = [
      l('whatsapp.greeting', 'Salam Itemsouq 👋'),
      '',
      l('whatsapp.intro', 'Je souhaite vérifier cette demande de Game Passes :'),
      ...lines,
      '',
      ...(knownTotal > 0 ? [l('whatsapp.total', `Total affiché : ${formatMad(knownTotal)}`, { total: formatMad(knownTotal) })] : []),
      ...(requestCount > 0 ? [l('whatsapp.requestNotice', 'Un ou plusieurs prix sont à confirmer.')] : []),
      l('whatsapp.closing', 'Merci de confirmer le stock, le prix final et la livraison dans Roblox avant tout paiement.')
    ];
    return message.join('\n');
  }

  function whatsappUrl(message) {
    const recipient = sellerWhatsAppNumber ? `/${sellerWhatsAppNumber}` : '';
    return `https://wa.me${recipient}/?text=${encodeURIComponent(message)}`;
  }

  function renderCart() {
    const quantity = cartQuantity();
    const count = byId('gamepass-cart-count');
    const mobileCount = byId('gamepass-mobile-cart-count');
    const headingCount = byId('gamepass-cart-heading-count');
    count.textContent = quantity;
    mobileCount.textContent = quantity;
    mobileCount.hidden = quantity === 0;
    headingCount.textContent = `(${quantity})`;

    const body = byId('gamepass-cart-body');
    const footer = byId('gamepass-cart-footer');
    if (!quantity) {
      body.innerHTML = `
        <div class="drawer-empty">
          <span><i class="fa-solid fa-ticket" aria-hidden="true"></i></span>
          <h3>${escapeHtml(l('cart.emptyTitle', 'Ta demande est vide'))}</h3>
          <p>${escapeHtml(l('cart.emptyCopy', 'Ajoute un Game Pass depuis le catalogue pour commencer.'))}</p>
          <button class="btn btn-primary" type="button" data-cart-browse>${escapeHtml(l('cart.browse', 'Voir les Game Passes'))}</button>
        </div>`;
      footer.hidden = true;
      return;
    }

    body.innerHTML = state.cart.map((item) => {
      const gamePass = gamePassById(item.id);
      if (!gamePass) return '';
      const price = gamePass.offering.priceMad;
      const formattedPrice = price === null ? null : formatMad(price * item.quantity);
      const linePrice = price === null
        ? l('price.onRequest', 'Sur demande')
        : isRequestOnly(gamePass)
          ? l('price.toConfirm', `${formattedPrice} · à confirmer`, { price: formattedPrice })
          : formattedPrice;
      const maximum = maxQuantity(gamePass);
      return `
        <article class="cart-line">
          <span class="cart-line-visual"><img src="${escapeAttribute(gamePass.image)}" alt="" width="64" height="64"></span>
          <div class="cart-line-main">
            <h3>${escapeHtml(gamePass.name)}</h3>
            <p>${escapeHtml(categoryLabel(gamePass.category))} · ${escapeHtml(formatNumber(gamePass.robux))} Robux</p>
            <strong class="cart-line-price">${escapeHtml(linePrice)}</strong>
            <div class="cart-quantity">
              <button type="button" data-cart-decrease="${escapeAttribute(gamePass.id)}" aria-label="${escapeAttribute(l('aria.decrease', `Diminuer la quantité de ${gamePass.name}`, { name: gamePass.name }))}"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-increase="${escapeAttribute(gamePass.id)}" ${item.quantity >= maximum ? 'disabled' : ''} aria-label="${escapeAttribute(l('aria.increase', `Augmenter la quantité de ${gamePass.name}`, { name: gamePass.name }))}"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
            </div>
          </div>
          <button class="cart-line-remove" type="button" data-cart-remove="${escapeAttribute(gamePass.id)}" aria-label="${escapeAttribute(l('aria.remove', `Retirer ${gamePass.name}`, { name: gamePass.name }))}"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
        </article>`;
    }).join('');
    footer.hidden = false;

    const { knownTotal, requestCount } = cartTotals();
    const total = byId('gamepass-cart-total');
    total.classList.toggle('has-request-items', requestCount > 0);
    if (requestCount > 0 && knownTotal > 0) {
      total.textContent = l('cart.totalWithRequest', `${formatMad(knownTotal)} + prix sur demande`, { total: formatMad(knownTotal) });
    } else if (requestCount > 0) {
      total.textContent = l('price.onRequest', 'Sur demande');
    } else {
      total.textContent = formatMad(knownTotal);
    }
    byId('gamepass-cart-whatsapp').href = whatsappUrl(buildWhatsAppMessage());
  }

  function showToast(message, warning = false) {
    const toast = byId('gamepass-toast');
    byId('gamepass-toast-message').textContent = message;
    toast.classList.toggle('gamepass-page-toast-warning', warning);
    $('.toast-icon i', toast).className = warning ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-check';
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2800);
  }

  function addToCart(id) {
    const gamePass = gamePassById(id);
    if (!gamePass || gamePass.offering.availability === 'hidden' || gamePass.offering.availability === 'out_of_stock') return;
    const current = state.cart.find((item) => item.id === id);
    if (current) {
      if (current.quantity >= maxQuantity(gamePass)) {
        showToast(l('toast.max', `Quantité maximale atteinte pour ${gamePass.name}.`, { name: gamePass.name }), true);
        return;
      }
      current.quantity += 1;
    } else {
      state.cart.push({ id, quantity: 1 });
    }
    persistCart();
    renderCart();
    showToast(l('toast.added', `${gamePass.name} ajouté à ta demande.`, { name: gamePass.name }));
  }

  function changeCartQuantity(id, direction) {
    const item = state.cart.find((entry) => entry.id === id);
    const gamePass = gamePassById(id);
    if (!item || !gamePass) return;
    if (direction > 0 && item.quantity >= maxQuantity(gamePass)) {
      showToast(l('toast.max', `Quantité maximale atteinte pour ${gamePass.name}.`, { name: gamePass.name }), true);
      return;
    }
    item.quantity += direction;
    if (item.quantity <= 0) state.cart = state.cart.filter((entry) => entry.id !== id);
    persistCart();
    renderCart();
  }

  function removeFromCart(id) {
    const gamePass = gamePassById(id);
    state.cart = state.cart.filter((item) => item.id !== id);
    persistCart();
    renderCart();
    if (gamePass) showToast(l('toast.removed', `${gamePass.name} retiré de ta demande.`, { name: gamePass.name }));
  }

  function openCart(trigger) {
    cartReturnFocus = trigger || document.activeElement;
    byId('gamepass-cart-backdrop').hidden = false;
    byId('gamepass-cart').hidden = false;
    document.body.classList.add('overlay-open');
    $$('[data-open-gamepass-cart]').forEach((button) => button.setAttribute('aria-expanded', 'true'));
    requestAnimationFrame(() => byId('gamepass-cart-title').focus());
  }

  function closeCart() {
    if (byId('gamepass-cart').hidden) return;
    byId('gamepass-cart-backdrop').hidden = true;
    byId('gamepass-cart').hidden = true;
    document.body.classList.remove('overlay-open');
    $$('[data-open-gamepass-cart]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
    if (cartReturnFocus && document.contains(cartReturnFocus)) cartReturnFocus.focus();
  }

  function trapCartFocus(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCart();
      return;
    }
    if (event.key !== 'Tab') return;
    const drawer = byId('gamepass-cart');
    if (drawer.hidden) return;
    const focusable = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', drawer)
      .filter((element) => !element.hidden);
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

  function resetFilters() {
    state.search = '';
    state.category = 'all';
    state.sort = 'featured';
    byId('gamepass-search').value = '';
    byId('gamepass-sort').value = 'featured';
    $$('[data-gamepass-category]').forEach((button) => {
      const active = button.dataset.gamepassCategory === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderCatalogue();
  }

  function applyOwnTranslations() {
    $$('[data-gp-i18n]').forEach((element) => {
      element.textContent = l(element.dataset.gpI18n, element.textContent);
    });
    $$('[data-gp-i18n-html]').forEach((element) => {
      element.innerHTML = l(element.dataset.gpI18nHtml, element.innerHTML);
    });
    $$('[data-gp-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', l(element.dataset.gpI18nPlaceholder, element.getAttribute('placeholder') || ''));
    });
    $$('[data-gp-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', l(element.dataset.gpI18nAria, element.getAttribute('aria-label') || ''));
    });
    $$('[data-gp-i18n-content]').forEach((element) => {
      element.setAttribute('content', l(element.dataset.gpI18nContent, element.getAttribute('content') || ''));
    });
    byId('gamepass-general-whatsapp').href = whatsappUrl(l('whatsapp.general', 'Salam Itemsouq, je veux des informations sur vos Game Passes Blox Fruits.'));
    byId('gamepass-whatsapp-fab').href = byId('gamepass-general-whatsapp').href;
    renderDataStatus();
    renderCatalogue();
    renderCart();
  }

  async function loadGamePasses() {
    state.apiStatus = 'loading';
    renderDataStatus();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.ok === false) throw new Error(payload?.error?.message || 'API error');
      const rawItems = payload?.data?.gamePasses ?? payload?.gamePasses;
      if (!Array.isArray(rawItems)) throw new Error('Invalid catalogue');
      const normalized = rawItems.map(normalizeGamePass).filter(Boolean);
      if (rawItems.length > 0 && !normalized.length) throw new Error('Invalid catalogue');
      state.gamePasses = normalized;
      state.reviewCount = finiteNumber(payload?.meta?.reviewCount) ?? normalized.filter((item) => item.offering.needsOwnerReview).length;
      state.apiStatus = 'live';
    } catch (error) {
      state.gamePasses = FALLBACK_GAME_PASSES.map((item) => ({ ...item, offering: { ...item.offering } }));
      state.reviewCount = state.gamePasses.length;
      state.apiStatus = 'fallback';
    } finally {
      window.clearTimeout(timeout);
    }
    reconcileCart();
    renderDataStatus();
    renderCatalogue();
    renderCart();
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const add = event.target.closest('[data-add-gamepass]');
      if (add) addToCart(add.dataset.addGamepass);

      const category = event.target.closest('[data-gamepass-category]');
      if (category) {
        state.category = category.dataset.gamepassCategory;
        $$('[data-gamepass-category]').forEach((button) => {
          const active = button === category;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        });
        renderCatalogue();
      }

      const open = event.target.closest('[data-open-gamepass-cart]');
      if (open) openCart(open);
      if (event.target.closest('[data-close-gamepass-cart]')) closeCart();

      const decrease = event.target.closest('[data-cart-decrease]');
      if (decrease) changeCartQuantity(decrease.dataset.cartDecrease, -1);
      const increase = event.target.closest('[data-cart-increase]');
      if (increase) changeCartQuantity(increase.dataset.cartIncrease, 1);
      const remove = event.target.closest('[data-cart-remove]');
      if (remove) removeFromCart(remove.dataset.cartRemove);

      if (event.target.closest('[data-cart-browse]')) {
        closeCart();
        byId('gamepass-catalogue').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
      if (event.target.closest('[data-reset-gamepass-filters]') || event.target.closest('#gamepass-reset-filters')) resetFilters();
    });

    byId('gamepass-search').addEventListener('input', (event) => {
      state.search = event.target.value.trim();
      renderCatalogue();
    });

    byId('gamepass-sort').addEventListener('change', (event) => {
      state.sort = event.target.value;
      renderCatalogue();
    });

    byId('gamepass-clear-cart').addEventListener('click', () => {
      state.cart = [];
      persistCart();
      renderCart();
      showToast(l('toast.cleared', 'Demande vidée.'));
    });

    const mobileMenuTrigger = $('.mobile-menu-trigger');
    const mobileMenu = byId('mobile-menu');
    mobileMenuTrigger?.addEventListener('click', () => {
      const opening = mobileMenu.hidden;
      mobileMenu.hidden = !opening;
      mobileMenuTrigger.setAttribute('aria-expanded', String(opening));
      mobileMenuTrigger.setAttribute('aria-label', l(opening ? 'aria.closeMenu' : 'aria.openMenu', opening ? 'Fermer le menu' : 'Ouvrir le menu'));
      $('i', mobileMenuTrigger).className = opening ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });

    document.addEventListener('keydown', (event) => {
      if (!byId('gamepass-cart').hidden) {
        trapCartFocus(event);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        byId('gamepass-search').focus();
      }
    });

    document.addEventListener('itemsouq:languagechange', applyOwnTranslations);
  }

  function init() {
    state.cart = safeReadCart();
    state.gamePasses = FALLBACK_GAME_PASSES.map((item) => ({ ...item, offering: { ...item.offering } }));
    bindEvents();
    applyOwnTranslations();
    loadGamePasses();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
