/**
 * Supabase — login solo en preview (hostname con "supabas" o localhost).
 * Producción nexa-solciones.vercel.app queda sin login aunque se mergee por error.
 */
(function (global) {
  'use strict';

  global.SUPABASE_URL = 'https://wspouzdlkougxtbgkgyn.supabase.co';
  global.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vcw-hH2uMnJi2SDBWBFJ1g_cyFiE4Xx';

  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isProduction = host === 'nexa-solciones.vercel.app';
  const isPreviewHost = !isProduction && /supabas|localhost|127\.0\.0\.1/i.test(host);
  global.AUTH_ENABLED = isPreviewHost;

  if (typeof console !== 'undefined' && !global.AUTH_ENABLED && host) {
    const reason = isProduction
      ? 'producción (login solo en URL de preview del PR #55)'
      : 'este dominio no es preview ni localhost';
    console.info('[Nexa Auth] Login desactivado:', reason);
  }
})(typeof window !== 'undefined' ? window : globalThis);
