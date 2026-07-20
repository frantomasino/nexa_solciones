/**
 * Persistencia de presupuestos en localStorage.
 * (Versión Supabase pendiente en js/pendiente-login/)
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'calculadora_baldosas_presupuestos';
  const THEME_KEY = 'calculadora_baldosas_theme';

  function generateId() {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function readAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeAll(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function getAll() {
    return readAll().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function getById(id) {
    return readAll().find((p) => p.id === id) || null;
  }

  function save(presupuesto) {
    const items = readAll();
    const now = new Date().toISOString();
    const data = { ...presupuesto };

    if (data.id) {
      const idx = items.findIndex((p) => p.id === data.id);
      if (idx >= 0) {
        data.updatedAt = now;
        items[idx] = { ...items[idx], ...data };
      } else {
        data.createdAt = data.createdAt || now;
        data.updatedAt = now;
        items.push(data);
      }
    } else {
      data.id = generateId();
      data.createdAt = now;
      data.updatedAt = now;
      items.push(data);
    }

    writeAll(items);
    return data;
  }

  function remove(id) {
    writeAll(readAll().filter((p) => p.id !== id));
  }

  function duplicate(id) {
    const original = getById(id);
    if (!original) return null;
    const copy = { ...original };
    delete copy.id;
    copy.cliente = `${copy.cliente || 'Sin nombre'} (copia)`;
    return save(copy);
  }

  function exportAll() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      presupuestos: readAll(),
    };
    return JSON.stringify(data, null, 2);
  }

  function importAll(jsonString, merge = true) {
    const data = JSON.parse(jsonString);
    const incoming = data.presupuestos || data;
    if (!Array.isArray(incoming)) throw new Error('Formato inválido');

    if (merge) {
      const existing = readAll();
      const byId = new Map(existing.map((p) => [p.id, p]));
      for (const p of incoming) {
        if (p.id && byId.has(p.id)) {
          byId.set(p.id, { ...byId.get(p.id), ...p });
        } else {
          const item = { ...p };
          if (!item.id) item.id = generateId();
          byId.set(item.id, item);
        }
      }
      writeAll([...byId.values()]);
    } else {
      writeAll(incoming);
    }
    return getAll();
  }

  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }

  global.Storage = {
    getAll,
    getById,
    save,
    remove,
    duplicate,
    exportAll,
    importAll,
    getTheme,
    setTheme,
  };
})(typeof window !== 'undefined' ? window : globalThis);
