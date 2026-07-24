/**
 * Supabase — solo rama preview (no mergear a main hasta probar).
 */
(function (global) {
  'use strict';

  global.SUPABASE_URL = 'https://wspouzdlkougxtbgkgyn.supabase.co';
  global.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vcw-hH2uMnJi2SDBWBFJ1g_cyFiE4Xx';

  /** Activar login + sync en la nube. En main/producción queda false. */
  global.AUTH_ENABLED = true;
})(typeof window !== 'undefined' ? window : globalThis);
