# Despliegue: Netlify + Neon + Cloud Run

Runbook de la primera puesta en marcha. Después, cada push a `main` despliega solo.

```
Navegador
   │
   ├── https://<tu-sitio>.netlify.app        -> Netlify (SPA estática, gratis)
   │        └── /api/*  (reenvío, mismo origen, sin CORS)
   │                └── https://misfinanzas-api-....run.app   -> Cloud Run (API .NET)
   │                            └── Neon (PostgreSQL gestionado, gratis)
   └── Firebase Authentication (solo el inicio de sesión)
```

**Coste esperado: cero.** Netlify gratis, Neon gratis, y Cloud Run con escalado a cero cabe de sobra en su capa gratuita para un uso personal. A cambio, el primer acceso del día tarda unos 3–5 segundos mientras despiertan el contenedor y la base.

---

## Paso 1 — Neon

1. Crear cuenta en [neon.tech] y un proyecto **PostgreSQL 17**, región **AWS us-east-1** (la más cercana a Colombia de las gratuitas).
2. Base de datos: `misfinanzas`.
3. Copiar las **dos** formas de la cadena de conexión que da el panel:

Neon la entrega en formato URL, así:

```
postgresql://<usuario>:<clave>@ep-xxxx-pooler.us-east-1.aws.neon.tech/misfinanzas?sslmode=require&channel_binding=require
```

Hay que guardarla en **dos formas**, porque .NET y `pg_dump` hablan distinto:

| Secreto | Forma | Extremo |
|---|---|---|
| `NEON_CONNECTION_STRING` | `Host=ep-xxxx-pooler.us-east-1.aws.neon.tech;Database=misfinanzas;Username=<usuario>;Password=<clave>;SSL Mode=VerifyFull;Maximum Pool Size=5` | **con** `-pooler` |
| `NEON_CONNECTION_STRING_PSQL` | La URL de Neon quitando `-pooler` del host y con `?sslmode=verify-full&sslrootcert=system` | **sin** `-pooler` |

Tres detalles que ahorran un rato de depuración:

- **La API usa el extremo con `-pooler`.** Cloud Run puede abrir varias instancias y el agrupador de Neon evita agotar conexiones.
- **`pg_dump` usa el extremo SIN `-pooler`**: el agrupador no admite algunas operaciones del volcado.
- **`sslrootcert=system` es obligatorio en la URL de `pg_dump`.** Es una peculiaridad de `libpq`:
  con `sslmode=verify-full` busca el certificado raíz en `~/.postgresql/root.crt` y falla si no
  está, en vez de usar el almacén del sistema. Npgsql no tiene ese problema, por eso la cadena
  de .NET no lo necesita. (Comprobado contra la base real.)
- **`SSL Mode=VerifyFull`, no `Trust Server Certificate=true`.** El certificado de Neon está firmado por una autoridad pública y la imagen de la API lleva el almacén de certificados raíz, así que se puede validar de verdad en lugar de aceptar cualquier certificado. Si alguna vez fallara, el problema estaría en el almacén de certificados, no en la validación: no la desactives para salir del paso.

Neon suspende la base cuando no se usa. No hay que hacer nada: la API ya lleva `EnableRetryOnFailure(5)` y absorbe el despertar sin mostrar error.

## Paso 2 — Google Cloud

```bash
gcloud auth login
gcloud projects create misfinanzas-app --name="Mis Finanzas"   # o usa uno existente
gcloud config set project misfinanzas-app
# Asociar una cuenta de facturación desde la consola: Cloud Run la exige aunque no se cobre.

gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

gcloud artifacts repositories create misfinanzas \
  --repository-format=docker --location=us-east1 \
  --description="Imagenes de MisFinanzas"
```

**La cadena de conexión va en Secret Manager**, no en una variable de entorno del servicio: así no queda a la vista de cualquiera que pueda describir el servicio.

```bash
printf '%s' 'Host=ep-xxx-pooler...;Maximum Pool Size=5' \
  | gcloud secrets create neon-connection-string --data-file=-
```

Dos cuentas de servicio con papeles distintos: una **despliega** desde GitHub y otra es la
identidad con la que **corre** el servicio. Separarlas evita que la credencial guardada en un
secreto de GitHub sea también la que puede leer la base de datos.

```bash
PROJECT=<tu-id-de-proyecto>
DEPLOY=despliegue-github@$PROJECT.iam.gserviceaccount.com
RUNTIME=misfinanzas-api@$PROJECT.iam.gserviceaccount.com

gcloud iam service-accounts create despliegue-github --display-name="Despliegue desde GitHub"
gcloud iam service-accounts create misfinanzas-api   --display-name="Identidad de la API"

# Quien despliega: publicar imagenes y administrar Cloud Run. Nada mas.
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$DEPLOY" --role=roles/run.admin
gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:$DEPLOY" --role=roles/artifactregistry.writer

# Permiso para desplegar "en nombre de" la identidad de ejecucion, acotado a esa cuenta
# concreta en lugar de a todo el proyecto.
gcloud iam service-accounts add-iam-policy-binding $RUNTIME \
  --member="serviceAccount:$DEPLOY" --role=roles/iam.serviceAccountUser

# La identidad de ejecucion solo puede leer ESE secreto. Ningun otro permiso.
gcloud secrets add-iam-policy-binding neon-connection-string \
  --member="serviceAccount:$RUNTIME" --role=roles/secretmanager.secretAccessor

gcloud iam service-accounts keys create clave.json --iam-account=$DEPLOY
```

> La clave descargada es una credencial de larga duración: pégala en GitHub y **borra `clave.json` del disco**. Cuando tengas el despliegue funcionando, merece la pena cambiarla por *Workload Identity Federation*, que no deja ninguna clave que se pueda filtrar.

