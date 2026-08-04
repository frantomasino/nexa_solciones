/**
 * Sincronización de presupuestos con Supabase — SIN login.
 * Tabla compartida: todos ven todos los presupuestos en cualquier computadora.
 */
(function (global) {
  'use strict';

  const TABLE = 'presupuestos';
  const CLIENT_WAIT_MS = 8000;
  const CLIENT_POLL_MS = 200;
  let client = null;

  function isActive() {
    return !!global.CLOUD_ENABLED;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Espera a que cargue el SDK de Supabase (CDN) antes de fallar. */
  async function waitForSdk(timeoutMs = CLIENT_WAIT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (global.supabase?.createClient) return true;
      await sleep(CLIENT_POLL_MS);
    }
    return !!global.supabase?.createClient;
  }

  async function getClient() {
    if (client) return client;
    if (!isActive()) return null;
    if (!global.supabase?.createClient) {
      const ok = await waitForSdk();
      if (!ok) {
        throw new Error('No cargó el SDK de Supabase. Revisá la conexión o un bloqueador.');
      }
    }
    if (!global.SUPABASE_URL || !global.SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Faltan credenciales de Supabase en la app.');
    }
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
    const c = await getClient();
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
    const c = await getClient();
    if (!c || !id) return;

    const { error } = await c.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }

  /** Trae todos los presupuestos de la nube (tabla compartida por el equipo). */
  async function syncDown() {
    const c = await getClient();
    if (!c) return [];

    const { data, error } = await c
      .from(TABLE)
      .select('id, data, cliente, created_by, updated_by, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToPresupuesto);
  }

  /** Guarda/actualiza el nombre de usuario apenas se carga en el modal. */
  async function upsertUser(user) {
    const c = await getClient();
    if (!c || !user?.id || !user?.name) return;

    const { error } = await c.from('usuarios').upsert({
      id: user.id,
      name: user.name,
      last_seen: new Date().toISOString(),
    });
    if (error) throw error;
  }

  /** Reintenta syncDown unas veces (red floja / cold start). */
  async function syncDownWithRetry(attempts = 3) {
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        return await syncDown();
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) await sleep(600 * (i + 1));
      }
    }
    throw lastErr || new Error('No se pudo sincronizar con la nube');
  }

  global.CloudStorage = {
    isActive,
    pushItem,
    deleteItem,
    syncDown,
    syncDownWithRetry,
    upsertUser,
    /** Alias por si el flujo de login vuelve a activarse. */
    syncOnLogin: syncDownWithRetry,
  };
})(typeof window !== 'undefined' ? window : globalThis);
