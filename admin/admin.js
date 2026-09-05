(function () {
  'use strict';

  const API = '../api/v1/admin/';
  const statusLabels = {
    new: 'Nouvelle', contacted: 'Contacté', confirmed: 'Confirmée', payment_pending: 'Paiement en attente',
    paid: 'Payée', delivering: 'Livraison', completed: 'Terminée', cancelled: 'Annulée'
  };
  const availabilityLabels = {
    available: 'Disponible', out_of_stock: 'Indisponible', on_request: 'Sur demande', hidden: 'Masquée'
  };
  const state = { csrf: null, owner: null, fruits: [], orders: [], reviewCount: 0, cataloguePage: 1, cataloguePageSize: 8 };
  const byId = (id) => document.getElementById(id);
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  async function request(path, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.csrf && options.method === 'POST') headers['X-CSRF-Token'] = state.csrf;
    const response = await fetch(API + path, { credentials: 'same-origin', ...options, headers });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) {
      const error = new Error(body?.error?.message || `Erreur serveur (${response.status})`);
      error.code = body?.error?.code;
      error.details = body?.error?.details;
      error.status = response.status;
      throw error;
    }
    return body;
  }

  let toastTimer;
  function toast(message, error = false) {
    const node = byId('toast');
    node.textContent = message;
    node.classList.toggle('error', error);
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 4000);
  }

  function setAuthenticated(owner, csrf) {
    state.owner = owner;
    state.csrf = csrf;
    byId('auth-panel').hidden = true;
    byId('dashboard').hidden = false;
    byId('owner-tools').hidden = false;
    byId('owner-label').textContent = owner.username;
    byId('dashboard-owner').textContent = owner.username;
    document.body.classList.add('is-authenticated');
  }

  function setSignedOut(setupRequired = false) {
    state.owner = null;
    state.csrf = null;
    byId('auth-panel').hidden = false;
    byId('dashboard').hidden = true;
    byId('owner-tools').hidden = true;
    byId('login-form').hidden = setupRequired;
    byId('setup-form').hidden = !setupRequired;
    document.body.classList.remove('is-authenticated');
  }

  function formatMad(value) {
    if (value === null || value === '') return 'Sur demande';
    return `${new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(Number(value))} MAD`;
  }

  function makeOfferingEditor(fruit, mode) {
    const offering = fruit.offerings[mode];
    const editor = element('form', 'offering-editor');
    editor.classList.add(`mode-${mode}`);
    editor.dataset.slug = fruit.id;
    editor.dataset.mode = mode;
    editor.dataset.version = String(offering.version);

    const title = element('div', 'offering-title');
    title.append(element('span', 'mode-name', mode === 'physical' ? 'Physique' : 'Permanent'));
    if (offering.needsOwnerReview) title.append(element('span', 'review-badge', 'À vérifier'));
    editor.append(title);

    const priceLabel = element('label');
    priceLabel.append(element('span', 'field-label', 'Prix MAD'));
    const price = document.createElement('input');
    price.name = 'price'; price.type = 'number'; price.min = '0'; price.max = '99999999.99'; price.step = '0.01';
    price.value = offering.priceMad ?? '';
    priceLabel.append(price);

    const availabilityLabel = element('label');
    availabilityLabel.append(element('span', 'field-label', 'Disponibilité'));
    const availability = document.createElement('select');
    availability.name = 'availability';
    Object.entries(availabilityLabels).forEach(([value, label]) => {
      const option = element('option', '', label); option.value = value; option.selected = offering.availability === value; availability.append(option);
    });
    availabilityLabel.append(availability);

    const quantityLabel = element('label');
    quantityLabel.append(element('span', 'field-label', 'Quantité'));
    const quantity = document.createElement('input');
    quantity.name = 'quantity'; quantity.type = 'number'; quantity.min = '0'; quantity.max = '65535'; quantity.step = '1';
    quantity.value = offering.quantityAvailable ?? '';
    quantityLabel.append(quantity);

    const save = element('button', 'button primary save-offering', 'Enregistrer');
    save.type = 'submit';
    editor.append(priceLabel, availabilityLabel, quantityLabel, save);
    return editor;
  }

  function renderCatalogue() {
    const list = byId('catalogue-list');
    list.replaceChildren();
    const query = byId('catalogue-search').value.trim().toLowerCase();
    const rarity = byId('rarity-filter').value;
    const type = byId('type-filter').value;
    const reviewOnly = byId('review-only').checked;
    const fruits = state.fruits.filter((fruit) => {
      const matches = !query || `${fruit.name} ${fruit.id} ${fruit.rarity}`.toLowerCase().includes(query);
      const review = Object.values(fruit.offerings).some((offering) => offering?.needsOwnerReview);
      return matches && (!rarity || fruit.rarity === rarity) && (!type || fruit.type === type) && (!reviewOnly || review);
    });
    const pageCount = Math.max(1, Math.ceil(fruits.length / state.cataloguePageSize));
    state.cataloguePage = Math.min(state.cataloguePage, pageCount);
    const start = (state.cataloguePage - 1) * state.cataloguePageSize;
    const visibleFruits = fruits.slice(start, start + state.cataloguePageSize);
    byId('catalogue-range').textContent = fruits.length
      ? `Affichage de ${start + 1} à ${Math.min(start + state.cataloguePageSize, fruits.length)} sur ${fruits.length} fruits`
      : 'Aucun fruit affiché';
    byId('catalogue-page').textContent = `Page ${state.cataloguePage} sur ${pageCount}`;
    byId('catalogue-prev').disabled = state.cataloguePage <= 1;
    byId('catalogue-next').disabled = state.cataloguePage >= pageCount;
    if (!fruits.length) {
      list.append(element('p', 'empty', 'Aucun fruit ne correspond à ce filtre.'));
      return;
    }
    visibleFruits.forEach((fruit) => {
      const row = element('article', 'fruit-row');
      row.setAttribute('role', 'row');
      const identity = element('div', 'fruit-identity');
      identity.setAttribute('role', 'cell');
      const image = document.createElement('img'); image.src = `../${fruit.image}`; image.alt = ''; image.width = 52; image.height = 52;
      const copy = element('span'); copy.append(element('strong', '', fruit.name), element('small', '', `${fruit.rarity} · ${fruit.type}`));
      identity.append(image, copy);
      row.append(identity, makeOfferingEditor(fruit, 'physical'), makeOfferingEditor(fruit, 'permanent'));
      list.append(row);
    });
  }

  function renderOrders() {
    const list = byId('order-list');
    list.replaceChildren();
    if (!state.orders.length) {
      list.append(element('p', 'empty', 'Aucune commande dans cette vue.'));
      return;
    }
    state.orders.forEach((order) => {
      const card = element('article', 'order-card');
      card.dataset.reference = order.reference;
      card.dataset.version = String(order.version);
      const head = element('div', 'order-head');
      const heading = element('div'); heading.append(element('h3', '', order.reference), element('time', '', new Date(order.createdAt).toLocaleString('fr-MA')));
      head.append(heading, element('span', 'status-pill', statusLabels[order.status] || order.status));
      const buyer = element('div', 'buyer');
      buyer.append(
        element('strong', '', `${order.buyer.firstName || 'Anonymisé'} · ${order.buyer.robloxUsername || '—'}`),
        element('span', '', `${order.buyer.paymentMethod || '—'}${order.buyer.city ? ` · ${order.buyer.city}` : ''}`)
      );
      const items = element('div', 'order-items');
      order.items.forEach((item) => items.append(element('span', '', `${item.fruitName} · ${item.mode === 'physical' ? 'physique' : 'permanent'} ×${item.quantity}`)));
      const total = element('div', 'order-total'); total.append(element('span', '', 'Total indicatif'), element('span', '', formatMad(order.quotedTotalMad)));

      const editor = element('form', 'order-editor');
      const statusLabel = element('label', '', 'Statut');
      const select = document.createElement('select'); select.name = 'status';
      Object.entries(statusLabels).forEach(([value, label]) => {
        const option = element('option', '', label); option.value = value; option.selected = order.status === value; select.append(option);
      });
      statusLabel.append(select);
      const noteLabel = element('label', '', 'Note publique (sans donnée personnelle)');
      const note = document.createElement('textarea'); note.name = 'publicNote'; note.maxLength = 240; note.placeholder = 'Message visible par le client'; note.value = order.publicNote || '';
      noteLabel.append(note);
      const save = element('button', 'button primary', 'Mettre à jour'); save.type = 'submit';
      editor.append(statusLabel, noteLabel, save);
      card.append(head, buyer, items, total, editor);
      list.append(card);
    });
  }

  async function loadCatalogue() {
    const response = await request('catalogue.php');
    state.fruits = response.data.fruits;
    state.reviewCount = response.meta?.reviewCount || 0;
    byId('review-count').textContent = String(state.reviewCount);
    byId('fruit-count').textContent = String(state.fruits.length);
    renderCatalogue();
  }

  async function loadOrders() {
    const filter = byId('order-filter').value;
    const response = await request(`orders.php?limit=100${filter ? `&status=${encodeURIComponent(filter)}` : ''}`);
    state.orders = response.data.orders;
    byId('open-order-count').textContent = String(response.meta?.openCount ?? 0);
    renderOrders();
  }

  async function loadDashboard() {
    await Promise.all([loadCatalogue(), loadOrders()]);
  }

  async function handleAuth(form, endpoint) {
    const submit = form.querySelector('button[type="submit"]');
    const errorNode = form.querySelector('[data-form-error]');
    errorNode.textContent = ''; submit.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await request(endpoint, { method: 'POST', body: JSON.stringify(data) });
      setAuthenticated(response.data.owner, response.data.csrfToken);
      form.reset();
      await loadDashboard();
    } catch (error) {
      errorNode.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  }

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (form.id === 'login-form' || form.id === 'setup-form') {
      event.preventDefault();
      await handleAuth(form, form.id === 'login-form' ? 'login.php' : 'setup.php');
      return;
    }
    if (form.matches('.offering-editor')) {
      event.preventDefault();
      const button = form.querySelector('button'); button.disabled = true;
      const availability = form.elements.availability.value;
      const quantityValue = form.elements.quantity.value;
      try {
        const response = await request('catalogue.php', {
          method: 'POST',
          body: JSON.stringify({
            fruitSlug: form.dataset.slug,
            mode: form.dataset.mode,
            priceMad: form.elements.price.value || null,
            availability,
            quantityAvailable: quantityValue === '' ? null : Number(quantityValue),
            expectedVersion: Number(form.dataset.version)
          })
        });
        const fruit = state.fruits.find((item) => item.id === form.dataset.slug);
        fruit.offerings[form.dataset.mode] = response.data.offering;
        state.reviewCount = state.fruits.flatMap((item) => Object.values(item.offerings)).filter((item) => item?.needsOwnerReview).length;
        byId('review-count').textContent = String(state.reviewCount);
        renderCatalogue();
        toast(`${fruit.name} · ${form.dataset.mode === 'physical' ? 'physique' : 'permanent'} sauvegardé.`);
      } catch (error) {
        toast(error.message, true);
        if (error.code === 'VERSION_CONFLICT') await loadCatalogue();
      } finally { button.disabled = false; }
      return;
    }
    if (form.matches('.order-editor')) {
      event.preventDefault();
      const card = form.closest('.order-card');
      const button = form.querySelector('button'); button.disabled = true;
      try {
        await request('order-status.php', {
          method: 'POST',
          body: JSON.stringify({
            reference: card.dataset.reference,
            status: form.elements.status.value,
            publicNote: form.elements.publicNote.value,
            expectedVersion: Number(card.dataset.version)
          })
        });
        await loadOrders();
        toast(`Commande ${card.dataset.reference} mise à jour.`);
      } catch (error) {
        toast(error.message, true);
        if (error.code === 'VERSION_CONFLICT') await loadOrders();
      } finally { button.disabled = false; }
    }
  });

  byId('logout-button').addEventListener('click', async () => {
    try { await request('logout.php', { method: 'POST', body: '{}' }); } catch (_) { /* Clear the local view regardless. */ }
    setSignedOut(false);
  });
  byId('refresh-button').addEventListener('click', async () => {
    const button = byId('refresh-button'); button.disabled = true;
    try { await loadDashboard(); toast('Données actualisées.'); } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; }
  });
  byId('catalogue-search').addEventListener('input', () => {
    state.cataloguePage = 1;
    renderCatalogue();
  });
  ['review-only', 'rarity-filter', 'type-filter'].forEach((id) => byId(id).addEventListener('change', () => {
    state.cataloguePage = 1;
    renderCatalogue();
  }));
  byId('reset-filters').addEventListener('click', () => {
    byId('catalogue-search').value = '';
    byId('rarity-filter').value = '';
    byId('type-filter').value = '';
    byId('review-only').checked = false;
    state.cataloguePage = 1;
    renderCatalogue();
    byId('catalogue-search').focus();
  });
  byId('catalogue-prev').addEventListener('click', () => {
    state.cataloguePage = Math.max(1, state.cataloguePage - 1);
    renderCatalogue();
    byId('catalogue-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  byId('catalogue-next').addEventListener('click', () => {
    state.cataloguePage += 1;
    renderCatalogue();
    byId('catalogue-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  byId('order-filter').addEventListener('change', () => loadOrders().catch((error) => toast(error.message, true)));

  document.querySelectorAll('[role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
    const catalogue = tab.id === 'catalogue-tab';
    byId('catalogue-tab').setAttribute('aria-selected', String(catalogue));
    byId('orders-tab').setAttribute('aria-selected', String(!catalogue));
    byId('catalogue-panel').hidden = !catalogue;
    byId('orders-panel').hidden = catalogue;
  }));

  request('session.php')
    .then(async (response) => {
      if (!response.data.authenticated) { setSignedOut(response.data.setupRequired); return; }
      setAuthenticated(response.data.owner, response.data.csrfToken);
      await loadDashboard();
    })
    .catch((error) => { setSignedOut(false); toast(error.message, true); });
})();
