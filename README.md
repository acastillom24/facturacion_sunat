# Facturación Electrónica SUNAT — Multi-empresa

Aplicación web (Next.js + Supabase) para emitir y anular boletas/facturas
electrónicas vía [APIsPERU](https://apisperu.com/), con soporte multi-empresa:
cada empresa tiene su propia URL (`/nombre-empresa`) y su propia contraseña,
de forma que puedes tener sesiones simultáneas de distintas empresas en
distintas pestañas del navegador.

## Funcionalidad actual

- Emisión de boletas (tipoDoc 03) y facturas (tipoDoc 01).
- Anulación: boletas vía Resumen Diario de bajas, facturas vía Comunicación de Baja.
- Historial de comprobantes por empresa, con el detalle de la respuesta de SUNAT.
- Descarga de PDF y ticket térmico (texto) de cualquier comprobante emitido.
- Reintento automático: si la emisión falla, se reprograma cada 1 hora
  (hasta 6 intentos) vía un cron job. También hay un botón "Reintentar ahora"
  y uno para "Cancelar reintento" si el comprobante quedó con datos erróneos.
- Carga masiva desde Excel (`/[empresa]/carga-masiva`): se sube una plantilla
  `.xlsx` (una fila = un comprobante con un solo ítem) y el sistema asigna el
  correlativo de cada fila automáticamente y las emite en orden. Máximo 40
  filas por archivo (límite pensado para el plan Hobby de Vercel, 60s por
  función); para más volumen, sube varios archivos.

### Validaciones de cliente (individuales y en la carga masiva)

- **Factura**: siempre requiere RUC (11 dígitos) y razón social.
- **Boleta**: si el total (con IGV) supera **S/ 699**, requiere DNI (8 dígitos)
  del cliente — es la regla de SUNAT para identificar al comprador. Por debajo
  de ese monto, el cliente puede quedar como "Cliente varios".

Esta regla vive en un solo lugar (`src/lib/sunat/validacion.ts`) y se aplica
tanto al formulario individual como a cada fila de la carga masiva.

## Stack

- **Next.js 16 (App Router) + TypeScript** — UI, Server Actions y API routes en un solo proyecto, pensado para Vercel.
- **Supabase (Postgres)** — base de datos. Se usa solo como Postgres vía la `service_role` key desde el servidor (no se usa Supabase Auth: cada empresa tiene su propia contraseña, no un usuario compartido).
- **Vercel Cron** — reintentos programados.

## Estructura relevante

```
src/lib/sunat/        Cliente APIsPERU (emitir, anular, PDF, ticket, monto en letras)
src/lib/db/           Acceso a Supabase (companies, correlativos, comprobantes)
src/lib/auth/         Sesión por empresa (cookie JWT, una cookie por slug) y hash de password
src/app/[empresa]/    UI: login, dashboard/historial, nuevo comprobante, detalle
src/app/api/cron/     Endpoint de reintentos
supabase/migrations/  SQL del esquema
scripts/create-company.ts   Alta de empresas (CLI)
```

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/migrations/0001_init.sql`.
3. En **Project Settings > API** copia `Project URL` y la `service_role` key (¡no la `anon` key!).

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=<genera con: openssl rand -base64 32>
CRON_SECRET=<otra cadena aleatoria>
```

### 3. Instalar dependencias y correr en local

```bash
npm install
npm run dev
```

### 4. Crear tu primera empresa

Cada empresa necesita un **token permanente de APIsPERU** (se genera al crear
la empresa en tu cuenta de APIsPERU: `POST /companies`, o desde su panel web)
y un RUC/razón social ya validados con su certificado digital allí.

```bash
npm run create-company -- \
  --slug=le-chic \
  --password="una-contraseña-segura" \
  --ruc=20613818171 \
  --razonSocial="LE CHIC IMPORT S.A.C" \
  --nombreComercial="LE CHIC" \
  --direccion="CAL.CELESTINO AVILA GODOY NRO. 672 URB. SAN GERMAN ET. DOS" \
  --provincia=LIMA --departamento=LIMA --distrito="SAN MARTIN DE PORRES" \
  --token="EL_TOKEN_PERMANENTE_DE_APISPERU"
```

Vuelve a ejecutar el mismo comando (con nuevo `--password`) para cambiar la
contraseña de una empresa existente — usa `upsert` por `slug`.

Luego entra a `http://localhost:3000/le-chic/login`.

Para agregar más empresas, repite el comando con otro `--slug`.

### 5. Desplegar en Vercel

1. Sube el repo a GitHub y en Vercel elige "Import Project".
2. Configura las mismas variables de entorno (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `CRON_SECRET`) en Vercel > Settings > Environment Variables.
3. Despliega. Cada empresa quedará accesible en `https://tu-dominio.vercel.app/nombre-empresa`.

#### Sobre el cron de reintentos

`vercel.json` define un cron cada hora (`0 * * * *`) hacia `/api/cron/reintentos`.
**En el plan Hobby (gratuito) de Vercel, los cron jobs solo pueden ejecutarse
una vez al día**, no cada hora. Opciones:

- Actualizar a Vercel Pro (permite cron cada minuto/hora).
- Usar un scheduler externo gratuito, como [cron-job.org](https://cron-job.org),
  que haga un `GET` cada hora a `https://tu-dominio.vercel.app/api/cron/reintentos`
  con el header `Authorization: Bearer <CRON_SECRET>`.

Ambas opciones usan el mismo endpoint; no requieren cambios de código.

## Notas de diseño

- **Autenticación por empresa**: cada empresa tiene su propio hash de
  contraseña en la tabla `companies`. Al iniciar sesión se firma un JWT y se
  guarda en una cookie **con nombre distinto por empresa** (`sunat_session_<slug>`),
  así una misma persona puede estar logueada en varias empresas a la vez, en
  pestañas distintas, sin que las sesiones se pisen.
- **RLS**: las tablas tienen Row Level Security activado sin policies; solo
  la `service_role` key (usada exclusivamente en el servidor) puede leer/escribir.
  El navegador nunca recibe esa key.
- **Reimpresión de PDF/ticket**: APIsPERU no almacena el cuerpo de tus
  comprobantes, por eso se guarda el `payload` completo enviado en la tabla
  `comprobantes` — se reutiliza para pedir el PDF o regenerar el ticket
  cuando quieras, sin volver a emitir.
- **Reintentos**: al fallar una emisión se guarda `proximo_intento_at = ahora + 1h`
  y el estado vuelve a `pendiente`; el cron recoge todo lo vencido. Tras 6
  intentos fallidos pasa a `error` (ya no se reintenta solo; puede reintentarse
  manualmente desde el detalle del comprobante).

## Próximas mejoras posibles

- Notas de crédito/débito (`/note/send`), retenciones y percepciones (la API de
  APIsPERU ya los soporta, ver `files/swagger.json`).
- Reportes/exportación del historial.
- Roles dentro de una misma empresa (cajero vs. administrador).
