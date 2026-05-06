// js/db.js

const db = new Dexie('GasFieldDB');

// Define database schema
db.version(1).stores({
  codigos_labor: 'id, codigo, descripcion, valor_pesos', // id is string (UUID or local ID)
  ordenes: 'id, tecnico_id, numero_contrato, fecha_creacion, estado_sincronizacion',
  orden_items: '++id, orden_id, codigo_labor_id, cantidad, subtotal'
});

// Initialize catalog if empty
db.on('populate', async () => {
  await db.codigos_labor.bulkAdd([
    { id: '1', codigo: '1009933', descripcion: 'Válvula interna', valor_pesos: 10867 },
    { id: '2', codigo: '1001949', descripcion: 'Regulador', valor_pesos: 19932 },
    { id: '3', codigo: '1009946', descripcion: 'Medidor', valor_pesos: 22392 },
    { id: '4', codigo: '1001954', descripcion: 'Elevador', valor_pesos: 25800 },
    { id: '5', codigo: '1009912', descripcion: 'Cotización', valor_pesos: 9302 },
    { id: '6', codigo: '1009938', descripcion: 'Conexión', valor_pesos: 8281 },
    { id: '7', codigo: '100003384', descripcion: 'Tubería perforada', valor_pesos: 23546 },
    { id: '8', codigo: '4295354', descripcion: 'obra civil', valor_pesos: 8253 }
  ]);
});

// Helper functions for DB operations

async function getCodigosLabor() {
  return await db.codigos_labor.toArray();
}

async function searchCodigosLabor(query) {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  return await db.codigos_labor.filter(c =>
    c.codigo.toLowerCase().includes(lowerQuery) ||
    c.descripcion.toLowerCase().includes(lowerQuery)
  ).toArray();
}

async function saveOrden(orden, items) {
  return await db.transaction('rw', db.ordenes, db.orden_items, async () => {
    // Generate a temporary local ID if not provided
    if (!orden.id) {
      orden.id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    orden.estado_sincronizacion = false; // By default not synced

    await db.ordenes.put(orden);

    for (const item of items) {
      item.orden_id = orden.id;
      await db.orden_items.put(item);
    }
    return orden.id;
  });
}

async function getOrdenesRecientes() {
  const ordenes = await db.ordenes.orderBy('fecha_creacion').reverse().toArray();
  const result = [];

  for (const orden of ordenes) {
    const items = await db.orden_items.where('orden_id').equals(orden.id).toArray();
    let total = 0;
    const codigos = [];

    for (const item of items) {
      total += Number(item.subtotal);
      const codigoInfo = await db.codigos_labor.get(item.codigo_labor_id);
      if (codigoInfo) codigos.push(codigoInfo.codigo);
    }

    result.push({
      ...orden,
      total,
      codigos: codigos.join(' · '),
      itemCount: items.length
    });
  }

  return result;
}

async function getUnsyncedOrdenes() {
  return await db.ordenes.where('estado_sincronizacion').equals(false).toArray();
}

async function markOrdenAsSynced(id, newId) {
  return await db.transaction('rw', db.ordenes, db.orden_items, async () => {
    const orden = await db.ordenes.get(id);
    if (orden) {
      orden.estado_sincronizacion = true;
      if (newId) {
        // Optionally update the ID to the real UUID from Supabase
        // and update related items
        const items = await db.orden_items.where('orden_id').equals(id).toArray();
        for (let item of items) {
          item.orden_id = newId;
          await db.orden_items.put(item);
        }
        await db.ordenes.delete(id);
        orden.id = newId;
      }
      await db.ordenes.put(orden);
    }
  });
}

// ── Export to window for cross-script access ──
window.getUnsyncedOrdenes = getUnsyncedOrdenes;
window.markOrdenAsSynced = markOrdenAsSynced;

async function deleteOrden(id) {
  return await db.transaction('rw', db.ordenes, db.orden_items, async () => {
    // Delete related items
    const items = await db.orden_items.where('orden_id').equals(id).toArray();
    for (const item of items) {
      await db.orden_items.delete(item.id);
    }
    await db.ordenes.delete(id);
  });
}
window.deleteOrden = deleteOrden;

