# Login con Supabase (rama preview)

**Esta rama tiene login activado.** Producción (`main`) sigue sin login hasta que lo apruebes.

## URL correcta para probar

| URL | ¿Muestra login? |
|-----|-----------------|
| `https://nexa-solciones.vercel.app` | **No** — es producción, entra directo al dashboard |
| Preview del PR #55 (dominio con `supabas` en el nombre) | **Sí** — pantalla con Google y teléfono |
| `http://localhost:8080` (servidor local en esta rama) | **Sí** |

**Preview actual (jul 2026):**  
https://nexa-solciones-git-cursor-supabas-cb32e5-frantomasinos-projects.vercel.app

Si en incógnito ves el dashboard sin login, casi seguro estás en **producción**. Mirá la barra de direcciones: tiene que decir `supabas` en el dominio.

Si Vercel pide iniciar sesión antes de ver la app, es la **protección de deployments** del proyecto. Entrá con tu cuenta de Vercel o desactivala en *Project Settings → Deployment Protection* para previews.

Para forzar cierre de sesión en preview: agregá `?logout=1` al final de la URL.

## 1. SQL en Supabase

En **SQL Editor**, ejecutá el archivo `schema.sql` de esta carpeta.

## 2. URLs de redirect (Google)

En **Authentication → URL Configuration**:

- Site URL: tu preview de Vercel o `http://localhost:8080`
- Redirect URLs:
  - `https://nexa-solciones.vercel.app/**`
  - `https://*-frantomasinos-projects.vercel.app/**` (previews)
  - `http://localhost:8080/**`

## 3. Google

**Authentication → Providers → Google**: activar y poner Client ID + Secret de Google Cloud Console.

## 4. Teléfono (SMS)

**Authentication → Providers → Phone**: activar y configurar Twilio (u otro proveedor).

Sin Twilio, usá solo Google para probar.

## 5. Claves en la app

Solo van en el frontend:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`)

**Nunca** la `sb_secret_...`.

## 6. Pasar a producción

Cuando esté probado:

1. Mergear la rama a `main`
2. O copiar los cambios y poner `AUTH_ENABLED = true` en `supabase-config.js`

## Flujo

1. Usuario entra con Google o SMS
2. Se sincronizan presupuestos local → nube → local
3. Cada guardado/edición/borrado se replica en Supabase
4. Mismo usuario ve todo desde celular o PC
