# Cambios requeridos en Lactumama para alojar MisFinanzas en el mismo VPS

> **Este documento se ejecuta desde el proyecto de Lactumama, no desde MisFinanzas.**
> Ábrelo dentro de `C:\LactumamaApi` y trabájalo allí.

## 1. Qué se pide y por qué

Una segunda aplicación —**MisFinanzas**— se va a desplegar en el mismo VPS de Hostinger. Migra de Firebase + Netlify a PostgreSQL + este servidor.

Tres recursos del servidor son físicamente únicos y hay que compartirlos:

| Recurso | Por qué se comparte |
|---|---|
| **Puertos 80/443** | Solo un proceso puede escucharlos, y hoy es el contenedor `caddy` de Lactumama. Levantar un segundo Caddy es imposible. |
| **PostgreSQL 17** | Ya está corriendo y sintonizado con `shared_buffers=1GB`. Un segundo contenedor Postgres pediría otros ~1,5 GB de RAM de los 4 GB del VPS, para nada. |
| **RAM y CPU** | KVM 1: 1 vCPU / 4 GB. MisFinanzas añade ~450 MB con topes de cgroup. |

**MisFinanzas aporta sus propios contenedores** (`misfinanzas-api` y `misfinanzas-web`), su propio proyecto compose en `/opt/misfinanzas`, su propio repositorio y su propio CI. De Lactumama solo necesita **entrar por su Caddy** y **una base de datos separada dentro de su Postgres**.

## 2. Garantía de no interrupción

**Requisito absoluto: Lactumama no puede verse afectada en ningún momento.**

Los cuatro cambios están elegidos precisamente porque **ninguno reinicia, recrea ni reconfigura un contenedor**:

| Operación | Por qué no interrumpe |
|---|---|
| `docker network connect` | Adjunta una red a un contenedor **en ejecución**. No lo para. |
| `caddy reload` | Recarga la configuración en caliente. No reinicia el proceso ni corta conexiones en curso. |
| `CREATE ROLE` / `CREATE DATABASE` | Operaciones DDL en caliente. No requieren reiniciar el motor ni cambiar su configuración. |
| Editar `docker-compose.prod.yml` | Editar un archivo no ejecuta nada. El cambio se consolida en el siguiente despliegue normal. |

Se descartó explícitamente el refactor del Caddyfile a `import /etc/caddy/sites/*.caddy` —más limpio a largo plazo— porque exigiría **montar un volumen nuevo y recrear el contenedor `caddy`**, es decir, una caída breve. No compensa.

**Nada de lo que sigue modifica un solo parámetro del motor de PostgreSQL ni de la configuración existente de Caddy. Solo se añade.**

---

## 3. Requisitos previos

Ejecutar **todo** esto antes del primer cambio:

```bash
# 1. Snapshot de Hostinger desde el panel (es la red de seguridad real)

# 2. Respaldo del Caddyfile
cp /opt/lactumama/Caddyfile /opt/lactumama/Caddyfile.bak

# 3. Volcado manual de la base
cd /opt/lactumama && AGE_RECIPIENT=age1... ./backup.sh

# 4. Estado de partida, para poder comparar después
docker ps --format 'table {{.Names}}\t{{.Status}}' | tee /tmp/antes.txt
free -h
curl -sf https://<DOMINIO_LACTUMAMA>/health && echo " <- OK antes de empezar"
```

Definir el atajo de compose que usa el resto del documento:

```bash
cd /opt/lactumama
compose="docker compose --env-file .env --env-file .image-tag -f docker-compose.prod.yml"
```

Confirmar los nombres reales de los contenedores (el proyecto compose se llama `lactumama`, así que deberían ser `lactumama-caddy-1` y `lactumama-db-1`, pero **verifícalo**):

```bash
docker ps --format '{{.Names}}'
```

### Reglas durante toda la intervención

1. **Nunca** ejecutar `down`, `restart`, `stop` ni `up -d` sobre el proyecto `lactumama`.
2. **Nunca** ejecutar `docker system prune` mientras MisFinanzas esté descargando imágenes.
3. Hacer los cambios **de uno en uno**, verificando `/health` entre cada uno.
4. Preferiblemente **fuera del horario de uso**.
5. **Si algo deja de responder: revertir primero, diagnosticar después.**

