# Facturación Electrónica SUNAT — Multi-empresa

Aplicación web (Next.js + Neon) para emitir y anular boletas/facturas
electrónicas, con soporte multi-empresa y dos proveedores de emisión
(configurables por empresa): [APIsPERU](https://apisperu.com/) o una API propia
de SUNAT (repo `apis`). Incluye un panel de administración (`/admin`) para
gestionar empresas y API keys.
cada empresa tiene su propia URL (`/nombre-empresa`) y su propia contraseña,
de forma que puedes tener sesiones simultáneas de distintas empresas en
distintas pestañas del navegador.

## Funcionalidad actual

- Emisión de boletas (tipoDoc 03) y facturas (tipoDoc 01).
- Anulación: boletas vía Resumen Diario de bajas, facturas vía Comunicación de Baja.
- Historial de comprobantes por empresa, con el detalle de la respuesta de SUNAT.
- Descarga de PDF A4 (vía APIsPERU) y de ticket térmico 80mm en PDF (generado
  localmente, con QR y hash) de cualquier comprobante emitido. Tras una carga
  masiva, se pueden descargar todos los tickets emitidos juntos en un `.zip`,
  cada archivo nombrado `{serie}-{correlativo}.pdf`.
- Reintento automático: si la emisión falla, se reprograma cada 1 hora
  (hasta 6 intentos) vía un cron job. También hay un botón "Reintentar ahora"
  y uno para "Cancelar reintento" si el comprobante quedó con datos erróneos.
- Carga masiva desde Excel (`/[empresa]/carga-masiva`): se sube una plantilla
  `.xlsx` y el sistema asigna el correlativo de cada comprobante
  automáticamente y los emite en orden. Por defecto cada fila es un
  comprobante con un solo ítem; si un comprobante necesita varios ítems,
  se repite el mismo número en la columna **Grupo** en esas filas — el
  tipo, la serie y el cliente se toman de la primera fila del grupo, y cada
  fila del grupo aporta un ítem. Máximo 40 filas por archivo (límite pensado
  para el plan Hobby de Vercel, 60s por función); para más volumen, sube
  varios archivos.

## Proveedores de emisión (por empresa)

Cada empresa elige su proveedor (`companies.sunat_provider`) desde su ficha en
`/admin`; no hay variable de entorno global para esto. Cada comprobante guarda
con qué proveedor se emitió, y las anulaciones y el PDF usan ese mismo.

- **APIsPERU**: solo requiere el token de la empresa.
- **API propia**: requiere el token (una API key de la API propia, creada en
  `/admin/keys` con el **correo del dueño**, ya que la API asocia las empresas a
  esa cuenta) y, además, ambiente (beta/producción), usuario y clave SOL, y
  certificado digital `.p12`/`.pfx`. Guardar la ficha registra la empresa en la
  API propia.

El token de cada empresa es obligatorio en ambos casos y se guarda cifrado.

## Panel de administración (`/admin`)

Acceso con contraseña + código 2FA (TOTP), con opciones de restringir por IP y
por subdominio dedicado. Permite:

- Crear empresas y editar su proveedor, token, SOL y certificado, en un solo
  formulario por empresa. Los formularios conservan lo escrito cuando hay un
  error y resaltan en rojo el campo con problema.
- Suspender/reactivar empresas, restablecer su contraseña, subir el logo y
  fijar correlativos.
- **API keys** (`/admin/keys`): listar con dueño y uso mensual/diario contra su
  límite (marca revocadas y vencidas), crear (la key completa se muestra una
  sola vez; se crean con producto `sunat`), editar límites y vencimiento, y
  revocar o restaurar.
- Cada acción verifica la sesión admin y queda registrada en una auditoría.

### Validaciones de cliente (individuales y en la carga masiva)

- **Factura**: siempre requiere RUC (11 dígitos) y razón social.
- **Boleta**: si el total (con IGV) supera **S/ 699**, requiere DNI (8 dígitos)
  del cliente — es la regla de SUNAT para identificar al comprador. Por debajo
  de ese monto, el cliente puede quedar como "Cliente varios".

Esta regla vive en un solo lugar (`src/lib/sunat/validacion.ts`) y se aplica
tanto al formulario individual como a cada fila de la carga masiva.

## Stack

- **Next.js 16 (App Router) + TypeScript** — UI, Server Actions y API routes en un solo proyecto, pensado para Vercel.
- **API propia de SUNAT** (opcional) — servicio aparte (repo `apis`), configurado con `SUNAT_API_URL`.
- **Neon (Postgres)** — base de datos, accedida desde el servidor con `@neondatabase/serverless` (`DATABASE_URL`). No hay servicio de auth externo: cada empresa tiene su propia contraseña.
- **Cloudinary** — almacenamiento de logos (carpeta `facturacion_sunat`).
- **Vercel Cron** — reintentos programados.

## Estructura relevante

```
src/lib/sunat/        Clientes APIsPERU y API propia (emitir, anular, PDF, ticket, API keys)
src/lib/crypto/       Cifrado de los tokens de empresa
src/app/admin/        Panel de administración (empresas y API keys)
src/lib/db/           Acceso a Neon (companies, correlativos, comprobantes)
src/lib/auth/         Sesión por empresa (cookie JWT, una cookie por slug) y hash de password
src/app/[empresa]/    UI: login, dashboard/historial, nuevo comprobante, detalle
src/app/api/cron/     Endpoint de reintentos
db/migrations/  SQL del esquema
scripts/create-company.ts   Alta de empresas (CLI)
```

## Puesta en marcha

### 1. Crear el proyecto en Neon

1. Crea un proyecto en [neon.tech](https://neon.tech).
2. Aplica, en orden, los archivos de `db/migrations/` (`0001_init.sql` hasta
   `0005_provider_audit.sql`) con la connection string directa (sin `-pooler`).
   Sin las funciones del `0002` la app no puede asignar correlativos.
3. Copia la connection string pooled en `DATABASE_URL` y la directa en `DIRECT_DATABASE_URL`.

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores; el propio archivo
documenta cómo generar cada uno. Variables:

| Variable | Uso |
|---|---|
| `DATABASE_URL`, `DIRECT_DATABASE_URL` | Base de datos Neon (pooled / directa para migraciones) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Logos (solo servidor) |
| `SESSION_SECRET` | Firma de las cookies de sesión por empresa |
| `CRON_SECRET` | Autoriza la llamada al cron de reintentos |
| `ADMIN_PASSWORD_HASH` | Hash de la contraseña de `/admin` |
| `TOKEN_ENCRYPTION_KEY` | Clave para cifrar los tokens de empresa |
| `ADMIN_TOTP_SECRET` | 2FA de `/admin` |
| `ADMIN_ALLOWED_IPS`, `ADMIN_HOST` | Opcionales: restringir `/admin` por IP / subdominio |
| `SUNAT_API_URL` | URL de la API propia |
| `ADMIN_API_SECRET` | Administración de API keys; debe coincidir con el de la API |

> No subas `.env.local` al repositorio ni compartas estos valores. No cambies
> `TOKEN_ENCRYPTION_KEY` una vez que hay empresas guardadas: sus tokens dejarían
> de poder descifrarse.

### 3. Instalar dependencias y correr en local

```bash
npm install
npm run dev
```

### 4. Crear tu primera empresa

Lo más cómodo es hacerlo desde el panel `/admin` (botón "Nueva empresa"). Como
alternativa, el script de línea de comandos que sigue.

Con APIsPERU, cada empresa necesita un **token permanente de APIsPERU** (se genera al crear
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
  --token="EL_TOKEN_PERMANENTE_DE_APISPERU" \
  --logoUrl="/logos/le-chic.png"
```

`--logoUrl` es opcional: es lo que se muestra arriba del ticket 80mm. APIsPERU
no expone el logo que subiste allá al crear la empresa (solo lo usa
internamente para el PDF A4), así que hay que indicarlo aparte. Dos formas:

- **Recomendado, sin costo**: coloca el archivo (png/jpg) en `public/logos/`
  del proyecto (ej. `public/logos/le-chic.png`) y usa una ruta que empiece con
  `/` (ej. `--logoUrl="/logos/le-chic.png"`). El ticket lo lee directo del
  disco de la función serverless — no hay ninguna petición de red ni consulta
  extra a la base de datos por cada ticket generado.
- **URL externa**: cualquier URL `http(s)://...` pública (tu propio hosting,
  Cloudinary, etc.). En este caso sí se hace una petición HTTP por cada
  ticket generado; para un logo pequeño (unos KB) el costo es marginal, pero
  si buscas costo cero usa la opción anterior.

Desde el panel `/admin` también se puede subir o cambiar el logo de una empresa
(PNG/JPG, máx. 500 KB): se guarda en Cloudinary, carpeta `facturacion_sunat`, y
la URL queda en `companies.logo_url`.

Vuelve a ejecutar el mismo comando (con nuevo `--password`) para cambiar la
contraseña de una empresa existente — usa `upsert` por `slug`.

Luego entra a `http://localhost:3000/le-chic/login`.

Para agregar más empresas, repite el comando con otro `--slug`.

#### Continuar la numeración de un sistema anterior

Si la empresa ya emitía en otro sistema, fija el **último** número usado de cada
serie; el siguiente comprobante será ese número + 1 (sin saltos, ya que el
correlativo debe ser secuencial):

```bash
npm run set-correlativo -- --slug=le-chic --tipo=03 --serie=B001 --ultimo=5838  # siguiente: B001-5839
npm run set-correlativo -- --slug=le-chic --tipo=01 --serie=F001 --ultimo=57    # siguiente: F001-58
```

`--tipo` es `03` (boleta) o `01` (factura). Verifica antes que ese sea de verdad
el último número emitido y que el sistema anterior ya no use la serie; si no
estás seguro, usa una serie nueva (ej. `B002`) desde 1.

### 5. Desplegar en Vercel

1. Sube el repo a GitHub y en Vercel elige "Import Project".
2. Configura las mismas variables de entorno de la tabla anterior en Vercel > Settings > Environment Variables.
3. Despliega. Cada empresa quedará accesible en `https://tu-dominio.vercel.app/nombre-empresa`.

#### Sobre el cron de reintentos

`vercel.json` define un cron diario (`0 12 * * *`, 07:00 hora de Lima) hacia `/api/cron/reintentos`.
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
- **Consumo en la base de datos**: el cliente de Neon (`src/lib/db/client.ts`) se cachea a nivel de
  módulo. Las
  consultas seleccionan solo las columnas que cada pantalla necesita — el
  historial (`listarComprobantes`) no trae `payload`/`items`/`sunat_response`,
  que son los campos JSONB más pesados. El correlativo (boletas/facturas) y el
  correlativo de resumen/baja se reservan con una función SQL atómica
  (`db/migrations/0002_correlativos_rpc.sql`, funciones
  `siguiente_correlativo` / `siguiente_correlativo_resumen`) en vez de un
  SELECT + UPDATE desde la app: es una sola ida a la base de datos en lugar de
  dos, y de paso evita que dos emisiones simultáneas puedan repetir el mismo
  número.

- **Secretos**: los tokens de empresa se guardan cifrados en la base de datos
  y solo se descifran en el servidor al llamar al proveedor.

## Próximas mejoras posibles

- Notas de crédito/débito (`/note/send`), retenciones y percepciones (la API de
  APIsPERU ya los soporta, ver `files/swagger.json`).
- Reportes/exportación del historial.
- Roles dentro de una misma empresa (cajero vs. administrador).

## Seguridad

- Toda acción de servidor de `/[empresa]` valida la sesión de la empresa
  (`getCompanyFromSession`); el `proxy.ts` por sí solo no basta, porque las
  acciones pueden invocarse por POST desde cualquier ruta.
- `/api/cron/reintentos` exige `CRON_SECRET`; si la variable no está definida, responde 401.
- Todas las consultas SQL son parametrizadas (`src/lib/db/client.ts`).
- Revisa periódicamente `npm audit` y mantén `next` actualizado.
