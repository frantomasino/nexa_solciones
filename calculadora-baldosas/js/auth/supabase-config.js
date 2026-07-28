/**
 * Supabase — sin login (descartado). Solo se usa como backend de datos:
 * cada presupuesto se guarda en la nube etiquetado con el nombre de texto
 * libre que carga la persona en "Tu nombre en Nexa" (ver js/data/storage.js).
 */
(function (global) {
  'use strict';

  global.SUPABASE_URL = 'https://wspouzdlkougxtbgkgyn.supabase.co';
  global.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Vcw-hH2uMnJi2SDBWBFJ1g_cyFiE4Xx';

  // Login (Google/SMS) descartado a propósito: queda apagado siempre.
  global.AUTH_ENABLED = false;

  // La nube (tabla "presupuestos") está activa en cualquier entorno donde
  // haya credenciales configuradas, sin requerir sesión de usuario.
  global.CLOUD_ENABLED = !!(global.SUPABASE_URL && global.SUPABASE_PUBLISHABLE_KEY);
})(typeof window !== 'undefined' ? window : globalThis);