# CUBI · Tesorería, Pagos y Cobros

App interna de tesorería para CUBI Mobiliario de Diseño SL. Sustituye al
Excel `PAGOS-COBROS_PROYECCIONES_18-09.xlsx` como fuente de verdad: el
Excel solo se usó para la carga histórica inicial.

Stack: Next.js 14 (App Router) + TypeScript + Prisma + Postgres + Tailwind +
Recharts. Protegida por una única contraseña de acceso (sin sistema de
usuarios).

## Estructura

- `prisma/schema.prisma` — modelo de datos (Pago, Cobro, CobroEspecial,
  EntidadFinanciera/ProductoFinanciero, SupuestoTesoreria).
- `lib/` — lógica de negocio: clasificación de partidas, semáforo de
  cobros, motor de amortización de préstamos, motor de proyección de
  tesorería a N meses, KPIs del dashboard.
- `lib/excel-import.ts` — parseo de Excel/CSV reutilizado por el script de
  carga inicial y por la pantalla web "Importar Excel".
- `scripts/import-excel.ts` — script de carga inicial (una sola vez).
- `app/(app)/*` — las 10 pantallas de la app (dashboard, pagos, cobros,
  cobros especiales, resumen, bancos, amortizaciones, proyección, informe de
  posición, importar).
- `app/login`, `middleware.ts`, `lib/auth.ts` — autenticación por contraseña.

## Decisiones de modelado (Excel → app)

Se verificaron manualmente todas las hojas del Excel real antes de fijar el
modelo. Diferencias respecto a un primer boceto, y por qué:

- **`Pago.importe` es un único campo** (no `importeGiro`/`importeTrf`
  separados): en el Excel cada fila de pago tiene el importe en Giro *o* en
  Transferencia, nunca en ambos — el campo `situacion` ya distingue cuál es.
- **`Pago.estado` (PENDIENTE/PAGADO) es explícito y editable**, no derivado
  solo de la fecha: así se puede marcar un pago como hecho aunque su fecha
  sea futura, o viceversa.
- **`Pago.remesaSemana`**: sustituye a la hoja "trfs sem" del Excel (que era
  solo una agrupación manual, redundante con PAGOS). En la pantalla
  **Pagos → Remesas semanales de trf** se puede asignar cada transferencia
  pendiente a la semana en la que se va a remesar, y retrasarla si hace
  falta.
- **La hoja PAGOS tenía dos tablas** (una de pagos programados/pendientes en
  columnas B:G, y una histórica de pagos ya ejecutados en columnas X:AB).
  Ambas se importan a la misma tabla `Pago`.
- **La "partida"** de cada pago (Bancos, Tarjetas, Seguros, Personal,
  Impuestos, Varios/Previsión, Suministros/Otros, Proveedores) se clasifica
  automáticamente por palabras clave en la observación
  (`lib/partidas.ts`), replicando la lógica manual de la hoja "Resumen
  Pagos" del Excel.
- **Los cuadros de amortización no se guardan fila a fila**: se calculan en
  vivo (`lib/amortizacion.ts`, sistema francés) a partir del saldo
  pendiente actual, la cuota y el tipo de interés de cada
  `ProductoFinanciero`. Solo se persistiría un cuadro fila a fila si algún
  préstamo tuviera una carencia o tramos de tipo no estándar (campo
  `cuadroPersonalizado`).
- **La proyección de tesorería usa datos reales cuando existen**: a
  diferencia del Excel (que fijaba "a mano" hasta qué mes usar datos reales
  de PAGOS), la app usa la suma real de pagos registrados para cada mes
  cuando los hay, y solo recurre a los supuestos (`SupuestoTesoreria`) para
  los meses sin datos todavía. Por eso la proyección mejora sola según se
  van registrando pagos reales, sin tocar ningún supuesto a mano.
- **La "2ª capa" de análisis de la hoja "Situación Bancaria"** (embudo de
  conversión a caja, calidad de liquidez, riesgo 30/60/90 días, capacidad
  financiera, KPIs de gestión, panel de alertas automáticas, y un escenario
  de proyección a 12 meses) se implementó como un **informe puntual**
  (pantalla **Informe de posición**, `/informe`) en vez de como pantalla
  editable, porque casi todo ese contenido es un cálculo de "hoy", no datos
  que se editen a mano. Se calcula en vivo con `lib/informe.ts` a partir de
  Pagos/Cobros/Bancos/Proyección, con 3 insumos manuales que no se pueden
  derivar de facturas (pedidos pendientes de servir, inversiones pendientes,
  colchón de seguridad en meses de cuota — editables en la propia pantalla).
  El escenario a 12 meses **no se reimplementó aparte** (el del Excel tenía
  fórmulas rotas `#REF!`): reutiliza directamente los primeros 12 meses del
  motor de Proyección ya existente. Se puede exportar a Excel y a PDF desde
  la propia pantalla.

## Desarrollo local

```bash
npm install
cp .env.example .env   # y rellena DATABASE_URL y APP_PASSWORD
npx prisma migrate dev --name init
npm run dev
```

### Carga inicial desde el Excel histórico

Ejecuta esto **una sola vez**, con el Excel original:

```bash
npm run import:excel -- /ruta/al/PAGOS-COBROS_PROYECCIONES_18-09.xlsx
```

- Importa Pagos, Cobros, Cobros especiales, Entidades/Productos
  financieros y los supuestos de Proyección de tesorería.
- Es idempotente: si ejecutas el mismo fichero dos veces, el script lo
  detecta (por hash del contenido) y no vuelve a importar nada, salvo que
  pases `--force`.