## Paso 3 — Secretos en GitHub

*Settings → Secrets and variables → Actions*:

| Secreto | Valor |
|---|---|
| `GCP_SA_KEY` | Contenido completo de `clave.json` |
| `GCP_PROJECT_ID` | `misfinanzas-app` |
| `FIREBASE_PROJECT_ID` | `mis-finanzas-364c8` |
| `NEON_CONNECTION_STRING` | La forma .NET, para aplicar migraciones desde el CI |
| `NEON_CONNECTION_STRING_PSQL` | La forma URL **sin** `-pooler`, para `pg_dump` |
| `AGE_RECIPIENT` | Clave **pública** de age (`age-keygen -o clave-privada.key`) |

La clave **privada** de age se guarda fuera de GitHub, en tu gestor de contraseñas. Sin ella los respaldos no se pueden descifrar.

## Paso 4 — Primer despliegue

```bash
git checkout main
git merge migracion-postgres-vps
git push origin main
```

El pipeline compila, pasa las nueve pruebas de integración, publica la imagen, **aplica las migraciones en Neon** y despliega la revisión. Al final imprime la URL del servicio y comprueba `/health`.

Guarda esa URL: hace falta en el paso siguiente.

> Las migraciones se aplican desde el CI y no al arrancar la API, porque Cloud Run puede levantar varias instancias a la vez y competirían sobre el mismo esquema.

## Paso 5 — Netlify

1. En `netlify.toml`, sustituir el marcador por la URL real de Cloud Run:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://misfinanzas-api-XXXXXXXX-ue.a.run.app/api/:splat"
```

2. En *Site settings → Environment variables*, añadir las cinco `VITE_FIREBASE_*`. **`VITE_API_URL` se deja sin definir**: la SPA llama a su propio origen y Netlify reenvía.

3. Hacer commit del `netlify.toml` y empujar. Netlify reconstruye solo.

## Paso 6 — Firebase

En *Authentication → Settings → Authorized domains*, añadir el dominio de Netlify.

Sin esto el inicio de sesión falla con `auth/unauthorized-domain`.

## Paso 7 — Importar los datos

Hace falta un volcado **fresco** de Firestore: el del 29-09-2026 sirvió para desarrollar, pero has seguido usando la app.

```bash
cd /ruta/a/bk
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/serviceAccount.json node dump.js
```

Ensayar primero, sin confirmar nada. Neon es accesible por internet, así que no hace falta túnel:

```bash
cd server
dotnet run --project tools/MisFinanzas.Importer -- \
  --file /ruta/a/firestore-backup.json \
  --connection "Host=ep-xxxx-pooler...;Database=misfinanzas;Username=...;Password=...;SSL Mode=VerifyFull;Maximum Pool Size=5" \
  --truncate --dry-run
```

Si los tres usuarios terminan en «verificacion: OK», repetir **sin** `--dry-run`.

El importador reconstruye el documento desde PostgreSQL, lo compara campo a campo con el de origen y deshace la transacción ante cualquier diferencia de importe, conteo o referencia.

## Paso 8 — Comprobar el respaldo

Lanzar el flujo de respaldo a mano desde *Actions → Respaldo de la base → Run workflow*, descargar el artefacto y probar que se descifra y restaura en una base desechable. **Antes de necesitarlo.**

## Paso 9 — Apagar Netlify… no. Apagar Firestore

Netlify se queda: sigue sirviendo la SPA y no cuesta nada.

Lo que se retira, tras varios días con todo cuadrado, son las **reglas y datos de Firestore**. La autenticación de Firebase se conserva. El export nativo del respaldo es la vía de retorno mientras tanto.

---

## Verificación final

- [ ] La SPA carga en el dominio de Netlify
- [ ] El inicio de sesión con Google funciona
- [ ] Los totales coinciden al peso con la app anterior (Resumen, Tendencias anual, Inversiones)
- [ ] Los 3 retiros (apuntes negativos) y los 33 gastos sin fecha aparecen bien
- [ ] El orden de Inversiones es el de siempre
- [ ] CRUD completo en cada pestaña, recargando para confirmar que persiste
- [ ] Dos navegadores a la vez: el segundo avisa «Actualizado desde otro dispositivo» y no se pierde nada
- [ ] Una petición sin token devuelve 401
- [ ] El primer acceso tras unas horas tarda unos segundos pero **no falla**
- [ ] El respaldo corrió y se restaura

## Costes y vigilancia

| Servicio | Plan | Qué vigilar |
|---|---|---|
| Netlify | Gratis | 100 GB/mes de transferencia; no te vas a acercar |
| Neon | Gratis | 0,5 GB. Tus datos ocupan ~60 KB |
| Cloud Run | Gratis con escalado a cero | **Poner un presupuesto con alerta en 1 USD.** Es la única pieza que podría cobrar si algo se descontrola |
| Artifact Registry | ~0 | 0,5 GB gratis; conviene borrar imágenes viejas de vez en cuando |

```bash
# Alerta de presupuesto: barata de poner y evita sorpresas
gcloud billing budgets create --billing-account=<ID> \
  --display-name="MisFinanzas" --budget-amount=1USD \
  --threshold-rule=percent=100
```

## Reversión

| Qué | Cómo |
|---|---|
| Un despliegue malo | `gcloud run services update-traffic misfinanzas-api --region us-east1 --to-revisions=<revision-anterior>=100` |
| Ver las revisiones | `gcloud run revisions list --service misfinanzas-api --region us-east1` |
| Parar todo el gasto | `gcloud run services delete misfinanzas-api --region us-east1` |

Cloud Run conserva las revisiones anteriores, así que volver atrás es redirigir el tráfico: no hay que reconstruir ni volver a desplegar.
