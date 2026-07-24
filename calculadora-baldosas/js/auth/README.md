# Login con Supabase (solo prueba local)

**Producción (`nexa-solciones.vercel.app`) NO tiene login.** El dashboard entra directo como siempre.

El login solo se activa en **localhost** para que puedas probar sin tocar el sitio público.

## 1. Probar en tu PC

En la carpeta del proyecto:

```bash
cd calculadora-baldosas
python3 -m http.server 8080
```

Abrí en el navegador: **http://localhost:8080**

Ahí sí deberías ver la pantalla de login (Google / teléfono).

## 2. SQL en Supabase

En **SQL Editor**, ejecutá `schema.sql` (tabla `presupuestos`).  
Los usuarios aparecen en **Authentication → Users**, no hace falta tabla de perfil.

## 3. URLs en Supabase (para localhost, NO producción)

**Authentication → URL Configuration:**

| Campo | Valor |
|-------|--------|
| Site URL | `http://localhost:8080` |
| Redirect URLs | `http://localhost:8080/**` |

**No uses** `nexa-solciones.vercel.app` hasta que apruebes pasar login a producción.

## 4. Google

**Authentication → Providers → Google** → activar con Client ID y Secret.

En **Google Cloud Console** → tu OAuth client:

- **Authorized JavaScript origins:** `http://localhost:8080`
- **Authorized redirect URIs:** `https://wspouzdlkougxtbgkgyn.supabase.co/auth/v1/callback`

## 5. Claves

Solo en el frontend: `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.  
Nunca la `sb_secret_...`.

## 6. Cuando quieras producción

1. Cambiar `supabase-config.js` para incluir `nexa-solciones.vercel.app`
2. Agregar redirect `https://nexa-solciones.vercel.app/**` en Supabase
3. Mergear y desplegar
