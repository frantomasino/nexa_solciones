/**
 * Sincronización de presupuestos con Supabase.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'calculadora_baldosas_presupuestos';

  function isActive() {
    return global.AUTH_ENABLED && global.Auth?.isLoggedIn?.();
  }

  function getClient() {
    return global.Auth?.getClient?.();
  }

  function rowToPresupuesto(row) {
    const data = row.data || {};
    return {
      ...data,
      id: row.id,
      updatedAt: data.updatedAt || row.updated_at,
      createdAt: data.createdAt || row.updated_at,
    };
  }

  function writeLocal(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function pushItem(presupuesto) {
    const client = getClient();
    const user = global.Auth.getUser();
    if (!client || !user?.id || !presupuesto?.id) return;

    const { error } = await client.from('presupuestos').upsert({
      id: presupuesto.id,
      user_id: user.id,
      data: presupuesto,
      updated_at: presupuesto.updatedAt || new Date().toISOString(),
    });
    if (error) throw error;
  }

  async function deleteItem(id) {
    const client = getClient();
    const user = global.Auth.getUser();
    if (!client || !user?.id || !id) return;

    const { error } = await client.from('presupuestos').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
  }

  async function syncDown() {
    const client = getClient();
    const user = global.Auth.getUser();
    if (!client || !user?.id) return readLocal();

    const { data, error } = await client
      .from('presupuestos')
      .select('id, data, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const items = (data || []).map(rowToPresupuesto);
    writeLocal(items);
    return items;
  }

  /** Primera vez: sube lo local y baja la nube (merge por id). */
  async function syncOnLogin() {
    const client = getClient();
    const user = global.Auth.getUser();
    if (!client || !user?.id) return readLocal();

    const local = readLocal();
    for (const p of local) {
      try {
        await pushItem(p);
      } catch (err) {
        console.warn('No se pudo subir presupuesto local', p.id, err);
      }
    }
    return syncDown();
  }

  global.CloudStorage = {
    isActive,
    pushItem,
    deleteItem,
    syncDown,
    syncOnLogin,
  };
})(typeof window !== 'undefined' ? window : globalThis);
