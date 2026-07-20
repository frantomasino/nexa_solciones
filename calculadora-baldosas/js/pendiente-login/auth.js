/**
 * Autenticación con Supabase — NO CONECTADO.
 * Ver README.md en esta carpeta para reconectar.
 */
(function (global) {
  'use strict';

  // Descomentar cuando se configure supabase-config.js:
  // const { createClient } = supabase;

  let client = null;
  let currentUser = null;

  function init() {
  //   if (!global.SUPABASE_URL || !global.SUPABASE_ANON_KEY) {
  //     console.warn('Supabase no configurado');
  //     return false;
  //   }
  //   client = createClient(global.SUPABASE_URL, global.SUPABASE_ANON_KEY);
    return false;
  }

  async function signUp(email, password, displayName) {
    if (!client) throw new Error('Supabase no configurado');
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    if (!client) throw new Error('Supabase no configurado');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    return data;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    currentUser = null;
  }

  async function getSession() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    currentUser = data.session?.user ?? null;
    return data.session;
  }

  function getUser() {
    return currentUser;
  }

  global.Auth = {
    init,
    signUp,
    signIn,
    signOut,
    getSession,
    getUser,
    isEnabled: () => !!client,
  };
})(typeof window !== 'undefined' ? window : globalThis);
