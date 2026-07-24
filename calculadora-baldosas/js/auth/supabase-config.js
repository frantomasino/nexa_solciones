/**
 * Supabase — login activo cuando hay URL y clave configuradas.
 */
(function (global) {
  'use strict';

  global.SUPABASE_URL = 'https://wspouzdlkougxtbgkgyn.supabase.co';
  global.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vcw-hH2uMnJi2SDBWBFJ1g_cyFiE4Xx';

  global.AUTH_ENABLED = !!(global.SUPABASE_URL && global.SUPABASE_PUBLISHABLE_KEY);
})(typeof window !== 'undefined' ? window : globalThis);
