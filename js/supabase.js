// js/supabase.js — Supabase client + data service layer
// Structured for offline-first: all writes go through saveOrdenToSupabase()
// which can be intercepted by IndexedDB/SW when offline.

const SUPABASE_URL = 'https://gkehnfqfzdcbqmhtqwpw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Co2i-ANKLLIKd6IWRpYzdQ_96CFVLdw';

// ── Initialize Supabase Client ──────────────────────────────────
let supabaseClient = null;
try {
  // The UMD bundle exposes `window.supabase` with `createClient`
  const createFn = (window.supabase && window.supabase.createClient)
    || (window.supabase && window.supabase.default && window.supabase.default.createClient);

  if (!createFn) {
    throw new Error('createClient function not found on window.supabase');
  }

  supabaseClient = createFn(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase client initialized successfully');
  console.log('   URL:', SUPABASE_URL);
} catch (e) {
  console.warn('⚠️ Supabase init failed:', e.message);
  console.warn('   window.supabase =', typeof window.supabase, window.supabase ? Object.keys(window.supabase) : 'N/A');
}

// ── Auth — Real Supabase Auth ───────────────────────────────────

// Login with email + password
window.login = async function (email, password) {
  if (!supabaseClient) {
    // Fallback for offline: mock login
    localStorage.setItem('tecnico_name', email.split('@')[0]);
    localStorage.setItem('tecnico_email', email);
    return { data: { user: { id: null, email } }, error: null };
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (!error && data.user) {
    // Cache user info locally for offline access
    const nombre = data.user.user_metadata?.nombre_mostrar || email.split('@')[0];
    localStorage.setItem('tecnico_id', data.user.id);
    localStorage.setItem('tecnico_name', nombre);
    localStorage.setItem('tecnico_email', email);
  }

  return { data, error };
};

// Register new user with name in metadata
window.register = async function (email, password, nombre) {
  if (!supabaseClient) {
    return { data: null, error: { message: 'Sin conexión a Supabase' } };
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { nombre_mostrar: nombre }
    }
  });

  if (!error && data.user) {
    // Cache locally
    localStorage.setItem('tecnico_id', data.user.id);
    localStorage.setItem('tecnico_name', nombre);
    localStorage.setItem('tecnico_email', email);
  }

  return { data, error };
};

// Logout
window.logout = async function () {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  localStorage.removeItem('tecnico_id');
  localStorage.removeItem('tecnico_name');
  localStorage.removeItem('tecnico_email');
};

// Get current user — checks Supabase session, falls back to localStorage
window.getCurrentUser = function () {
  // Try localStorage first (fast, works offline)
  const email = localStorage.getItem('tecnico_email');
  if (email) {
    return {
      id: localStorage.getItem('tecnico_id'),
      name: localStorage.getItem('tecnico_name') || 'Técnico',
      email
    };
  }
  return null;
};

// Check Supabase session and refresh local cache
window.checkSession = async function () {
  if (!supabaseClient) return null;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user) {
      const user = session.user;
      const nombre = user.user_metadata?.nombre_mostrar || user.email.split('@')[0];
      localStorage.setItem('tecnico_id', user.id);
      localStorage.setItem('tecnico_name', nombre);
      localStorage.setItem('tecnico_email', user.email);
      return { id: user.id, name: nombre, email: user.email };
    }
  } catch (e) {
    console.warn('Session check failed:', e.message);
  }
  return null;
};

// ── Save Order to Supabase (the core function) ─────────────────
// This is the primary data service. In the future, when offline,
// the caller (app.js) will catch failures and queue to IndexedDB.
window.saveOrdenToSupabase = async function (orderData, itemsData) {
  if (!supabaseClient) {
    throw new Error('Supabase client not available');
  }

  // STEP A: Insert into 'ordenes' table
  const ordenPayload = {
    numero_contrato: orderData.numero_contrato,
    total_orden: orderData.total_orden,
    tecnico_id: null // null temporarily until login is configured
  };

  const { data: ordenInserted, error: ordenError } = await supabaseClient
    .from('ordenes')
    .insert([ordenPayload])
    .select('id')
    .single();

  if (ordenError) {
    console.error('❌ Error inserting orden:', ordenError);
    throw new Error(`Error al guardar orden: ${ordenError.message}`);
  }

  const ordenId = ordenInserted.id;
  console.log('✅ Orden insertada con ID:', ordenId);

  // STEP B: Insert items into 'orden_detalles' table
  const detallesPayload = itemsData.map(item => ({
    orden_id: ordenId,
    labor_codigo: item.labor_codigo,
    cantidad: item.cantidad,
    subtotal: item.subtotal
  }));

  const { error: detallesError } = await supabaseClient
    .from('orden_detalles')
    .insert(detallesPayload);

  if (detallesError) {
    console.error('❌ Error inserting orden_detalles:', detallesError);
    // The order was created but details failed — log but don't lose the order
    throw new Error(`Orden creada pero error en detalles: ${detallesError.message}`);
  }

  console.log('✅ Detalles insertados:', detallesPayload.length, 'items');

  return { ordenId, success: true };
};

// ── Sync unsynced local orders to Supabase ──────────────────────
window.syncData = async function () {
  if (!navigator.onLine) return;
  if (!supabaseClient) return;

  console.log('🔄 Online: Starting sync...');

  try {
    const unsyncedOrdenes = await window.getUnsyncedOrdenes();

    for (const localOrden of unsyncedOrdenes) {
      console.log('Syncing order:', localOrden.numero_contrato);

      const items = await db.orden_items.where('orden_id').equals(localOrden.id).toArray();
      const totalOrden = items.reduce((sum, item) => sum + item.subtotal, 0);

      try {
        const orderData = {
          numero_contrato: localOrden.numero_contrato,
          total_orden: totalOrden
        };

        const itemsData = items.map(i => ({
          labor_codigo: i.labor_codigo || i.codigo_labor_id,
          cantidad: i.cantidad,
          subtotal: i.subtotal
        }));

        const result = await window.saveOrdenToSupabase(orderData, itemsData);

        // Mark as synced in IndexedDB
        await window.markOrdenAsSynced(localOrden.id, result.ordenId);
        console.log('✅ Order synced:', localOrden.numero_contrato);
      } catch (e) {
        console.warn('⚠️ Sync failed for order', localOrden.numero_contrato, e.message);
      }
    }

    window.dispatchEvent(new Event('sync-complete'));

  } catch (error) {
    console.error('Sync error:', error);
  }
};

// Auto-sync when coming online
window.addEventListener('online', window.syncData);
