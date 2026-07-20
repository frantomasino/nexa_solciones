/**
 * Persistencia en localStorage + usuario local (Supabase pendiente).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'calculadora_baldosas_presupuestos';
  const THEME_KEY = 'calculadora_baldosas_theme';
  const USER_KEY = 'calculadora_baldosas_user';
  const COMPANY_LOGO_KEY = 'calculadora_baldosas_company_logo';

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

  function getCurrentUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : { name: '', id: null };
    } catch {
      return { name: '', id: null };
    }
  }

  function setCurrentUser(name) {
    const user = { name: (name || '').trim(), id: `local_${Date.now()}` };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  }

  function getCompanyLogo() {
    return localStorage.getItem(COMPANY_LOGO_KEY) || null;
  }

  function setCompanyLogo(dataUrl) {
    if (dataUrl) localStorage.setItem(COMPANY_LOGO_KEY, dataUrl);
    else localStorage.removeItem(COMPANY_LOGO_KEY);
  }

  function save(presupuesto) {
    const items = readAll();
    const now = new Date().toISOString();
    const user = getCurrentUser();
    const data = { ...presupuesto };

    if (data.id) {
      const idx = items.findIndex((p) => p.id === data.id);
      if (idx >= 0) {
        data.updatedAt = now;
        data.updatedBy = user.name || 'Sin usuario';
        items[idx] = { ...items[idx], ...data };
      } else {
        data.createdAt = data.createdAt || now;
        data.updatedAt = now;
        data.createdBy = data.createdBy || user.name || 'Sin usuario';
        data.updatedBy = user.name || 'Sin usuario';
        items.push(data);
      }
    } else {
      data.id = generateId();
      data.createdAt = now;
      data.updatedAt = now;
      data.createdBy = user.name || 'Sin usuario';
      data.updatedBy = user.name || 'Sin usuario';
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
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      presupuestos: readAll(),
    }, null, 2);
  }

  function importAll(jsonString, merge = true) {
    const data = JSON.parse(jsonString);
    const incoming = data.presupuestos || data;
    if (!Array.isArray(incoming)) throw new Error('Formato inválido');

    if (merge) {
      const byId = new Map(readAll().map((p) => [p.id, p]));
      for (const p of incoming) {
        if (p.id && byId.has(p.id)) byId.set(p.id, { ...byId.get(p.id), ...p });
        else {
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
    getAll, getById, save, remove, duplicate,
    exportAll, importAll, getTheme, setTheme,
    getCurrentUser, setCurrentUser,
    getCompanyLogo, setCompanyLogo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
