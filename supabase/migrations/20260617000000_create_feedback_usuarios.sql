create table if not exists public.feedback_usuarios (
  id          uuid primary key default gen_random_uuid(),
  negocio     text not null,
  id_cuenta   integer,          -- nullable: algunos feedbacks no tienen cuenta identificada
  feedback    text not null,
  mes         text not null,    -- YYYY-MM
  autor       text,             -- ejecutivo que cargó el feedback en Slack
  created_at  timestamptz default now()
);

-- índice para búsquedas por mes y por cuenta
create index if not exists feedback_usuarios_mes_idx      on public.feedback_usuarios (mes);
create index if not exists feedback_usuarios_cuenta_idx   on public.feedback_usuarios (id_cuenta);

-- RLS: acceso de lectura para usuarios autenticados
alter table public.feedback_usuarios enable row level security;

create policy "Authenticated users can read feedback"
  on public.feedback_usuarios for select
  to authenticated
  using (true);

create policy "Authenticated users can insert feedback"
  on public.feedback_usuarios for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update feedback"
  on public.feedback_usuarios for update
  to authenticated
  using (true);

create policy "Authenticated users can delete feedback"
  on public.feedback_usuarios for delete
  to authenticated
  using (true);
