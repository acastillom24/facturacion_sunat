-- Logo opcional por empresa, usado en el ticket PDF (80mm). APIsPERU no
-- expone un endpoint para recuperar el logo que se sube al crear la empresa
-- allá, así que lo guardamos aquí como una URL pública a la imagen (png/jpg).

alter table companies add column if not exists logo_url text;