---

## 4. Los cuatro cambios

### Cambio 1 — Crear y conectar las redes Docker

MisFinanzas y Lactumama son proyectos compose distintos, así que sus contenedores no se ven entre sí. Hacen falta dos redes externas: `edge` (para que Caddy alcance el frontend de MisFinanzas) y `data` (para que la API de MisFinanzas alcance PostgreSQL).

**Verificación previa**

```bash
docker network ls | grep -E 'edge|data'    # no debe existir ninguna
curl -sf https://<DOMINIO_LACTUMAMA>/health
```

**Ejecución**

```bash
docker network create edge
docker network create data

# En caliente: NO para ni recrea los contenedores
docker network connect edge lactumama-caddy-1
docker network connect data lactumama-db-1
```

**Verificación posterior**

```bash
# Los contenedores siguen con el MISMO uptime que antes: no se reiniciaron
docker ps --format 'table {{.Names}}\t{{.Status}}'

# Las redes quedaron adjuntas
docker inspect lactumama-caddy-1 -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
docker inspect lactumama-db-1    -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'

curl -sf https://<DOMINIO_LACTUMAMA>/health && echo " <- OK"
```

**Reversión**

```bash
docker network disconnect edge lactumama-caddy-1
docker network disconnect data lactumama-db-1
docker network rm edge data
```

---

### Cambio 2 — Crear el rol y la base de datos de MisFinanzas

Dentro del PostgreSQL que ya corre. **No se toca ni un parámetro del motor.**

**Verificación previa**

```bash
$compose exec db psql -U lactumama -d postgres -c '\l'   # solo debe estar lactumama
```

**Ejecución**

```bash
# Generar y GUARDAR esta contraseña: hay que entregarla al equipo de MisFinanzas
PG_MISFINANZAS_PASSWORD=$(openssl rand -base64 32)
echo "$PG_MISFINANZAS_PASSWORD"
```

```bash
$compose exec -T db psql -U lactumama -d postgres <<SQL
CREATE ROLE misfinanzas LOGIN PASSWORD '${PG_MISFINANZAS_PASSWORD}';
CREATE DATABASE misfinanzas OWNER misfinanzas;

-- Aislamiento explícito: el rol nuevo no puede ni asomarse a lactumama.
--
-- Ojo con el primer REVOKE: en PostgreSQL el permiso CONNECT lo concede PUBLIC por defecto,
-- asi que revocarlo "FROM misfinanzas" no quita nada (ese rol nunca tuvo una concesion propia
-- que revocar) y la base seguiria accesible. Hay que revocarlo DE PUBLIC.
REVOKE CONNECT ON DATABASE lactumama   FROM PUBLIC;
REVOKE CONNECT ON DATABASE misfinanzas FROM PUBLIC;
GRANT  CONNECT ON DATABASE misfinanzas TO   misfinanzas;
SQL
```

El rol `misfinanzas` **no es superusuario**. No puede leer un solo byte de `lactumama`.

**Verificación posterior — el aislamiento tiene que fallar, y eso es el éxito**

```bash
# Esto DEBE fallar con "permission denied for database lactumama"
$compose exec db env PGPASSWORD="$PG_MISFINANZAS_PASSWORD" \
  psql -U misfinanzas -d lactumama -c 'SELECT 1' \
  && echo "FALLO DE AISLAMIENTO: revertir" || echo "OK: acceso denegado, como debe ser"

# Esto DEBE funcionar
$compose exec db env PGPASSWORD="$PG_MISFINANZAS_PASSWORD" \
  psql -U misfinanzas -d misfinanzas -c 'SELECT current_database()'

# Lactumama intacta
curl -sf https://<DOMINIO_LACTUMAMA>/health && echo " <- OK"
$compose logs --tail 20 db
```

**Reversión**

```bash
$compose exec -T db psql -U lactumama -d postgres -c 'DROP DATABASE IF EXISTS misfinanzas;'
$compose exec -T db psql -U lactumama -d postgres -c 'DROP ROLE IF EXISTS misfinanzas;'
```

