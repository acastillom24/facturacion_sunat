-- Proveedor con el que se emitió cada comprobante (anular/PDF deben ir al mismo).
alter table comprobantes add column if not exists sunat_provider text
  check (sunat_provider in ('apisperu', 'propia'));
-- Lo emitido hasta ahora salió por APIsPERU.
update comprobantes set sunat_provider = 'apisperu' where estado in ('emitido','anulando','anulado','error_anulacion') and sunat_provider is null;

-- Empresa suspendida: no puede iniciar sesión ni emitir.
alter table companies add column if not exists activa boolean not null default true;

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  accion text not null,
  company_slug text,
  detalle jsonb,                -- nunca secretos
  created_at timestamptz not null default now()
);
alter table admin_audit_log enable row level security;
