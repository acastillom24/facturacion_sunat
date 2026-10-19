-- Proveedor SUNAT por empresa (lo controla el admin, no la empresa).
alter table companies
  add column if not exists sunat_provider text not null default 'apisperu'
    check (sunat_provider in ('apisperu', 'propia'));

alter table companies alter column apisperu_token drop not null;
