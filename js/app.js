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
  
  // Auth elements
  const registerNameInput = document.getElementById('register-name');
  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const authModeTag = document.getElementById('auth-mode-tag');
  const toggleAuthLink = document.getElementById('toggle-auth-link');
  const authToggleDiv = document.getElementById('auth-toggle');
  const chkRemember = document.getElementById('chk-remember');

  // New Order Elements
  const laborSearch = document.getElementById('labor-search');
  const searchResults = document.getElementById('search-results');
  const newOrderItemsList = document.getElementById('new-order-items');
  const newTotalEl = document.getElementById('new-total');
  const btnSaveOrder = document.getElementById('btn-save-order');
  const newContractInput = document.getElementById('new-contract');

  let currentNewOrderItems = [];

  // Auth state
  let isRegisterMode = false;

  // Toggle between Login / Register
  function setAuthMode(registerMode) {
    isRegisterMode = registerMode;
    if (registerMode) {
      registerNameInput.style.display = 'block';
      chkRemember.style.display = 'none';
      btnLogin.textContent = 'Crear cuenta';
      authModeTag.textContent = 'registro · v3.0';
      authToggleDiv.innerHTML = '¿Ya tienes cuenta? <span>Inicia sesión</span>';
      authToggleDiv.querySelector('span').addEventListener('click', () => setAuthMode(false));
    } else {
      registerNameInput.style.display = 'none';
      chkRemember.style.display = 'flex';
      btnLogin.textContent = 'Ingresar';
      authModeTag.textContent = 'iniciar sesión · v3.0';
      authToggleDiv.innerHTML = '¿No tienes cuenta? <span>Regístrate aquí</span>';
      authToggleDiv.querySelector('span').addEventListener('click', () => setAuthMode(true));
    }
  }
  toggleAuthLink.addEventListener('click', () => setAuthMode(true));

  // Init
  initApp();

  async function initApp() {
    // Try to restore session from Supabase first
    const sessionUser = await window.checkSession();
    const user = sessionUser || window.getCurrentUser();
    
    if (user) {
      showView(viewDashboard);
      userNameEl.textContent = user.name || 'Técnico';
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
  
  // ── Auth Submit Handler (Login or Register) ──
  btnLogin.addEventListener('click', async () => {
    const email = loginEmailInput.value.trim();
    const pass = loginPasswordInput.value.trim();
    
    if (!email || !pass) {
      showToast('Completa todos los campos', 'error');
      return;
    }

    if (isRegisterMode) {
      // ── REGISTER MODE ──
      const nombre = registerNameInput.value.trim();
      if (!nombre) {
        showToast('Ingresa tu nombre', 'error');
        return;
      }

      btnLogin.disabled = true;
      btnLogin.textContent = 'Creando cuenta...';

      const { data, error } = await window.register(email, pass, nombre);

      btnLogin.disabled = false;
      btnLogin.textContent = 'Crear cuenta';

      if (error) {
        showToast(error.message || 'Error al registrar', 'error');
        return;
      }

      showToast('✅ Cuenta creada exitosamente', 'success');
      // Auto-login after registration
      userNameEl.textContent = nombre;
      showView(viewDashboard);
      loadDashboard();
      updateSyncStatus();
      window.syncData();

    } else {
      // ── LOGIN MODE ──
      btnLogin.disabled = true;
      btnLogin.textContent = 'Ingresando...';

      const { data, error } = await window.login(email, pass);

      btnLogin.disabled = false;
      btnLogin.textContent = 'Ingresar';

      if (error) {
        showToast(error.message || 'Error de inicio de sesión', 'error');
        return;
      }

      // Extract name from user metadata
      const user = window.getCurrentUser();
      userNameEl.textContent = user ? user.name : 'Técnico';
      showView(viewDashboard);
      loadDashboard();
      updateSyncStatus();
      window.syncData();
    }
  });

  btnLogout.addEventListener('click', async () => {
    await window.logout();
    showView(viewLogin);
  });

  btnNewOrder.addEventListener('click', () => {
    resetNewOrderForm();
    showView(viewNewOrder);
  });

  btnBacks.forEach(btn => btn.addEventListener('click', () => {
    showView(viewDashboard);
  }));

  let currentAllOrders = [];

  // --- Dashboard Logic ---
  async function loadDashboard() {
    currentAllOrders = await getOrdenesRecientes();
    renderOrdersList(currentAllOrders);
    calculateStats(currentAllOrders);
  }

  // --- Search Logic ---
  const topbarSearchBtn = document.getElementById('topbar-search-btn');
  const topbarSearchInput = document.getElementById('topbar-search-input');
  const topbarSearchContainer = document.getElementById('topbar-search-container');
  
  if (topbarSearchBtn && topbarSearchInput) {
    topbarSearchBtn.addEventListener('click', () => {
      topbarSearchContainer.classList.toggle('active');
      topbarSearchInput.classList.toggle('active');
      if (topbarSearchInput.classList.contains('active')) {
        topbarSearchInput.focus();
      } else {
        topbarSearchInput.value = '';
        renderOrdersList(currentAllOrders);
      }
    });

    topbarSearchInput.addEventListener('input', (e) => {
      const term = e.target.value.trim().toLowerCase();
      if (!term) {
        renderOrdersList(currentAllOrders);
        return;
      }
      const filtered = currentAllOrders.filter(o => String(o.numero_contrato).toLowerCase().includes(term));
      renderOrdersList(filtered);
    });
  }

  // --- Fortnight Select Logic ---
  const dateFromInput = document.getElementById('date-from');
  const dateToInput = document.getElementById('date-to');
  
  if (dateFromInput && dateToInput) {
    // Restore locally saved dates if available
    const savedFrom = localStorage.getItem('filterDateFrom');
    const savedTo = localStorage.getItem('filterDateTo');
    
    // Default to first 15 days of current month if not saved
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    
    dateFromInput.value = savedFrom || `${y}-${m}-01`;
    dateToInput.value = savedTo || `${y}-${m}-15`;

    const updateFilter = () => {
      localStorage.setItem('filterDateFrom', dateFromInput.value);
      localStorage.setItem('filterDateTo', dateToInput.value);
      calculateStats(currentAllOrders);
    };

    dateFromInput.addEventListener('change', updateFilter);
    dateToInput.addEventListener('change', updateFilter);
  }

  function renderOrdersList(orders) {
    recentOrdersList.innerHTML = '';
    ordersCountBadge.textContent = orders.length > 0 ? `(${orders.length})` : '';
    
    if (orders.length === 0) {
      recentOrdersList.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted); font-size: 12px;">No hay órdenes recientes</div>';
      return;
    }

    const borderColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F97316', '#EF4444'];

    orders.slice(0, 5).forEach((order, index) => {
      const isSynced = order.estado_sincronizacion;
      const timeStr = new Date(order.fecha_creacion).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      const dateObj = new Date(order.fecha_creacion);
      const today = new Date();
      const isToday = dateObj.toDateString() === today.toDateString();
      const displayTime = isToday ? `Hoy ${timeStr}` : timeStr;
      
      const randomColor = borderColors[index % borderColors.length];
      const statusClass = isSynced ? 'sincronizada' : 'pendiente';
      const statusText = isSynced ? 'Sincronizada' : 'Pendiente';

      const el = document.createElement('div');
      el.className = 'oc';
      el.style.borderLeftColor = randomColor;
      el.innerHTML = `
        <div class="oc-icon" style="width:40px;height:40px;border-radius:50%;background:#DBEAFE;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg viewBox="0 0 24 24" style="width:20px;height:20px;stroke:#1E40AF;fill:none;stroke-width:2;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <div class="oc-info" style="flex:1;display:flex;flex-direction:column;gap:3px;margin-left:12px;">
          <div class="oc-contract">Contrato #${order.numero_contrato}</div>
          <div class="oc-code">Cód. ${order.codigos || 'N/A'}</div>
          <div class="oc-status ${statusClass}">
            <div class="oc-status-dot"></div>
            ${statusText}
          </div>
        </div>
        <div class="oc-right" style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;height:100%;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="oc-amt">${formatMoney(order.total)}</div>
            <div class="oc-del-btn" data-id="${order.id}" style="cursor:pointer;padding:4px;background:#FEE2E2;border-radius:6px;transition:background .1s;">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:#EF4444;fill:none;stroke-width:2;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
          </div>
          <div class="oc-time" style="margin-top:auto;">Creada ${displayTime.toLowerCase()}</div>
        </div>
      `;
      recentOrdersList.appendChild(el);
    });

    // Attach delete listeners
    recentOrdersList.querySelectorAll('.oc-del-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const orderId = e.currentTarget.dataset.id;
        if (confirm('¿Estás seguro de eliminar esta orden?')) {
          try {
            // Delete from Supabase
            if (navigator.onLine && window.supabaseClient) {
              const { error } = await window.supabaseClient.from('ordenes').delete().eq('id', orderId);
              if (error) console.error('Error deleting from supabase:', error);
            }
            // Delete from IndexedDB (local)
            await window.deleteOrden(orderId);
            
            showToast('Orden eliminada', 'success');
            loadDashboard(); // Refresh
          } catch (err) {
            console.error('Error deleting order:', err);
            showToast('Error al eliminar orden', 'error');
          }
        }
      });
    });
  }

  function calculateStats(orders) {
    const today = new Date().toISOString().split('T')[0];
    let totalDia = 0;
    let countDia = 0;
    let totalQuincena = 0;

    const filterFrom = document.getElementById('date-from')?.value;
    const filterTo = document.getElementById('date-to')?.value;

    orders.forEach(o => {
      const oDateStr = o.fecha_creacion.split('T')[0];
      if (oDateStr === today) {
        totalDia += o.total;
        countDia++;
      }
      
      if (filterFrom && filterTo) {
        if (oDateStr >= filterFrom && oDateStr <= filterTo) {
          totalQuincena += o.total;
        }
      }
    });

    totalDiaEl.textContent = formatMoney(totalDia);
    countDiaEl.textContent = countDia;
    totalQuincenaEl.textContent = formatMoney(totalQuincena);
  }

  // --- New Order Logic ---
  
  // Photo attach logic
  const btnAttachPhoto = document.getElementById('btn-attach-photo');
  const fotoInput = document.getElementById('foto-input');
  const fotoFileName = document.getElementById('foto-file-name');
  
  if (btnAttachPhoto && fotoInput) {
    btnAttachPhoto.addEventListener('click', () => {
      fotoInput.click();
    });
    
    fotoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        fotoFileName.textContent = e.target.files[0].name;
      } else {
        fotoFileName.textContent = 'Adjuntar foto (Opcional)';
      }
    });
  }

  function resetNewOrderForm() {
    newContractInput.value = '';
    laborSearch.value = '';
    searchResults.classList.remove('active');
    if (fotoInput) fotoInput.value = '';
    if (fotoFileName) fotoFileName.textContent = 'Adjuntar foto (Opcional)';
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

  // Clear all button listener
  const btnClearAll = document.getElementById('btn-clear-all');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      currentNewOrderItems = [];
      renderNewOrderItems();
    });
  }

  function renderNewOrderItems() {
    newOrderItemsList.innerHTML = '';
    let total = 0;

    // Update badge count
    const badge = document.getElementById('selected-codes-count');
    if (badge) badge.textContent = currentNewOrderItems.length;

    currentNewOrderItems.forEach((item, index) => {
      total += item.subtotal;
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div class="cart-item-icon">
          <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        </div>
        <div class="cart-item-center">
          <div class="cart-item-info">
            <div class="cart-item-code">${item.codigo}</div>
            <div class="cart-item-desc">${item.descripcion}</div>
          </div>
          <div class="cart-stepper">
            <div class="cs-btn" data-idx="${index}" data-delta="-1">−</div>
            <div class="cs-val">${item.cantidad}</div>
            <div class="cs-btn" data-idx="${index}" data-delta="1">+</div>
          </div>
        </div>
        <div class="cart-item-right">
          <div class="cart-item-del" data-idx="${index}">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </div>
          <div class="cart-item-total">${formatMoney(item.subtotal)}</div>
        </div>
      `;
      newOrderItemsList.appendChild(div);
    });

    // Attach Stepper Listeners
    newOrderItemsList.querySelectorAll('.cs-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        const delta = parseInt(e.currentTarget.dataset.delta);
        updateItemQuantity(idx, delta);
      });
    });

    // Attach Remove Listeners
    newOrderItemsList.querySelectorAll('.cart-item-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.target.closest('.cart-item-del');
        if (el) {
          const idx = parseInt(el.dataset.idx);
          removeItem(idx);
        }
      });
    });

    newTotalEl.textContent = formatMoney(total);
  }

  btnSaveOrder.addEventListener('click', async () => {
    // Validation
    if (!newContractInput.value.trim()) {
      showToast('Debe ingresar un número de contrato', 'error');
      return;
    }
    if (currentNewOrderItems.length === 0) {
      showToast('Debe agregar al menos un código de labor', 'error');
      return;
    }

    // Calculate total
    const totalOrden = currentNewOrderItems.reduce((sum, i) => sum + i.subtotal, 0);

    // Loading state
    btnSaveOrder.disabled = true;
    const originalText = btnSaveOrder.textContent;
    btnSaveOrder.textContent = 'Guardando...';
    btnSaveOrder.style.opacity = '0.7';

    try {
      // Prepare payloads
      const orderData = {
        numero_contrato: newContractInput.value.trim(),
        total_orden: totalOrden
      };

      const itemsData = currentNewOrderItems.map(i => ({
        labor_codigo: i.codigo,       // e.g. '1009933'
        cantidad: i.cantidad,
        subtotal: i.subtotal
      }));

      let savedOnline = false;

      // ── Try Supabase first (online path) ──
      if (navigator.onLine) {
        try {
          await window.saveOrdenToSupabase(orderData, itemsData);
          savedOnline = true;
          console.log('✅ Orden guardada en Supabase');
        } catch (supaError) {
          console.warn('⚠️ Supabase save failed, falling back to local:', supaError.message);
        }
      }

      // ── Fallback: save locally in IndexedDB ──
      if (!savedOnline) {
        const user = window.getCurrentUser();
        const localOrderPayload = {
          tecnico_id: user ? user.id : null,
          numero_contrato: newContractInput.value.trim(),
          fecha_creacion: new Date().toISOString()
        };

        const localItemsPayload = currentNewOrderItems.map(i => ({
          codigo_labor_id: i.codigo_labor_id,
          labor_codigo: i.codigo,
          cantidad: i.cantidad,
          subtotal: i.subtotal
        }));

        await saveOrden(localOrderPayload, localItemsPayload);
        console.log('💾 Orden guardada localmente (offline)');
      }

      // ── Success ──
      showToast(savedOnline 
        ? '✅ Orden guardada exitosamente' 
        : '💾 Orden guardada localmente. Se sincronizará al tener conexión.', 
        'success'
      );

      // Reset form and go back
      resetNewOrderForm();
      showView(viewDashboard);
      loadDashboard();

      // Try background sync if saved locally
      if (!savedOnline) {
        window.syncData();
      }

    } catch (error) {
      console.error('Error saving order:', error);
      showToast('Error al guardar la orden. Intente nuevamente.', 'error');
    } finally {
      // Restore button
      btnSaveOrder.disabled = false;
      btnSaveOrder.textContent = originalText;
      btnSaveOrder.style.opacity = '1';
    }
  });

  // ── Toast Notification ──
  function showToast(message, type = 'success') {
    // Remove existing toast
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      color: white;
      z-index: 9999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      animation: toastIn 0.3s ease;
      max-width: 290px;
      text-align: center;
      background: ${type === 'success' ? '#16A34A' : '#DC2626'};
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

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
