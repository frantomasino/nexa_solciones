/**
 * Supabase — login SOLO en pruebas locales (no en producción).
 * nexa-solciones.vercel.app → sin login, dashboard directo.
 */
(function (global) {
  'use strict';

  global.SUPABASE_URL = 'https://wspouzdlkougxtbgkgyn.supabase.co';
  global.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vcw-hH2uMnJi2SDBWBFJ1g_cyFiE4Xx';

  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isProduction = host === 'nexa-solciones.vercel.app';
  const isLocalTest = /^(localhost|127\.0\.0\.1)$/i.test(host);
  const hasKeys = !!(global.SUPABASE_URL && global.SUPABASE_PUBLISHABLE_KEY);

  global.AUTH_ENABLED = hasKeys && !isProduction && isLocalTest;
})(typeof window !== 'undefined' ? window : globalThis);
