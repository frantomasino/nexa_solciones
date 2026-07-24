/**
 * Supabase — login solo en preview (hostname con "supabas" o localhost).
 * Producción nexa-solciones.vercel.app queda sin login aunque se mergee por error.
 */
(function (global) {
  'use strict';

  global.SUPABASE_URL = 'https://wspouzdlkougxtbgkgyn.supabase.co';
  global.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vcw-hH2uMnJi2SDBWBFJ1g_cyFiE4Xx';

  const host = typeof location !== 'undefined' ? location.hostname : '';
  const isPreviewHost = /supabas|localhost|127\.0\.0\.1/i.test(host);
  global.AUTH_ENABLED = isPreviewHost;
})(typeof window !== 'undefined' ? window : globalThis);
