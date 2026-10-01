# Mis Finanzas

Aplicación personal de presupuesto, gastos, inversiones, ahorros y préstamos.

SPA en **React 19 + Vite + Tailwind 4** sobre una API en **ASP.NET Core 10 + EF Core + PostgreSQL 17**, con **Firebase Authentication** para el inicio de sesión.

```
Navegador
   ├── Netlify (SPA estática)
   │      └── /api/*  reenviado al mismo origen, sin CORS
   │             └── Cloud Run (API .NET, escala a cero)
   │                    └── Neon (PostgreSQL gestionado)
   └── Firebase Authentication (solo el inicio de sesión)
```

Las tres piezas caben en capas gratuitas. El precio es que **el primer acceso del día tarda unos 3-5 segundos** mientras despiertan el contenedor y la base: aceptable para una app personal, y lo que permite que no cueste nada.

## Estructura

| Ruta | Qué es |
|---|---|
| `src/` | La SPA. Cinco pestañas: Resumen, Presupuestos, Inversiones, Préstamos, Tendencias. |
| `src/context/DataContext.tsx` | **Toda la persistencia del cliente.** Expone un único `mutate(fn)` sobre el documento completo. |
| `server/src/MisFinanzas.Api/` | La API: Minimal APIs, EF Core, autenticación de Firebase. |
| `server/src/MisFinanzas.Api/Data/FinanzasMapper.cs` | **La pieza central**: traduce entre las tablas y el documento que espera el cliente. |
| `server/tools/MisFinanzas.Importer/` | Reconstruye la base desde un volcado de Firestore. Se usa una vez. |
| `server/tests/` | Pruebas de integración contra PostgreSQL real (Testcontainers). |
| `docs/despliegue.md` | **El runbook de puesta en marcha**: Neon, Cloud Run, Netlify, importación y respaldo. |
| `.github/workflows/` | CI (pruebas, imagen, migraciones y despliegue) y el respaldo diario cifrado. |

## Por qué la API habla en documentos y no en recursos

El cliente entero está construido sobre un único `mutate(fn)` que muta el documento completo, herencia de cuando los datos vivían en un solo documento de Firestore. Reescribirlo a endpoints granulares habría significado tocar los cinco tabs y sus ~1.800 líneas de formularios.

En vez de eso, **la API guarda en tablas relacionales pero conversa en documentos**: `GET /api/data` ensambla el documento desde las tablas y `PUT /api/data` lo vuelca por diferencias dentro de una transacción. El resultado es almacenamiento relacional real —claves foráneas, índices, `numeric(14,2)`, consultas SQL— con un solo archivo del frontend modificado.

## Desarrollo

```bash
cp .env.example .env    # rellenar con los valores de la consola de Firebase
docker compose up --build       # PostgreSQL en 5433, API en 8081
npm install && npm run dev      # SPA en http://localhost:5173
```

En local la SPA llama a `VITE_API_URL`. En producción esa variable **se deja vacía**: Netlify reenvía `/api/*` a Cloud Run, así que comparten origen, CORS no interviene y la URL del backend no queda incrustada en el paquete del navegador.

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

En local las aplica la API al arrancar (`Database__AutoMigrate=true`). **En producción no**: las aplica el pipeline antes de desplegar la revisión nueva, porque Cloud Run puede levantar varias instancias a la vez y competirían sobre el mismo esquema.

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

El runbook completo está en **`docs/despliegue.md`**. Cada push a `main` despliega solo: las pruebas tienen que pasar, luego se publica la imagen, se aplican las migraciones en Neon y se despliega la revisión.

Reversión: Cloud Run conserva las revisiones anteriores, así que volver atrás es redirigir el tráfico, sin reconstruir nada.

```bash
gcloud run revisions list --service misfinanzas-api --region us-east1
gcloud run services update-traffic misfinanzas-api --region us-east1 --to-revisions=<anterior>=100
```

### Respaldos

`.github/workflows/backup.yml` hace un volcado diario, lo cifra con `age` y lo guarda como artefacto con 90 días de retención. Neon tiene sus propias copias, pero en la capa gratuita la ventana es corta y vive dentro del mismo proveedor; este volcado se restaura en cualquier PostgreSQL.
