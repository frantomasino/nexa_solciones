/**
 * Autenticación Supabase — Google y teléfono (SMS).
 */
(function (global) {
  'use strict';

  let client = null;
  let currentUser = null;
  let authListener = null;

  function isEnabled() {
    return !!global.AUTH_ENABLED && !!global.SUPABASE_URL && !!global.SUPABASE_PUBLISHABLE_KEY;
  }

  function getRedirectUrl() {
    return window.location.origin + window.location.pathname;
  }

  function mapUser(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || meta.display_name
      || (user.email ? user.email.split('@')[0] : '')
      || (user.phone ? user.phone : 'Usuario');
    return {
      id: user.id,
      email: user.email || null,
      phone: user.phone || null,
      name,
      avatar: meta.avatar_url || meta.picture || null,
    };
  }

  function init() {
    if (!isEnabled()) return false;
    if (!global.supabase?.createClient) {
      console.warn('Supabase JS no cargado');
      return false;
    }
    client = global.supabase.createClient(
      global.SUPABASE_URL,
      global.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
    return true;
  }

  async function getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentUser = mapUser(data.session?.user ?? null);
    return data.session;
  }

  function getUser() {
    return currentUser;
  }

  function getClient() {
    return client;
  }

  function isLoggedIn() {
    return !!currentUser?.id;
  }

  async function signInWithGoogle() {
    if (!client) throw new Error('Supabase no configurado');
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getRedirectUrl() },
    });
    if (error) throw error;
  }

  async function signInWithPhone(phone) {
    if (!client) throw new Error('Supabase no configurado');
    const normalized = phone.trim();
    const { error } = await client.auth.signInWithOtp({ phone: normalized });
    if (error) throw error;
    return normalized;
  }

  async function verifyPhoneOtp(phone, token) {
    if (!client) throw new Error('Supabase no configurado');
    const { data, error } = await client.auth.verifyOtp({
      phone: phone.trim(),
      token: token.trim(),
      type: 'sms',
    });
    if (error) throw error;
    currentUser = mapUser(data.user);
    return data;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    currentUser = null;
  }

  function onAuthStateChange(callback) {
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      currentUser = mapUser(session?.user ?? null);
      callback(currentUser, session);
    });
    authListener = data?.subscription;
    return () => authListener?.unsubscribe?.();
  }

  global.Auth = {
    init,
    isEnabled,
    isLoggedIn,
    getSession,
    getUser,
    getClient,
    signInWithGoogle,
    signInWithPhone,
    verifyPhoneOtp,
    signOut,
    onAuthStateChange,
  };
})(typeof window !== 'undefined' ? window : globalThis);
