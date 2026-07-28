/**
 * Sincronización de presupuestos con Supabase — SIN login.
 * Usa la anon/publishable key directo; cada fila queda etiquetada con el
 * nombre de texto libre ("Tu nombre en Nexa"), no con un usuario autenticado.
 */
(function (global) {
  'use strict';

  const TABLE = 'presupuestos';
  let client = null;

  function isActive() {
    return !!global.CLOUD_ENABLED;
  }

  function getClient() {
    if (client) return client;
    if (!isActive() || !global.supabase?.createClient) return null;
    client = global.supabase.createClient(global.SUPABASE_URL, global.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  function rowToPresupuesto(row) {
    const data = row.data || {};
    return {
      ...data,
      id: row.id,
      cliente: data.cliente || row.cliente || '',
      createdBy: data.createdBy || row.created_by || 'Sin usuario',
      updatedBy: data.updatedBy || row.updated_by || 'Sin usuario',
      createdAt: data.createdAt || row.created_at || row.updated_at,
      updatedAt: data.updatedAt || row.updated_at,
    };
  }

  async function pushItem(presupuesto) {
    const c = getClient();
    if (!c || !presupuesto?.id) return;

    const { error } = await c.from(TABLE).upsert({
      id: presupuesto.id,
      data: presupuesto,
      cliente: presupuesto.cliente || null,
      created_by: presupuesto.createdBy || null,
      updated_by: presupuesto.updatedBy || null,
      updated_at: presupuesto.updatedAt || new Date().toISOString(),
    });
    if (error) throw error;
  }

  async function deleteItem(id) {
    const c = getClient();
    if (!c || !id) return;

    const { error } = await c.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }

  /** Trae todos los presupuestos de la nube (tabla compartida por el equipo). */
  async function syncDown() {
    const c = getClient();
    if (!c) return null;

    const { data, error } = await c
      .from(TABLE)
      .select('id, data, cliente, created_by, updated_by, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToPresupuesto);
  }

  /** Guarda/actualiza el nombre de usuario apenas se carga en el modal, sin esperar a un presupuesto. */
  async function upsertUser(user) {
    const c = getClient();
    if (!c || !user?.id || !user?.name) return;

    const { error } = await c.from('usuarios').upsert({
      id: user.id,
      name: user.name,
      last_seen: new Date().toISOString(),
    });
    if (error) throw error;
  }

  global.CloudStorage = {
    isActive,
    pushItem,
    deleteItem,
    syncDown,
    upsertUser,
  };
})(typeof window !== 'undefined' ? window : globalThis);