> **Nota sobre conexiones:** el motor tiene `max_connections=50`. La API de MisFinanzas fija `Maximum Pool Size=10` en su cadena de conexión precisamente para no poder agotar el cupo de Lactumama. No hay que cambiar `max_connections`.

---

### Cambio 3 — Añadir el sitio de MisFinanzas al Caddyfile

**Este es el único cambio con riesgo real**, porque toca un archivo compartido. Por eso lleva `caddy validate` antes de aplicar.

**Requisito previo:** el registro DNS `A` de `finanzas.<DOMINIO>` ya debe apuntar a la IP del VPS, y los contenedores de MisFinanzas ya deben estar levantados (paso 5 de su lado). Caddy no emitirá el certificado hasta que el DNS resuelva.

```bash
dig +short finanzas.<DOMINIO>          # debe devolver la IP del VPS
docker ps --format '{{.Names}}' | grep misfinanzas-web   # debe existir
```

**Ejecución**

```bash
# El respaldo ya se hizo en los requisitos previos; reconfirmarlo
test -f /opt/lactumama/Caddyfile.bak || cp /opt/lactumama/Caddyfile /opt/lactumama/Caddyfile.bak

# SOLO SE AÑADE AL FINAL. No se modifica ninguna línea existente.
cat >> /opt/lactumama/Caddyfile <<'EOF'

# --- MisFinanzas -----------------------------------------------------------
# Segunda aplicacion en el mismo VPS. Caddy enruta por nombre de host, asi que
# este bloque es independiente del sitio de Lactumama.
finanzas.{$DOMAIN} {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		X-Frame-Options DENY
		-Server
	}

	reverse_proxy misfinanzas-web:80

	log {
		output stdout
		format console
	}
}
EOF
```

`finanzas.{$DOMAIN}` se deja literal: Caddy expande esa variable con el `DOMAIN` que el
contenedor ya recibe por entorno, asi que no hay que sustituir nada.

> **No usar `sed -i` sobre el Caddyfile.** Esta montado como **archivo suelto**
> (`./Caddyfile:/etc/caddy/Caddyfile:ro`) y `sed -i` no edita en el sitio: escribe un temporal
> y lo renombra, creando un **inodo nuevo**. El contenedor seguiria viendo el archivo viejo y
> la recarga no aplicaria nada. Hay que escribir sobre el mismo inodo: `cat >>`, `tee` o `nano`.

**Validar ANTES de aplicar. Este paso no es opcional.**

```bash
$compose exec caddy caddy validate --config /etc/caddy/Caddyfile
```

Si `validate` falla, **no continuar**: restaurar el respaldo y revisar. Un Caddyfile inválido aplicado dejaría a Lactumama sin servicio.

```bash
# Solo si validate pasó: recarga en caliente, sin cortar conexiones
$compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

**Verificación posterior**

```bash
# Caddy NO se reinició: mismo uptime que antes
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep caddy

# LOS DOS sitios responden
curl -sf https://<DOMINIO_LACTUMAMA>/health   && echo " <- Lactumama OK"
curl -sf https://finanzas.<DOMINIO>/health    && echo " <- MisFinanzas OK"

# Certificado emitido para el subdominio nuevo
curl -sI https://finanzas.<DOMINIO> | head -1
$compose logs --tail 40 caddy
```

**Reversión (deja Lactumama exactamente como estaba)**

```bash
cp /opt/lactumama/Caddyfile.bak /opt/lactumama/Caddyfile
$compose exec caddy caddy reload --config /etc/caddy/Caddyfile
curl -sf https://<DOMINIO_LACTUMAMA>/health && echo " <- restaurado"
```

---

### Cambio 4 — Persistir las redes en el compose

El Cambio 1 conectó las redes **en caliente**, lo que no sobrevive a un `docker compose up -d`. Este cambio lo consolida en el archivo, para que el próximo despliegue normal de Lactumama no deje a MisFinanzas sin conexión.

**Editar `deploy/docker-compose.prod.yml` en el repositorio de Lactumama** (y luego el archivo desplegado en `/opt/lactumama/`):

```yaml
services:
  db:
    # ... todo lo existente sin cambios ...
    networks:
      - default
      - data          # <-- añadir: acceso de la API de MisFinanzas

  caddy:
    # ... todo lo existente sin cambios ...
    networks:
      - default
      - edge          # <-- añadir: alcance al frontend de MisFinanzas

