# Puesta en marcha en el VPS

Runbook de la **primera** instalación de MisFinanzas en el VPS de Hostinger que ya hospeda Lactumama. Los despliegues posteriores son automáticos: cada push a `main` que pase las pruebas.

## Datos confirmados

| Dato | Valor |
|---|---|
| Dominio | `finanzas.lactumama.online` |
| IP del VPS | `2.25.114.214` (verificado: es a donde resuelve `lactumama.online`) |
| Usuario SSH | `deploy` |
| Directorio | `/opt/misfinanzas` |
| Imágenes | `ghcr.io/feliper557/mis-finanzas-react/{api,web}` |
| Contenedor de PostgreSQL | `lactumama-db-1` |
| Base / rol | `misfinanzas` / `misfinanzas` |
| Proyecto de Firebase | `mis-finanzas-364c8` |

Lo que ya hizo el equipo de Lactumama: redes `edge` y `data` creadas y conectadas, rol y base `misfinanzas` creados y probados, y su `docker-compose.prod.yml` actualizado. **Falta su cambio 3 (Caddy), que depende de nosotros.**

## Lo que hay que tener a mano

1. La **contraseña del rol `misfinanzas`**, que llega por canal privado. Es hexadecimal, no hay que escaparla.
2. Un **PAT de GitHub** con permiso `read:packages`, para que el VPS descargue las imágenes.
3. Acceso SSH como `deploy`.

---

## Paso A — Configurar GitHub

En *Settings → Secrets and variables → Actions*:

**Secrets**

| Nombre | Valor |
|---|---|
| `VPS_HOST` | `2.25.114.214` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | La clave **privada** SSH cuya pública está en el VPS |

**Variables** (no son secretas: Firebase las incrusta en el paquete del navegador por diseño)

| Nombre | Valor |
|---|---|
| `VITE_FIREBASE_API_KEY` | de la consola de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | `mis-finanzas-364c8.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `mis-finanzas-364c8` |
| `VITE_FIREBASE_SENDER_ID` | de la consola de Firebase |
| `VITE_FIREBASE_APP_ID` | de la consola de Firebase |

Los valores salen de tu `.env` local, que ya los tiene.

---

## Paso B — Preparar `/opt/misfinanzas` en el VPS

**Antes de publicar nada.** El trabajo de despliegue del CI hace `cd /opt/misfinanzas`; si el directorio no existe, falla.

```bash
ssh deploy@2.25.114.214

sudo mkdir -p /opt/misfinanzas
sudo chown deploy:deploy /opt/misfinanzas
cd /opt/misfinanzas
```

Desde tu máquina, copia los tres archivos:

```bash
cd C:/Proyectos/MisFinanzas
scp deploy/docker-compose.prod.yml deploy/backup.sh deploy@2.25.114.214:/opt/misfinanzas/
scp deploy/.env.prod.example        deploy@2.25.114.214:/opt/misfinanzas/.env
```

De vuelta en el VPS, rellena el entorno y autentícate en el registro:

```bash
cd /opt/misfinanzas
chmod 600 .env && chmod +x backup.sh
nano .env          # poner la contraseña real en ConnectionStrings__Default
echo "IMAGE_TAG=latest" > .image-tag

docker login ghcr.io -u feliper557     # pegar el PAT con read:packages
```

El `.env` debe quedar así (la contraseña, sin comillas):

```
IMAGE_REPO=ghcr.io/feliper557/mis-finanzas-react
IMAGE_TAG=latest
ConnectionStrings__Default=Host=lactumama-db-1;Port=5432;Database=misfinanzas;Username=misfinanzas;Password=<la que te pasaron>;Maximum Pool Size=10
ASPNETCORE_ENVIRONMENT=Production
Database__AutoMigrate=true
Firebase__ProjectId=mis-finanzas-364c8
```

**Comprobación rápida de que la base responde** antes de desplegar nada:

```bash
docker run --rm --network data -e PGPASSWORD='<la contraseña>' postgres:17-alpine \
  psql -h lactumama-db-1 -U misfinanzas -d misfinanzas -c 'SELECT current_database(), current_user;'
```

---

## Paso C — Publicar

Con el Paso B hecho, fusionar la rama a `main` y empujar. Eso dispara el CI, que compila, publica las dos imágenes en GHCR y despliega por SSH.

```bash
cd C:/Proyectos/MisFinanzas
git checkout main
git merge migracion-postgres-vps
git push origin main
```

> **Las imágenes se construyen en GitHub Actions, nunca en el servidor.** El VPS tiene 1 vCPU compartido: un `docker build` de .NET o Vite ahí dejaría sin responder también a Lactumama.

Seguir el progreso en la pestaña *Actions*. Al terminar:

```bash
ssh deploy@2.25.114.214
cd /opt/misfinanzas
compose="docker compose --env-file .env --env-file .image-tag -f docker-compose.prod.yml"
$compose ps
$compose logs -f misfinanzas-api    # deben verse las migraciones aplicadas al arrancar
```

---

## Paso D — Verificar por dentro

El stack **no publica ningún puerto**, así que todavía no es accesible desde fuera. Se comprueba desde dentro de la red de Docker:

```bash
# La API responde y llega a PostgreSQL
docker exec misfinanzas-web wget -qO- http://misfinanzas-api:8080/health

# nginx sirve la SPA y hace de proxy
docker exec misfinanzas-web wget -qO- http://localhost/health
docker exec misfinanzas-web wget -qO- http://localhost/ | head -c 120

