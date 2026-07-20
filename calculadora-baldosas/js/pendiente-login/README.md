# Login con Supabase (pendiente)

Este módulo está **desconectado a propósito**. La app funciona con `localStorage` hasta que el cliente quiera activar la nube.

## Pasos para reconectar

1. Crear proyecto en [supabase.com](https://supabase.com) (plan gratuito).
2. Completar `supabase-config.js` con la URL y la `anon key` del proyecto.
3. Crear tabla `presupuestos` en SQL Editor:

```sql
create table presupuestos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  cliente text,
  link text,
  room_width_m numeric,
  room_length_m numeric,
  tile_width_cm numeric,
  tile_length_cm numeric,
  tiles_per_box integer,
  spare_percent numeric,
  pattern text,
  colors jsonb,
  custom_percents jsonb,
  aisle_width integer,
  stripe_width integer,
  breakdown jsonb,
  total_tiles_with_spare integer,
  total_boxes integer,
  canvas_thumb text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table presupuestos enable row level security;

create policy "Users see own presupuestos"
  on presupuestos for all
  using (auth.uid() = user_id);
```

4. En `index.html`, agregar antes de `main.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/pendiente-login/supabase-config.js"></script>
<script src="js/pendiente-login/auth.js"></script>
```

5. Descomentar el código de inicialización en `auth.js`.
6. Reemplazar `js/data/storage.js` por una versión que use Supabase (o agregar un adaptador).
7. Agregar vista de login/registro en `main.js` (ocultar dashboard si no hay sesión).

## Campos guardados

Los mismos que usa `storage.js` local, en snake_case en Postgres.
