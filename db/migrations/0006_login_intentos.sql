-- Límite de intentos de login compartido entre instancias serverless.
create table if not exists login_intentos (
  clave text primary key,                  -- 'admin' o 'empresa:<slug>'
  intentos integer not null default 0,
  bloqueado_hasta timestamptz
);
