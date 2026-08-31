/* Itemsouq shared French / Moroccan Darija UI copy */
(function () {
  'use strict';

  const STORAGE_KEY = 'itemsouq:ui:v1:language';
  const SUPPORTED = new Set(['fr', 'ary']);
  const dictionary = {
    fr: {
      'language.name': 'Français',
      'language.toggle': 'Interface en Darija',
      'language.switchToDarija': 'Afficher le site en Darija',
      'language.switchToFrench': 'Afficher le site en français',
      'nav.home': 'Accueil',
      'nav.catalogue': 'Catalogue',
      'nav.trading': 'Trading',
      'nav.how': 'Comment acheter',
      'nav.faq': 'FAQ',
      'nav.souq': 'Mon Souq',
      'nav.order': 'Commande',
      'announcement.safe': 'Commande vérifiée manuellement sur WhatsApp',
      'header.order': 'Ma commande',
      'hero.eyebrow': 'Marketplace marocain · Démo',
      'hero.title': 'Tes fruits préférés,<br><span>livrés en jeu.</span>',
      'hero.copy': 'Choisis un fruit physique ou permanent, confirme ton prix en dirhams et finalise ta commande avec un vendeur sur WhatsApp.',
      'hero.explore': 'Explorer les fruits',
      'hero.whatsapp': 'Ouvrir WhatsApp',
      'catalogue.kicker': 'LA BOUTIQUE',
      'catalogue.title': 'Trouve ton prochain fruit',
      'catalogue.copy': 'Les images, valeurs Beli et valeurs Robux viennent du wiki. Les prix MAD affichés sont des prix de démonstration à confirmer avec le vendeur.',
      'catalogue.search': 'Rechercher Dragon, Buddha…',
      'budget.title': 'Ton budget démo',
      'budget.all': 'Tous les budgets',
      'budget.upTo': "Jusqu'à {amount}",
      'card.preview': 'Aperçu',
      'card.compare': 'Comparer',
      'card.compared': 'Sélectionné',
      'card.add': 'Ajouter',
      'card.wiki': 'Valeur wiki',
      'card.demoPrice': 'Prix démo Itemsouq',
      'card.stock': 'Stock démo {count}',
      'rarity.Common': 'Commun',
      'rarity.Uncommon': 'Peu commun',
      'rarity.Rare': 'Rare',
      'rarity.Legendary': 'Légendaire',
      'rarity.Mythical': 'Mythique',
      'type.Natural': 'Naturel',
      'type.Elemental': 'Élémentaire',
      'type.Beast': 'Bête',
      'fact.type': 'Type',
      'fact.rarity': 'Rareté',
      'fact.stock': 'Stock démo',
      'compare.fruit': 'Fruit',
      'compare.demoPrice': 'Prix démo',
      'compare.order': 'Commande',
      'mode.physical': 'Physique',
      'mode.permanent': 'Permanent',
      'mode.physicalLong': 'Fruit physique',
      'mode.permanentLong': 'Fruit permanent',
      'quick.kicker': 'APERÇU DU FRUIT',
      'quick.add': 'Ajouter à la commande',
      'quick.share': 'Partager',
      'compare.title': 'Comparer les fruits',
      'compare.open': 'Comparer ({count})',
      'compare.clear': 'Tout retirer',
      'compare.needTwo': 'Ajoute au moins 2 fruits pour comparer.',
      'souq.kicker': 'TON ESPACE LOCAL',
      'souq.title': 'Mon Souq',
      'souq.subtitle': 'Tes choix restent uniquement dans ce navigateur.',
      'souq.favorites': 'Favoris',
      'souq.recent': 'Vus récemment',
      'souq.cart': 'Dans la commande',
      'souq.savedTrades': 'Trades sauvegardés',
      'souq.preferences': 'Mes préférences',
      'souq.payment': 'Paiement préféré',
      'souq.city': 'Ville',
      'souq.save': 'Enregistrer',
      'souq.emptyRecent': "Ouvre l’aperçu d’un fruit pour le retrouver ici.",
      'souq.emptyFavorites': 'Ajoute des fruits aux favoris pour les retrouver ici.',
      'order.step.selection': 'Sélection',
      'order.step.details': 'Préférences',
      'order.step.whatsapp': 'WhatsApp',
      'order.state.complete': 'étape terminée',
      'order.state.current': 'étape actuelle',
      'order.state.upcoming': 'à venir',
      'share.copied': 'Le résumé a été copié.',
      'share.ready': 'Partage prêt.',
      'mobile.home': 'Accueil',
      'mobile.shop': 'Boutique',
      'mobile.trade': 'Trading',
      'mobile.souq': 'Mon Souq',
      'mobile.order': 'Commande',
      'trading.heroEyebrow': 'Communauté marocaine · Prototype',
      'trading.heroTitle': 'Ton fruit contre<br><span>leur meilleure offre.</span>',
      'trading.create': 'Publier une offre',
      'trading.feed': 'Voir les offres',
      'trading.share': 'Partager l’offre',
      'trading.saveDraft': 'Enregistrer le brouillon',
      'trading.restoreDraft': 'Reprendre le brouillon',
      'trade.new.short': 'Offre',
      'trading.status.open': 'Ouverte',
      'trading.status.completed': 'Terminée',
      'trading.give': 'Propose',
      'trading.want': 'Recherche',
      'trading.wikiValue': 'Valeur wiki',
      'trading.shareShort': 'Partager',
      'trading.manage': 'Gérer',
      'trading.prepare': 'Préparer une offre',
      'trading.view': 'Voir',
      'trading.localResults': '{count} · données locales',
      'trading.noneSelected': 'Aucun fruit sélectionné',
      'trading.noneFound': 'Aucun fruit trouvé.',
      'trading.mode.physical': 'Physique',
      'trading.mode.permanent': 'Permanent',
      'trading.now': 'à l’instant',
      'trading.minutesAgo': 'il y a {count} min',
      'trading.hoursAgo': 'il y a {count} h',
      'trading.daysAgo': 'il y a {count} j'
    },
    ary: {
      'language.name': 'Darija',
      'language.toggle': 'Interface b Darija',
      'language.switchToDarija': 'Beddel site l Darija',
      'language.switchToFrench': 'Beddel site l français',
      'nav.home': 'Rrissiya',
      'nav.catalogue': 'Lfruits',
      'nav.trading': 'Tbdal',
      'nav.how': 'Kifach tchri',
      'nav.faq': 'As2ila',
      'nav.souq': 'Souqi',
      'nav.order': 'Commande',
      'announcement.safe': 'Kan2akdo mn commande b WhatsApp',
      'header.order': 'Commandti',
      'hero.eyebrow': 'Marketplace maghribi · Démo',
      'hero.title': 'Lfruits li katbghi,<br><span>kaywslo lik f game.</span>',
      'hero.copy': 'Khtar fruit physique wela permanent, chouf taman b dirham, w kmel commande m3a vendeur f WhatsApp.',
      'hero.explore': 'Chouf lfruits',
      'hero.whatsapp': '7ell WhatsApp',
      'catalogue.kicker': 'LBOUTIQUE',
      'catalogue.title': 'L9a fruit jdid dyalk',
      'catalogue.copy': 'Tsawer w 9iyam Beli/Robux jayine mn wiki. Atmina MAD ghir démo, khas vendeur y2akedhom.',
      'catalogue.search': 'Qelleb 3la Dragon, Buddha…',
      'budget.title': 'Budget démo dyalk',
      'budget.all': 'Ga3 l budgets',
      'budget.upTo': '7tta {amount}',
      'card.preview': 'Chouf',
      'card.compare': 'Qaren',
      'card.compared': 'Mkhayyer',
      'card.add': 'Zid',
      'card.wiki': '9ima wiki',
      'card.demoPrice': 'Taman démo Itemsouq',
      'card.stock': 'Stock démo {count}',
      'rarity.Common': '3adi',
      'rarity.Uncommon': 'Machy cha2i3',
      'rarity.Rare': 'Nader',
      'rarity.Legendary': 'Ostori',
      'rarity.Mythical': 'Mythique',
      'type.Natural': 'Tabi3i',
      'type.Elemental': '3onsori',
      'type.Beast': 'Wa7ch',
      'fact.type': 'Naw3',
      'fact.rarity': 'Nodora',
      'fact.stock': 'Stock démo',
      'compare.fruit': 'Fruit',
      'compare.demoPrice': 'Taman démo',
      'compare.order': 'Commande',
      'mode.physical': 'Physique',
      'mode.permanent': 'Permanent',
      'mode.physicalLong': 'Fruit physique',
      'mode.permanentLong': 'Fruit permanent',
      'quick.kicker': 'CHOUF LFRUIT',
      'quick.add': 'Zid l commande',
      'quick.share': 'Partaji',
      'compare.title': 'Qaren lfruits',
      'compare.open': 'Qaren ({count})',
      'compare.clear': '7yed kolchi',
      'compare.needTwo': 'Khtar 2 fruits 3la l2a9al bach t9aren.',
      'souq.kicker': 'L ESPACE DYALK',
      'souq.title': 'Souqi',
      'souq.subtitle': 'Ikhtiyarat dyalk kayb9aw ghir f had navigateur.',
      'souq.favorites': 'Li 3ajbok',
      'souq.recent': 'Li chefti daba',
      'souq.cart': 'F commande',
      'souq.savedTrades': 'Trades msajlin',
      'souq.preferences': 'Ikhtiyarat dyali',
      'souq.payment': 'Tari9at paiement',
      'souq.city': 'Lmdina',
      'souq.save': 'Sajjel',
      'souq.emptyRecent': '7ell aperçu dyal chi fruit bach yban hna.',
      'souq.emptyFavorites': 'Zid 9elb l chi fruit bach tl9ah hna.',
      'order.step.selection': 'Lfruits',
      'order.step.details': 'Ikhtiyarat',
      'order.step.whatsapp': 'WhatsApp',
      'order.state.complete': 'salat',
      'order.state.current': 'daba',
      'order.state.upcoming': 'mazal',
      'share.copied': 'Résumé tcopya.',
      'share.ready': 'Partage wajed.',
      'mobile.home': 'Rrissiya',
      'mobile.shop': 'Lfruits',
      'mobile.trade': 'Tbdal',
      'mobile.souq': 'Souqi',
      'mobile.order': 'Commande',
      'trading.heroEyebrow': 'Communauté maghribiya · Prototype',
      'trading.heroTitle': 'Fruit dyalk m3a<br><span>a7san offre.</span>',
      'trading.create': 'Ncher offre',
      'trading.feed': 'Chouf l offres',
      'trading.share': 'Partaji l offre',
      'trading.saveDraft': 'Sajjel brouillon',
      'trading.restoreDraft': 'Kmel brouillon',
      'trade.new.short': 'Offre',
      'trading.status.open': 'Ma7loula',
      'trading.status.completed': 'Salat',
      'trading.give': 'Kay3ti',
      'trading.want': 'Kayqelleb 3la',
      'trading.wikiValue': '9ima wiki',
      'trading.shareShort': 'Partaji',
      'trading.manage': 'Siyyer',
      'trading.prepare': 'Wjjed offre',
      'trading.view': 'Chouf',
      'trading.localResults': '{count} · données f had appareil',
      'trading.noneSelected': 'Mazal ma khtarti 7tta fruit',
      'trading.noneFound': 'Ma l9ina 7tta fruit.',
      'trading.mode.physical': 'Physique',
      'trading.mode.permanent': 'Permanent',
      'trading.now': 'daba',
      'trading.minutesAgo': 'mn {count} min',
      'trading.hoursAgo': 'mn {count} sa3a',
      'trading.daysAgo': 'mn {count} nhar'
    }
  };

  function safeReadLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.has(stored) ? stored : 'fr';
    } catch (error) {
      return 'fr';
    }
  }

  let language = safeReadLanguage();

  function interpolate(value, variables) {
    return String(value).replace(/\{(\w+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(variables || {}, key) ? variables[key] : match
    ));
  }

  function t(key, fallback = key, variables = {}) {
    const value = dictionary[language]?.[key] ?? dictionary.fr[key] ?? fallback;
    return interpolate(value, variables);
  }

  function applyStatic(root = document) {
    document.documentElement.lang = language === 'ary' ? 'ary-Latn' : 'fr';
    document.body?.classList.toggle('language-darija', language === 'ary');

    root.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      element.textContent = t(key, element.textContent);
    });

    root.querySelectorAll('[data-i18n-html]').forEach((element) => {
      const key = element.dataset.i18nHtml;
      element.innerHTML = t(key, element.innerHTML);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder, element.getAttribute('placeholder') || ''));
    });

    root.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      element.setAttribute('aria-label', t(element.dataset.i18nAria, element.getAttribute('aria-label') || ''));
    });

    root.querySelectorAll('[data-language-label]').forEach((element) => {
      element.textContent = language === 'fr' ? 'FR' : 'DRJ';
    });

    root.querySelectorAll('[data-language-toggle]').forEach((element) => {
      element.setAttribute('aria-label', t('language.toggle', 'Interface en Darija'));
      element.setAttribute('aria-pressed', String(language === 'ary'));
    });
  }

  function setLanguage(nextLanguage) {
    if (!SUPPORTED.has(nextLanguage) || nextLanguage === language) return;
    language = nextLanguage;
    try { localStorage.setItem(STORAGE_KEY, language); } catch (error) { /* UI still works for this session. */ }
    applyStatic();
    document.dispatchEvent(new CustomEvent('itemsouq:languagechange', { detail: { language } }));
  }

  function toggleLanguage() {
    setLanguage(language === 'fr' ? 'ary' : 'fr');
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-language-toggle]')) toggleLanguage();
  });

  window.ITEMSOUQ_I18N = {
    applyStatic,
    getLanguage: () => language,
    setLanguage,
    t
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyStatic(), { once: true });
  } else {
    applyStatic();
  }
})();
