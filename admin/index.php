<?php
declare(strict_types=1);

header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Itemsouq · Espace propriétaire</title>
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="admin.css?v=20260905-2">
</head>
<body>
  <header class="topbar">
    <a class="brand" href="../index.html" aria-label="Retour à Itemsouq">
      <img src="../assets/brand/itemsouq-mark.svg" width="42" height="42" alt="">
      <span><strong>ITEMSOUQ</strong><small>ESPACE PROPRIÉTAIRE</small></span>
    </a>
    <div class="owner-tools" id="owner-tools" hidden>
      <span id="owner-label"></span>
      <button class="button ghost" id="logout-button" type="button">Déconnexion</button>
    </div>
  </header>

  <main>
    <section class="auth-panel" id="auth-panel" aria-labelledby="auth-title">
      <div class="auth-copy">
        <span class="eyebrow">ACCÈS PRIVÉ</span>
        <h1 id="auth-title">Gérer Itemsouq</h1>
        <p>Prix, disponibilités et suivi des demandes WhatsApp, dans un seul espace.</p>
      </div>

      <form id="login-form" class="auth-form" novalidate>
        <h2>Connexion propriétaire</h2>
        <label>Identifiant<input name="username" type="text" minlength="3" maxlength="32" autocomplete="username" required></label>
        <label>Mot de passe<input name="password" type="password" minlength="12" maxlength="200" autocomplete="current-password" required></label>
        <p class="form-error" data-form-error role="alert"></p>
        <button class="button primary" type="submit">Se connecter</button>
      </form>

      <form id="setup-form" class="auth-form" hidden novalidate>
        <h2>Créer le propriétaire</h2>
        <p class="quiet">Cette étape ne fonctionne qu’une fois. Utilisez le jeton défini dans la configuration privée.</p>
        <label>Jeton d’installation<input name="setupToken" type="password" autocomplete="off" required></label>
        <label>Identifiant<input name="username" type="text" minlength="3" maxlength="32" autocomplete="username" required></label>
        <label>Mot de passe<input name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required></label>
        <p class="form-error" data-form-error role="alert"></p>
        <button class="button primary" type="submit">Créer et ouvrir l’espace</button>
      </form>
    </section>

    <section class="dashboard" id="dashboard" hidden aria-labelledby="dashboard-title">
      <div class="dashboard-head">
        <div><span class="eyebrow">ESPACE PROPRIÉTAIRE</span><h1 id="dashboard-title">Catalogue</h1><p>Bonjour <strong id="dashboard-owner"></strong>, gérez les prix et le stock depuis une seule vue.</p></div>
        <button class="button ghost" id="refresh-button" type="button">Actualiser</button>
      </div>

      <div class="summary-grid" aria-label="Résumé">
        <article><span>Offres à vérifier</span><strong id="review-count">—</strong><small>prix ou quantité à confirmer</small></article>
        <article><span>Fruits actifs</span><strong id="fruit-count">—</strong><small>deux formats par fruit</small></article>
        <article><span>Demandes ouvertes</span><strong id="open-order-count">—</strong><small>commandes WhatsApp</small></article>
      </div>

      <div class="tabs" role="tablist" aria-label="Gestion">
        <button type="button" role="tab" aria-selected="true" aria-controls="catalogue-panel" id="catalogue-tab">Prix et disponibilité</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="orders-panel" id="orders-tab">Commandes WhatsApp</button>
      </div>

      <section class="workspace" id="catalogue-panel" role="tabpanel" aria-labelledby="catalogue-tab">
        <div class="workspace-head">
          <div><h2>Catalogue vendeur</h2><p>Une sauvegarde confirme la valeur et retire son badge « à vérifier ».</p></div>
          <div class="filters">
            <label class="search-filter"><span class="sr-only">Rechercher un fruit</span><input id="catalogue-search" type="search" placeholder="Rechercher un fruit…"></label>
            <label><span class="sr-only">Filtrer par rareté</span><select id="rarity-filter" aria-label="Filtrer par rareté"><option value="">Toutes les raretés</option><option value="Common">Common</option><option value="Uncommon">Uncommon</option><option value="Rare">Rare</option><option value="Legendary">Legendary</option><option value="Mythical">Mythical</option></select></label>
            <label><span class="sr-only">Filtrer par type</span><select id="type-filter" aria-label="Filtrer par type"><option value="">Tous les types</option><option value="Natural">Natural</option><option value="Elemental">Elemental</option><option value="Beast">Beast</option></select></label>
            <label class="check"><input id="review-only" type="checkbox"> <span>À vérifier seulement</span></label>
            <button class="button ghost reset-filters" id="reset-filters" type="button">Réinitialiser</button>
          </div>
        </div>
        <div class="catalogue-table" role="table" aria-label="Prix et disponibilité des fruits">
          <div class="catalogue-columns" role="row">
            <strong role="columnheader">Fruit</strong>
            <div role="columnheader"><strong>Physique</strong><span><b>Prix MAD</b><b>Disponibilité</b><b>Quantité</b><b>Action</b></span></div>
            <div role="columnheader"><strong>Permanent</strong><span><b>Prix MAD</b><b>Disponibilité</b><b>Quantité</b><b>Action</b></span></div>
          </div>
          <div class="catalogue-list" id="catalogue-list" role="rowgroup" aria-live="polite"></div>
          <div class="catalogue-footer">
            <p id="catalogue-range">—</p>
            <div class="pagination" aria-label="Pagination du catalogue">
              <button class="button ghost" id="catalogue-prev" type="button">Précédent</button>
              <span id="catalogue-page" aria-live="polite">Page 1</span>
              <button class="button ghost" id="catalogue-next" type="button">Suivant</button>
            </div>
          </div>
        </div>
      </section>

      <section class="workspace" id="orders-panel" role="tabpanel" aria-labelledby="orders-tab" hidden>
        <div class="workspace-head">
          <div><h2>Suivi WhatsApp</h2><p>Le client voit uniquement le statut et la note publique.</p></div>
          <label>Filtrer
            <select id="order-filter">
              <option value="">Tous les statuts</option>
              <option value="new">Nouvelle</option>
              <option value="contacted">Contacté</option>
              <option value="confirmed">Confirmée</option>
              <option value="payment_pending">Paiement en attente</option>
              <option value="paid">Payée</option>
              <option value="delivering">Livraison</option>
              <option value="completed">Terminée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </label>
        </div>
        <div class="order-list" id="order-list" aria-live="polite"></div>
      </section>
    </section>
  </main>

  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <script src="admin.js?v=20260905-2" defer></script>
</body>
</html>
