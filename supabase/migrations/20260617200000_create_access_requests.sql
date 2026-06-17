-- Tabla de solicitudes de acceso para usuarios @fu.do
create table if not exists access_requests (
  id           uuid        primary key default gen_random_uuid(),
  email        text        not null,
  status       text        not null default 'pending',
  -- status: pending | approved | denied | revoked
  requested_at timestamptz not null default now(),
  reviewed_at  timestamptz
);

create unique index if not exists access_requests_email_idx on access_requests(email);

alter table access_requests enable row level security;

-- Cualquiera (incluso anónimo) puede insertar una solicitud
create policy "public_insert" on access_requests
  for insert to anon, authenticated
  with check (true);

-- Usuarios autenticados pueden leer su propio registro (para el check de revocado)
-- El admin ve todo
create policy "read_own_or_admin" on access_requests
  for select to authenticated
  using (
    email = (auth.jwt() ->> 'email')
    or (auth.jwt() ->> 'email') = 'camed@fu.do'
  );

-- Solo el admin puede actualizar (aprobar / rechazar / revocar)
create policy "admin_update" on access_requests
  for update to authenticated
  using  ((auth.jwt() ->> 'email') = 'camed@fu.do')
  with check ((auth.jwt() ->> 'email') = 'camed@fu.do');
