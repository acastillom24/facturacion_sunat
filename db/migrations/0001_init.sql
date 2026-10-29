-- Esquema inicial: facturación electrónica multi-empresa (SUNAT / APIsPERU)
-- Ejecutar en el SQL editor de Supabase (o vía `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- usado en la ruta /{slug}
  password_hash text not null,             -- bcrypt, credenciales propias de la empresa
  ruc text not null,
  razon_social text not null,
  nombre_comercial text,
  ubigueo text not null default '150101',
  departamento text not null default 'LIMA',
  provincia text not null default 'LIMA',
  distrito text not null default 'LIMA',
  direccion text not null default '',
  cod_local text not null default '0000',
  apisperu_token text not null,            -- token permanente de la empresa en APIsPERU
  igv_rate numeric not null default 0.18,
  created_at timestamptz not null default now()
);

create table if not exists correlativos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tipo_doc text not null,                  -- '01' factura, '03' boleta
  serie text not null,
  ultimo_correlativo integer not null default 0,
  unique (company_id, tipo_doc, serie)
);

create table if not exists resumen_correlativos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  fecha date not null,
  ultimo_correlativo integer not null default 0,
  unique (company_id, fecha)
);

create table if not exists comprobantes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  tipo_doc text not null,                  -- '01' factura, '03' boleta
  serie text not null,
  correlativo integer not null,
  moneda text not null default 'PEN',
  forma_pago text not null default 'Contado',
  cliente jsonb not null,
  items jsonb not null,
  mto_oper_gravadas numeric not null default 0,
  mto_igv numeric not null default 0,
  mto_imp_venta numeric not null default 0,
  payload jsonb not null,                  -- payload enviado a APIsPERU (para reintentos / reimpresión)
  estado text not null default 'pendiente',
  -- pendiente | emitido | rechazado | error | cancelado | anulando | anulado | error_anulacion
  sunat_response jsonb,
  hash text,
  fecha_emision timestamptz not null default now(),
  intentos integer not null default 0,
  proximo_intento_at timestamptz,
  anulacion jsonb,                          -- {correlativoResumen, ticket, estado, resultado, fecResumen}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tipo_doc, serie, correlativo)
);

create index if not exists comprobantes_company_idx on comprobantes (company_id, created_at desc);
create index if not exists comprobantes_retry_idx on comprobantes (estado, proximo_intento_at)
  where estado = 'pendiente';

-- RLS habilitado sin policies: solo la service_role key (usada por el backend
-- de Next.js) puede leer/escribir. El navegador nunca recibe esa key.
alter table companies enable row level security;
alter table correlativos enable row level security;
alter table resumen_correlativos enable row level security;
alter table comprobantes enable row level security;
