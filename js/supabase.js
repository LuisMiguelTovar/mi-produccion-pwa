// js/supabase.js

const supabaseUrl = 'https://tuesupabaseurlmock.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1ZXN1cGFiYXNldXJsbW9jayIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjIwMTk2NDMyMDB9.TuMockKeyParaSupabaseQueNoEsRealPeroSirveParaLaEstructura';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Auth functions (Mocking real auth since we might not have users created in Supabase yet)
// But we will use the structure.
window.login = async function(email, password) {
  // Using a mock technician id for offline test since Auth might fail with fake URL
  // In a real app we do: return await supabaseClient.auth.signInWithPassword({ email, password });
  
  // MOCK LOGIN FOR NOW SO IT WORKS OFFLINE AND OFFLINE-FIRST
  localStorage.setItem('tecnico_id', 'mock-tecnico-1234');
  localStorage.setItem('tecnico_name', 'Carlos Mendoza');
  localStorage.setItem('tecnico_email', email);
  return { data: { user: { id: 'mock-tecnico-1234', email } }, error: null };
};

window.logout = function() {
  localStorage.removeItem('tecnico_id');
  localStorage.removeItem('tecnico_name');
  localStorage.removeItem('tecnico_email');
};

window.getCurrentUser = function() {
  const id = localStorage.getItem('tecnico_id');
  if (id) {
    return {
      id,
      name: localStorage.getItem('tecnico_name'),
      email: localStorage.getItem('tecnico_email')
    }
  }
  return null;
};

// Data Sync functions
window.syncData = async function() {
  if (!navigator.onLine) return;
  console.log('Online: Starting Sync...');
  
  try {
    // 1. Sync Labor Codes from Supabase to IndexedDB
    // const { data: codigos, error: errCodes } = await supabaseClient.from('codigos_labor').select('*');
    // if (!errCodes && codigos.length > 0) {
    //   await db.codigos_labor.clear();
    //   await db.codigos_labor.bulkAdd(codigos);
    // }

    // 2. Sync Unsynced Orders from IndexedDB to Supabase
    const unsyncedOrdenes = await window.getUnsyncedOrdenes();
    for (const localOrden of unsyncedOrdenes) {
      console.log('Syncing order: ', localOrden.numero_contrato);
      
      const items = await db.orden_items.where('orden_id').equals(localOrden.id).toArray();
      
      // Prepare payload (removing local ID)
      const ordenPayload = {
        tecnico_id: localOrden.tecnico_id,
        numero_contrato: localOrden.numero_contrato,
        fecha_creacion: localOrden.fecha_creacion,
        total_orden: items.reduce((sum, item) => sum + item.subtotal, 0),
        estado_sincronizacion: true
      };

      // We wrap in try catch so mock failures don't stop the app
      try {
        // MOCK SYNC (Since Supabase URL is fake, this would normally fail)
        // const { data: realOrden, error: oError } = await supabaseClient.from('ordenes').insert([ordenPayload]).select().single();
        // if(oError) throw oError;
        // 
        // const itemsPayload = items.map(i => ({
        //   orden_id: realOrden.id,
        //   codigo_labor_id: i.codigo_labor_id,
        //   cantidad: i.cantidad,
        //   subtotal: i.subtotal
        // }));
        // const { error: iError } = await supabaseClient.from('orden_items').insert(itemsPayload);
        // if(iError) throw iError;
        
        // Simulate network delay
        await new Promise(r => setTimeout(r, 500));
        
        // Mark as synced locally
        await window.markOrdenAsSynced(localOrden.id);
      } catch (e) {
        console.warn('Sync failed for order', localOrden.numero_contrato, e);
      }
    }
    
    // Trigger an event so UI can update the green dot
    window.dispatchEvent(new Event('sync-complete'));
    
  } catch (error) {
    console.error('Sync Error', error);
  }
};

// Auto-sync when coming online
window.addEventListener('online', window.syncData);
