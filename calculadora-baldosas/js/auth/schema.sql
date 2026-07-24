-- Ejecutar en Supabase → SQL Editor (una sola vez)

create table if not exists presupuestos (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb not null,
  updated_at timestamptz default now()
);

create index if not exists presupuestos_user_id_idx on presupuestos(user_id);
create index if not exists presupuestos_updated_at_idx on presupuestos(updated_at desc);

alter table presupuestos enable row level security;

drop policy if exists "Users read own presupuestos" on presupuestos;
drop policy if exists "Users insert own presupuestos" on presupuestos;
drop policy if exists "Users update own presupuestos" on presupuestos;
drop policy if exists "Users delete own presupuestos" on presupuestos;

create policy "Users read own presupuestos"
  on presupuestos for select
  using (auth.uid() = user_id);

create policy "Users insert own presupuestos"
  on presupuestos for insert
  with check (auth.uid() = user_id);

create policy "Users update own presupuestos"
  on presupuestos for update
  using (auth.uid() = user_id);

create policy "Users delete own presupuestos"
  on presupuestos for delete
  using (auth.uid() = user_id);