# Al final del archivo, junto a "volumes:"
networks:
  default:
  edge:
    external: true
  data:
    external: true
```

> **Importante:** al declarar `networks:` explícitamente en un servicio, Docker Compose **deja de adjuntar la red `default` automáticamente**. Por eso hay que listar `default` de forma expresa en ambos servicios; si se omite, `caddy` perdería el acceso a `web` y `api`, y **Lactumama se caería en el siguiente despliegue**. Es el error más fácil de cometer en todo este documento.

**No ejecutar `up -d` ahora.** El cambio se aplica solo en el siguiente despliegue normal de Lactumama (su próximo push a `main`).

**Verificación — en el siguiente despliegue, no ahora**

```bash
curl -sf https://<DOMINIO_LACTUMAMA>/health && echo " <- Lactumama OK tras el despliegue"
curl -sf https://finanzas.<DOMINIO>/health  && echo " <- MisFinanzas sigue alcanzable"
docker inspect lactumama-caddy-1 -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

**Reversión:** revertir el commit y desplegar de nuevo.

---

## 5. Qué hay que devolver al equipo de MisFinanzas

| Dato | De dónde sale |
|---|---|
| **Contraseña del rol `misfinanzas`** | La generada con `openssl rand -base64 32` en el Cambio 2. Va en `/opt/misfinanzas/.env` con `chmod 600`, nunca en un repositorio. |
| **Nombre del contenedor de PostgreSQL** | `docker ps` (previsiblemente `lactumama-db-1`). Es el `Host=` de la cadena de conexión dentro de la red `data`. |
| **Confirmación de redes** | Que `edge` y `data` existen y están conectadas a `caddy` y `db`. |
| **Dominio elegido** | El subdominio real usado en el Cambio 3. |

Cadena de conexión que usará MisFinanzas (referencia):

```
Host=lactumama-db-1;Port=5432;Database=misfinanzas;Username=misfinanzas;Password=<la generada>;Maximum Pool Size=10
```

---

## 6. Criterio de aceptación

La intervención es correcta **solo si se cumple todo** esto:

- [ ] `docker ps` muestra los contenedores de Lactumama con **uptime continuo**: ni un solo reinicio durante toda la intervención. Comparar contra `/tmp/antes.txt`.
- [ ] `curl -sf https://<DOMINIO_LACTUMAMA>/health` devuelve `Healthy` con certificado válido, comprobado **después de cada cambio**.
- [ ] Una reserva completa de prueba en Lactumama sigue funcionando de extremo a extremo.
- [ ] El rol `misfinanzas` **no puede** conectarse a la base `lactumama`.
- [ ] No se modificó ningún parámetro del motor de PostgreSQL (`shared_buffers`, `max_connections`… intactos).
- [ ] No se modificó ninguna línea preexistente del `Caddyfile`; solo se añadió un bloque al final.
- [ ] `docker stats --no-stream` muestra el consumo total holgadamente por debajo de 4 GB.
- [ ] `free -h` no muestra crecimiento sostenido del swap.
- [ ] Desde fuera solo responden los puertos **22, 80 y 443**. El **5432 sigue cerrado**.
- [ ] En `lactumama`, `SELECT count(*) FROM pg_stat_activity;` sigue muy por debajo de 50.

---

## 7. Consecuencia permanente que conviene aceptar conscientemente

Después de esto, las dos aplicaciones **comparten `caddy` y `db` de forma permanente**. La instalación no las interrumpe, pero a partir de ahora:

- Reiniciar `caddy` o `db` afecta a ambas.
- Un fallo del contenedor `db` tumba las dos.
- El `Caddyfile` es un archivo compartido: **toda edición futura debe pasar por `caddy validate` antes de `caddy reload`**.
- El respaldo de MisFinanzas es independiente (`/opt/misfinanzas/backup.sh`, con su propio cron). **No hace falta tocar `/opt/lactumama/backup.sh`.**

Si algún día ese acoplamiento pesa más que el ahorro de ~450 MB de RAM, darle a MisFinanzas su propio contenedor PostgreSQL es un cambio contenido: una entrada en su compose y una cadena de conexión distinta, sin tocar Lactumama.
