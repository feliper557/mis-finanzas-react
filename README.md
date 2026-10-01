# Mis Finanzas

Aplicación personal de presupuesto, gastos, inversiones, ahorros y préstamos.

SPA en **React 19 + Vite + Tailwind 4** sobre una API en **ASP.NET Core 10 + EF Core + PostgreSQL 17**, con **Firebase Authentication** para el inicio de sesión. Se despliega en un VPS de Hostinger que comparte con otra aplicación (Lactumama).

```
Internet :443 ──> caddy (de Lactumama, único servicio en 80/443)
                   ├── <dominio-lactumama>   -> (Lactumama)
                   └── finanzas.<dominio>    -> misfinanzas-web :80  (nginx + SPA)
                                                    └── /api/ -> misfinanzas-api :8080
                                                                      └── PostgreSQL 17
                                                                          (base "misfinanzas")
```

## Estructura

| Ruta | Qué es |
|---|---|
| `src/` | La SPA. Cinco pestañas: Resumen, Presupuestos, Inversiones, Préstamos, Tendencias. |
| `src/context/DataContext.tsx` | **Toda la persistencia del cliente.** Expone un único `mutate(fn)` sobre el documento completo. |
| `server/src/MisFinanzas.Api/` | La API: Minimal APIs, EF Core, autenticación de Firebase. |
| `server/src/MisFinanzas.Api/Data/FinanzasMapper.cs` | **La pieza central**: traduce entre las tablas y el documento que espera el cliente. |
| `server/tools/MisFinanzas.Importer/` | Reconstruye la base desde un volcado de Firestore. Se usa una vez. |
| `server/tests/` | Pruebas de integración contra PostgreSQL real (Testcontainers). |
| `deploy/` | Compose de producción, bloque de Caddy, respaldo y plantilla de entorno. |
| `docs/handoff-lactumama.md` | **Los cambios que hay que hacer en Lactumama.** No se ejecutan desde aquí. |

## Por qué la API habla en documentos y no en recursos

El cliente entero está construido sobre un único `mutate(fn)` que muta el documento completo, herencia de cuando los datos vivían en un solo documento de Firestore. Reescribirlo a endpoints granulares habría significado tocar los cinco tabs y sus ~1.800 líneas de formularios.

En vez de eso, **la API guarda en tablas relacionales pero conversa en documentos**: `GET /api/data` ensambla el documento desde las tablas y `PUT /api/data` lo vuelca por diferencias dentro de una transacción. El resultado es almacenamiento relacional real —claves foráneas, índices, `numeric(14,2)`, consultas SQL— con un solo archivo del frontend modificado.

## Desarrollo

### Todo en Docker

```bash
cp .env.example .env    # rellenar con los valores de la consola de Firebase
docker compose up --build
# SPA en http://localhost:5174 · API en http://localhost:8081
```

### El frontend aparte (recarga en caliente)

```bash
docker compose up db misfinanzas-api    # base + API
npm install && npm run dev              # http://localhost:5173
```

Con `VITE_API_URL=http://localhost:8081` en `.env`. En producción esa variable va vacía porque la SPA y la API comparten origen tras nginx y CORS no interviene.

### Comprobaciones

```bash
npm run lint && npx tsc -b && npm run build   # frontend
cd server && dotnet test                      # API (levanta PostgreSQL con Testcontainers)
```

Las pruebas usan **PostgreSQL de verdad**, no un proveedor en memoria: la mitad de lo que hay que comprobar (claves foráneas compuestas, restricciones `CHECK`, `FOR UPDATE`) no existe fuera de Postgres.

### Migraciones

```bash
cd server
dotnet tool restore
dotnet dotnet-ef migrations add <Nombre> --project src/MisFinanzas.Api --output-dir Data/Migrations
```

Se aplican solas al arrancar la API (`Database__AutoMigrate=true`). Es seguro porque hay una única réplica.

## Migración de los datos desde Firestore

El volcado lo genera el script `bk/dump.js` del respaldo (`firebase-admin`, recorrido recursivo de colecciones). Produce un JSON plano con un elemento por documento.

```bash
cd server
dotnet run --project tools/MisFinanzas.Importer -- \
  --file /ruta/a/firestore-backup.json \
  --connection "Host=...;Database=misfinanzas;Username=misfinanzas;Password=..." \
  --truncate \
  --dry-run          # ensaya y compara sin confirmar nada
```

El importador:

- Reutiliza `FinanzasMapper`, el mismo código que usa la API en producción, de modo que la carga inicial y el funcionamiento diario no pueden divergir.
- Aplica la lógica de `normalize()` que vivía en el cliente: relleno de `cat.group`, fusión de los arrays heredados `nu`/`hapi`/`novilla` y alcancía `sp_default` por defecto.
- **Verifica**: reconstruye el documento desde PostgreSQL y lo compara campo a campo con el de origen. Si hay una sola diferencia de importe, conteo o referencia, deshace la transacción y falla.
- Es repetible: `--truncate` vacía las tablas de cada cuenta antes de importarla.

> El volcado contiene datos financieros reales. `.gitignore` lo excluye; no debe acabar en el repositorio.

## Tres detalles del modelo que no son evidentes

Salieron del análisis de los datos reales y son fáciles de romper al tocar el esquema:

1. **`transactions.fecha` admite `NULL`.** 33 de las 229 transacciones reales no tienen fecha.
2. **`saving_entries.monto` admite negativos.** Así registra los retiros el formulario de la SPA. Un `CHECK (monto > 0)`, que es lo natural escribir en una tabla de dinero, rompería la importación.
3. **El orden de los arrays se guarda en una columna `orden`.** No es deducible del identificador: los `invItems` del usuario principal llegan como `11, 9, 1, 2…` y el cliente los pinta en ese orden.

## Concurrencia

Cada cuenta lleva un contador `rev`. El cliente lo devuelve en cada `PUT`; si no coincide con el almacenado, la API responde **409** con `code: "revision_conflict"` y el cliente recarga y avisa en la cabecera.

Esto corrige un fallo real de la versión anterior: con Firestore cada guardado sobreescribía el documento entero, así que escribir desde el móvil y el portátil a la vez **borraba datos en silencio**.

## Despliegue

Ver `deploy/` y, sobre todo, **`docs/handoff-lactumama.md`**.

Dos reglas que no se negocian:

- **Nunca se compila en el servidor.** Tiene 1 vCPU compartido; un `docker build` de .NET o Vite dejaría sin responder también a Lactumama. Las imágenes las construye GitHub Actions y se publican en GHCR; el VPS solo hace `pull`.
- **Este proyecto no toca Lactumama.** Comparten Caddy y PostgreSQL, pero todo cambio que recaiga sobre ella está documentado en el entregable, con verificación y reversión, para ejecutarse desde su propio proyecto.

Reversión de un despliegue:

```bash
cd /opt/misfinanzas
echo "IMAGE_TAG=<sha-anterior>" > .image-tag
docker compose --env-file .env --env-file .image-tag -f docker-compose.prod.yml up -d
```