- Usa `--dry-run` para ver el resumen de lo que importaría sin escribir
  nada en la base de datos.

Si no tienes conexión directa (TCP, puerto 5432) a la base de datos —p.ej.
solo puedes salir por HTTPS— usa en su lugar:

```bash
npx tsx scripts/generate-import-sql.ts /ruta/al/excel.xlsx > carga-inicial.sql
```

Genera el mismo resultado como SQL plano (sin depender de Prisma Client ni
de una conexión a base de datos), listo para pegar en el editor SQL de
Neon/Vercel.

### Sincronizar con un Excel actualizado (sin duplicar lo ya cargado)

Si más adelante quieres volver a cargar una versión actualizada del Excel
completo (por ejemplo, para refrescar los saldos bancarios o añadir pagos
nuevos que llevas en el propio Excel en vez de dar de alta uno a uno), usa:

```bash
npx tsx scripts/generate-sync-sql.ts /ruta/al/excel-actualizado.xlsx [directorio-salida]
```

A diferencia de `generate-import-sql.ts` (pensado para una base de datos
vacía), este script es seguro para ejecutarlo sobre una base de datos que
**ya tiene datos**:

- Pagos, Cobros y Cobros especiales: solo se insertan los que no existan ya
  (mismo pago/factura y fecha) — nunca duplica.
- Bancos (entidades y productos financieros) y el supuesto de proyección:
  se **actualizan** con los valores del Excel (saldos, cuotas, vencimientos…).
  Los 3 insumos manuales del Informe de posición no se tocan, porque no
  vienen del Excel.

Al igual que el de carga inicial, genera SQL plano para pegar en el editor
de Neon/Vercel si no hay conexión TCP directa a la base de datos. Como ese
editor solo admite ~100.000 caracteres por ejecución, el script escribe
varios ficheros `<excel>-sync-parteN-de-M.sql` (cada uno ya es una sola
sentencia por debajo del límite) — pégalos y ejecútalos **en orden**, uno
detrás de otro.

A partir de esa carga inicial, la app es la fuente de verdad. Los pagos y
cobros nuevos se dan de alta desde la propia aplicación: a mano, o subiendo
un Excel (mismo formato de hoja PAGOS/COBROS) o un CSV sencillo desde la
pantalla **Importar Excel** — ahí mismo se ve una previsualización con
detección de duplicados antes de confirmar.

## Despliegue en Vercel

1. **Sube este repositorio a GitHub** (o el proveedor Git que uses) si aún
   no lo has hecho.
2. **Importa el proyecto en Vercel**: [vercel.com/new](https://vercel.com/new)
   → selecciona el repositorio. Framework se detecta solo (Next.js).
3. **Crea la base de datos Postgres**: en el proyecto de Vercel, pestaña
   *Storage* → *Create Database* → Postgres (Neon). Al conectarla al
   proyecto, Vercel añade automáticamente la variable `DATABASE_URL` (y
   variantes `POSTGRES_*`) a tu entorno — si tu plan solo te da un nombre
   distinto de variable, renómbralo a `DATABASE_URL` en *Settings →
   Environment Variables*, ya que es el nombre que usa `prisma/schema.prisma`.
4. **Añade la variable `APP_PASSWORD`** en *Settings → Environment
   Variables* (Production y Preview), con la contraseña que quieras usar
   para entrar a la app.
5. **Ejecuta las migraciones de Prisma en producción.** La forma más simple:
   añade este *Build Command* en *Settings → General → Build & Development
   Settings*:
   ```
   npx prisma migrate deploy && npm run build
   ```
   (así cada deploy aplica las migraciones pendientes automáticamente).
6. **Primer deploy**: lanza el deploy desde Vercel. Cuando termine, entra a
   la URL que te da Vercel → `/login` → introduce tu `APP_PASSWORD`.
7. **Carga inicial de datos**: el script `npm run import:excel` se conecta
   directamente a `DATABASE_URL`, así que puedes ejecutarlo **desde tu
   ordenador** apuntando al `DATABASE_URL` de producción (cópialo de las
   variables de entorno de Vercel a tu `.env` local temporalmente, o
   pásalo inline: `DATABASE_URL="..." npm run import:excel -- excel.xlsx`).
   Hazlo una sola vez, con la app ya desplegada.

### Variables de entorno necesarias

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión Postgres (la da Vercel Postgres/Neon) |
| `APP_PASSWORD` | Contraseña única de acceso a la app |

### Notas de seguridad

- La sesión se guarda en una cookie firmada (`httpOnly`, `secure` en
  producción, 30 días de caducidad) derivada de `APP_PASSWORD` — cambiar la
  contraseña invalida automáticamente las sesiones existentes.
- La librería `xlsx` (SheetJS) usada para leer Excel tiene vulnerabilidades
  conocidas sin parche disponible a día de hoy (prototype pollution / ReDoS
  al parsear ficheros maliciosamente manipulados). Al ser una app de un
  único usuario protegida por contraseña, el riesgo es bajo, pero solo debe
  usarse para subir ficheros de confianza, no ficheros de terceros.
- **Acceso a Cobros especiales**: sigue habiendo una única contraseña
  (`APP_PASSWORD`), pero en el login hay una casilla "Soy Simón" que marca
  la sesión con un rol (`simon` / `user`) dentro de la propia cookie
  firmada. La pantalla y las rutas de `/cobros-especiales` están bloqueadas
  en `middleware.ts` para cualquier sesión que no sea `simon` (no solo
  ocultas del menú), así que no se puede acceder aunque se escriba la URL
  a mano.
