// js/app.js

document.addEventListener('DOMContentLoaded', () => {
  // Views
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const viewNewOrder = document.getElementById('view-new-order');
  
  // UI Elements
  const btnLogin = document.getElementById('btn-login');
  const btnLogout = document.getElementById('btn-logout');
  const btnNewOrder = document.getElementById('btn-new-order');
  const btnBacks = document.querySelectorAll('.btn-back');
  
  const userNameEl = document.getElementById('user-name');
  const totalDiaEl = document.getElementById('total-dia');
  const totalQuincenaEl = document.getElementById('total-quincena');
  const countDiaEl = document.getElementById('count-dia');
  const recentOrdersList = document.getElementById('recent-orders-list');
  const ordersCountBadge = document.getElementById('orders-count');
  const syncStatus = document.getElementById('sync-status');
  
  // New Order Elements
  const laborSearch = document.getElementById('labor-search');
  const searchResults = document.getElementById('search-results');
  const newOrderItemsList = document.getElementById('new-order-items');
  const newTotalEl = document.getElementById('new-total');
  const btnSaveOrder = document.getElementById('btn-save-order');
  const newContractInput = document.getElementById('new-contract');

  let currentNewOrderItems = [];

  // Init
  initApp();

  function initApp() {
    const user = window.getCurrentUser();
    if (user) {
      showView(viewDashboard);
      userNameEl.textContent = user.name;
      loadDashboard();
      updateSyncStatus();
    } else {
      showView(viewLogin);
    }
  }

  function showView(view) {
    [viewLogin, viewDashboard, viewNewOrder].forEach(v => v.classList.remove('active'));
    view.classList.add('active');
  }

  // Formatting helpers
  const formatMoney = (amount) => '$' + Number(amount).toLocaleString('es-CO');
  
  // Handlers
  btnLogin.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    
    btnLogin.disabled = true;
    btnLogin.textContent = 'Ingresando...';
    
    const { data, error } = await window.login(email, pass);
    
    btnLogin.disabled = false;
    btnLogin.textContent = 'Ingresar';

    if (!error) {
      initApp();
      window.syncData(); // Attempt initial sync
    } else {
      alert('Error de login');
    }
  });

  btnLogout.addEventListener('click', () => {
    window.logout();
    showView(viewLogin);
  });

  btnNewOrder.addEventListener('click', () => {
    resetNewOrderForm();
    showView(viewNewOrder);
  });

  btnBacks.forEach(btn => btn.addEventListener('click', () => {
    showView(viewDashboard);
  }));

  // --- Dashboard Logic ---
  async function loadDashboard() {
    const orders = await getOrdenesRecientes();
    renderOrdersList(orders);
    calculateStats(orders);
  }

  function renderOrdersList(orders) {
    recentOrdersList.innerHTML = '';
    ordersCountBadge.textContent = orders.length > 0 ? `(${orders.length})` : '';
    
    if (orders.length === 0) {
      recentOrdersList.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted); font-size: 12px;">No hay órdenes recientes</div>';
      return;
    }

    orders.slice(0, 5).forEach(order => {
      const isSynced = order.estado_sincronizacion;
      const timeStr = new Date(order.fecha_creacion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const dateObj = new Date(order.fecha_creacion);
      const today = new Date();
      const isToday = dateObj.toDateString() === today.toDateString();
      const displayTime = isToday ? `Hoy ${timeStr}` : timeStr;
      
      const el = document.createElement('div');
      el.className = `oc ${!isSynced ? 'unsynced' : ''}`;
      el.innerHTML = `
        <div class="oc-left">
          <div class="oc-contract">Contrato #${order.numero_contrato}</div>
          <div class="oc-code">Cód. ${order.codigos || 'N/A'}</div>
          <div class="oc-amt">${formatMoney(order.total)}</div>
          <div class="oc-time">${!isSynced ? 'Pendiente' : displayTime}</div>
        </div>
        <div class="oc-chevron">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `;
      recentOrdersList.appendChild(el);
    });
  }

  function calculateStats(orders) {
    const today = new Date().toISOString().split('T')[0];
    let totalDia = 0;
    let countDia = 0;
    let totalQuincena = 0;

    orders.forEach(o => {
      const oDate = o.fecha_creacion.split('T')[0];
      if (oDate === today) {
        totalDia += o.total;
        countDia++;
      }
      // Simple quincena simulation: add all for now
      totalQuincena += o.total;
    });

    totalDiaEl.textContent = formatMoney(totalDia);
    countDiaEl.textContent = countDia;
    totalQuincenaEl.textContent = formatMoney(totalQuincena);
  }

  // --- New Order Logic ---
  function resetNewOrderForm() {
    newContractInput.value = '';
    laborSearch.value = '';
    searchResults.classList.remove('active');
    currentNewOrderItems = [];
    renderNewOrderItems();
  }

  laborSearch.addEventListener('input', async (e) => {
    const q = e.target.value.trim();
    if (q.length > 0) {
      const results = await searchCodigosLabor(q);
      renderSearchResults(results);
    } else {
      searchResults.classList.remove('active');
    }
  });

  function renderSearchResults(results) {
    searchResults.innerHTML = '';
    if (results.length === 0) {
      searchResults.classList.remove('active');
      return;
    }

    results.forEach(item => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `
        <div>
          <div class="search-item-code">${item.codigo}</div>
          <div class="search-item-desc">${item.descripcion}</div>
        </div>
        <div class="search-item-price">${formatMoney(item.valor_pesos)}</div>
      `;
      div.addEventListener('click', () => addLaborCodeToOrder(item));
      searchResults.appendChild(div);
    });
    searchResults.classList.add('active');
  }

  function addLaborCodeToOrder(laborInfo) {
    laborSearch.value = '';
    searchResults.classList.remove('active');

    // Check if exists
    const existing = currentNewOrderItems.find(i => i.codigo_labor_id === laborInfo.id);
    if (existing) {
      existing.cantidad++;
      existing.subtotal = existing.cantidad * laborInfo.valor_pesos;
    } else {
      currentNewOrderItems.push({
        codigo_labor_id: laborInfo.id,
        codigo: laborInfo.codigo,
        descripcion: laborInfo.descripcion,
        valor_pesos: laborInfo.valor_pesos,
        cantidad: 1,
        subtotal: laborInfo.valor_pesos
      });
    }
    renderNewOrderItems();
  }

  function updateItemQuantity(index, delta) {
    const item = currentNewOrderItems[index];
    item.cantidad += delta;
    if (item.cantidad <= 0) {
      currentNewOrderItems.splice(index, 1);
    } else {
      item.subtotal = item.cantidad * item.valor_pesos;
    }
    renderNewOrderItems();
  }

  function removeItem(index) {
    currentNewOrderItems.splice(index, 1);
    renderNewOrderItems();
  }

  function renderNewOrderItems() {
    newOrderItemsList.innerHTML = '';
    let total = 0;

    currentNewOrderItems.forEach((item, index) => {
      total += item.subtotal;
      const div = document.createElement('div');
      div.className = 'ci';
      div.innerHTML = `
        <div class="ci-top">
          <div class="cn">${item.codigo}</div>
          <div class="xb" data-idx="${index}"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
        </div>
        <div class="cd">${item.descripcion}</div>
        <div class="ci-bottom">
          <div class="stepr">
            <div class="sb2" data-idx="${index}" data-delta="-1">−</div>
            <div class="sv">${item.cantidad}</div>
            <div class="sb2" data-idx="${index}" data-delta="1">+</div>
          </div>
          <div class="cst">${formatMoney(item.subtotal)}</div>
        </div>
      `;
      newOrderItemsList.appendChild(div);
    });

    // Attach Stepper Listeners
    newOrderItemsList.querySelectorAll('.sb2').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        const delta = parseInt(e.currentTarget.dataset.delta);
        updateItemQuantity(idx, delta);
      });
    });

    // Attach Remove Listeners
    newOrderItemsList.querySelectorAll('.xb').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        removeItem(idx);
      });
    });

    newTotalEl.textContent = formatMoney(total);
  }

  btnSaveOrder.addEventListener('click', async () => {
    if (!newContractInput.value) {
      alert('Debe ingresar un número de contrato');
      return;
    }
    if (currentNewOrderItems.length === 0) {
      alert('Debe agregar al menos un código de labor');
      return;
    }

    const user = window.getCurrentUser();
    
    btnSaveOrder.disabled = true;
    btnSaveOrder.textContent = 'Guardando...';

    const orderPayload = {
      tecnico_id: user.id,
      numero_contrato: newContractInput.value,
      fecha_creacion: new Date().toISOString()
    };

    const itemsPayload = currentNewOrderItems.map(i => ({
      codigo_labor_id: i.codigo_labor_id,
      cantidad: i.cantidad,
      subtotal: i.subtotal
    }));

    await saveOrden(orderPayload, itemsPayload);
    
    btnSaveOrder.disabled = false;
    btnSaveOrder.textContent = 'Guardar Orden';
    
    // Attempt sync
    window.syncData();
    
    showView(viewDashboard);
    loadDashboard();
  });

  // --- Network State ---
  function updateSyncStatus() {
    const statusEl = syncStatus;
    const textEl = statusEl.querySelector('.topbar-status-text');
    const iconEl = statusEl.querySelector('svg');
    if (navigator.onLine) {
      if (textEl) textEl.textContent = 'En línea';
      if (iconEl) iconEl.style.stroke = 'var(--green)';
      statusEl.classList.remove('offline');
    } else {
      if (textEl) textEl.textContent = 'Sin conexión';
      if (iconEl) iconEl.style.stroke = 'var(--red)';
      statusEl.classList.add('offline');
    }
  }

  window.addEventListener('online', () => {
    updateSyncStatus();
    window.syncData();
  });
  window.addEventListener('offline', updateSyncStatus);
  window.addEventListener('sync-complete', loadDashboard);

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(registration => {
        console.log('SW registered: ', registration.scope);
      }).catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
    });
  }
});