# Las tablas se crearon
docker exec lactumama-db-1 psql -U misfinanzas -d misfinanzas -c '\dt'
```

**Y lo más importante: Lactumama intacta.**

```bash
curl -sf https://lactumama.online/health && echo " <- Lactumama OK"
docker ps --format 'table {{.Names}}\t{{.Status}}'   # su uptime debe seguir corrido
docker stats --no-stream                              # total holgadamente por debajo de 4 GB
free -h
```

---

## Paso E — Avisar a Lactumama

Solo cuando el Paso D esté limpio. Ellos entonces:

1. Crean el registro DNS `A` de `finanzas.lactumama.online` → `2.25.114.214`.
2. Aplican su **cambio 3**: añaden el bloque de `deploy/misfinanzas.caddy` al final de `/opt/lactumama/Caddyfile` (con `cat >>` o `nano`, **nunca `sed -i`**), validan con `caddy validate` y recargan con `caddy reload`.

El orden importa: si Caddy intenta emitir el certificado sin nada detrás, gasta intentos del límite de Let's Encrypt.

Después:

```bash
curl -sf https://finanzas.lactumama.online/health && echo " <- MisFinanzas OK"
curl -sf https://lactumama.online/health          && echo " <- Lactumama sigue OK"
```

---

## Paso F — Firebase

En *Authentication → Settings → Authorized domains*, añadir **`finanzas.lactumama.online`**.

Sin esto el login falla con `auth/unauthorized-domain`: Firebase no admite dominios no autorizados y `signInWithPopup` exige HTTPS.

---

## Paso G — Importar los datos

El respaldo del 29-09-2026 sirvió para desarrollar y ensayar, pero has seguido usando la app. En el momento del corte hay que sacar un volcado **fresco**:

```bash
# Con el script del respaldo (bk/dump.js), apuntando a la cuenta de servicio
cd /ruta/a/bk
GOOGLE_APPLICATION_CREDENTIALS=/ruta/a/serviceAccount.json node dump.js
```

Ensayar primero sin confirmar nada:

```bash
cd C:/Proyectos/MisFinanzas/server
dotnet run --project tools/MisFinanzas.Importer -- \
  --file /ruta/a/firestore-backup.json \
  --connection "Host=<ip-o-tunel>;Port=5432;Database=misfinanzas;Username=misfinanzas;Password=<...>;Maximum Pool Size=10" \
  --truncate --dry-run
```

El puerto 5432 **no está abierto al exterior** (y debe seguir así), así que para llegar a la base desde tu máquina hay que hacer un túnel SSH:

```bash
ssh -L 15432:lactumama-db-1:5432 deploy@2.25.114.214
# y usar Host=localhost;Port=15432 en la cadena de conexión
```

Si el ensayo termina con «verificacion: OK» en los tres usuarios, repetir **sin** `--dry-run`.

El importador compara campo a campo el documento reconstruido contra el de origen y deshace la transacción ante cualquier diferencia de importe, conteo o referencia.

---

## Paso H — Respaldo

```bash
ssh deploy@2.25.114.214
age-keygen -o ~/.config/misfinanzas-backup.key   # guardar la clave PRIVADA fuera del servidor
crontab -e
```

```cron
# A las 4:15, una hora después del de Lactumama, para no solapar la carga en 1 vCPU.
15 4 * * * AGE_RECIPIENT=age1... POSTGRES_MISFINANZAS_PASSWORD='<...>' /opt/misfinanzas/backup.sh >> /opt/misfinanzas/backups/backup.log 2>&1
```

Probar la restauración sobre una base desechable antes de necesitarla. **Esto es dinero: no es opcional.**

---

## Paso I — Apagar Netlify

Solo después de varios días con la app nueva funcionando y los totales cuadrados. **No borrar nada de Firebase** hasta entonces; el export nativo del respaldo es la vía de retorno.

---

## Reversión

| Qué | Cómo |
|---|---|
| Un despliegue malo | `cd /opt/misfinanzas && echo "IMAGE_TAG=<sha-anterior>" > .image-tag && docker compose --env-file .env --env-file .image-tag -f docker-compose.prod.yml up -d` |
| MisFinanzas entera | `docker compose -p misfinanzas down` — Lactumama no se entera |
| El sitio en Caddy | Lo revierte Lactumama: `cp Caddyfile.bak Caddyfile && caddy reload` |
| La base | `DROP DATABASE misfinanzas; DROP ROLE misfinanzas;` |

**Nunca** `down`, `restart`, `stop` ni `up -d` sobre el proyecto `lactumama`. **Nunca** `docker system prune`: borraría las redes `edge` y `data` compartidas.

---

## Lista de verificación final

- [ ] `https://finanzas.lactumama.online` carga la SPA con certificado válido
- [ ] Login con Google funciona
- [ ] Los datos coinciden al peso con la app en Netlify (comparar Resumen, Tendencias anual e Inversiones)
- [ ] Los 3 retiros (apuntes negativos) y los 33 gastos sin fecha aparecen bien
- [ ] El orden de Inversiones es el de siempre
- [ ] CRUD completo en cada pestaña, recargando para confirmar que persiste
- [ ] Dos navegadores a la vez: el segundo avisa «Actualizado desde otro dispositivo» y **no se pierde nada**
- [ ] `https://lactumama.online` sigue OK y sus contenedores sin un solo reinicio
- [ ] Desde fuera solo responden 22, 80 y 443; el 5432 cerrado
- [ ] El cron de respaldo corrió al menos una vez y el volcado se restaura
