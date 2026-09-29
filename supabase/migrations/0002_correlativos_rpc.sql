-- Funciones para reservar el siguiente correlativo en una sola vuelta a la
-- base de datos (antes eran un SELECT + un INSERT/UPDATE desde la app, lo
-- cual además de gastar el doble de requests contra Supabase no era atómico:
-- dos emisiones casi simultáneas podían leer el mismo "ultimo_correlativo" y
-- terminar generando el mismo número). El INSERT ... ON CONFLICT hace ambas
-- cosas en una sola instrucción atómica del lado de Postgres.

create or replace function siguiente_correlativo(
  p_company_id uuid,
  p_tipo_doc text,
  p_serie text
) returns integer
language plpgsql
as $$
declare
  v_valor integer;
begin
  insert into correlativos (company_id, tipo_doc, serie, ultimo_correlativo)
  values (p_company_id, p_tipo_doc, p_serie, 1)
  on conflict (company_id, tipo_doc, serie)
  do update set ultimo_correlativo = correlativos.ultimo_correlativo + 1
  returning ultimo_correlativo into v_valor;
  return v_valor;
end;
$$;

create or replace function siguiente_correlativo_resumen(
  p_company_id uuid,
  p_fecha date
) returns integer
language plpgsql
as $$
declare
  v_valor integer;
begin
  insert into resumen_correlativos (company_id, fecha, ultimo_correlativo)
  values (p_company_id, p_fecha, 1)
  on conflict (company_id, fecha)
  do update set ultimo_correlativo = resumen_correlativos.ultimo_correlativo + 1
  returning ultimo_correlativo into v_valor;
  return v_valor;
end;
$$;
