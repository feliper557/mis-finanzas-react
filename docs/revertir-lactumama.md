# Revertir los cambios hechos en Lactumama

> **Este documento se ejecuta desde el proyecto de Lactumama, no desde MisFinanzas.**

## Qué pasó

MisFinanzas iba a desplegarse en el mismo VPS y se pidieron cuatro cambios para compartir Caddy y PostgreSQL. **Se hicieron tres** (1, 2 y 4); el 3 quedó pendiente.

Finalmente **MisFinanzas no se despliega en el VPS**: va a Netlify + Neon + Cloud Run. Los motivos fueron el acoplamiento permanente entre las dos aplicaciones, tener que coordinar cada cambio, y que 1 vCPU y 4 GB se quedan justos para dos apps.

Dicho de otro modo: la conclusión que Lactumama ya había documentado —*«coste fijo y predecible frente a una PaaS»*— sigue valiendo **para Lactumama**, porque necesita estar siempre activa. MisFinanzas tolera un arranque en frío de unos segundos, así que para ella sí compensa una plataforma que escala a cero y no cuesta nada.

**Lactumama recupera el servidor entero para ella sola.** Nada de lo que sigue es urgente ni afecta al servicio; es limpieza.

## Lo que hay que deshacer

### El cambio 3 nunca se aplicó

No hay que tocar el `Caddyfile`. Si se llegó a añadir el bloque de `finanzas.{$DOMAIN}`, quitarlo:

```bash
cp /opt/lactumama/Caddyfile /opt/lactumama/Caddyfile.bak
# Borrar el bloque con nano (NO con sed -i: el archivo esta montado suelto)
nano /opt/lactumama/Caddyfile
$compose exec caddy caddy validate --config /etc/caddy/Caddyfile
$compose exec caddy caddy reload   --config /etc/caddy/Caddyfile
```

Tampoco hay que crear el registro DNS de `finanzas.lactumama.online`.

### Deshacer el cambio 2 — rol y base de datos

```bash
cd /opt/lactumama
compose="docker compose --env-file .env --env-file .image-tag -f docker-compose.prod.yml"

$compose exec -T db psql -U lactumama -d postgres -c 'DROP DATABASE IF EXISTS misfinanzas;'
$compose exec -T db psql -U lactumama -d postgres -c 'DROP ROLE IF EXISTS misfinanzas;'
```

> **Importante: NO revertir el `REVOKE CONNECT ON DATABASE lactumama FROM PUBLIC`.** Ese cambio no se hizo por MisFinanzas: cierra un permiso que PostgreSQL concede a todo el mundo por defecto. Dejarlo puesto es más seguro y no afecta al rol `lactumama`, que es el dueño de la base.

### Deshacer los cambios 1 y 4 — redes Docker

Las redes `edge` y `data` ya no tienen a nadie al otro lado. Se pueden dejar sin problema —no consumen nada— o limpiarlas.

Si se limpian, **el orden importa**: primero quitar las entradas del compose, porque están declaradas como `external: true` y un `up -d` fallaría si las redes ya no existen.

```bash
# 1. Editar deploy/docker-compose.prod.yml en el repositorio:
#    - en "db":    quitar  - data
#    - en "caddy": quitar  - edge
#    - abajo:      quitar el bloque "networks:" entero
#
#    OJO: dejar la entrada "- default" en ambos servicios SOLO si se conserva alguna otra
#    red listada. Si "networks:" desaparece por completo de un servicio, Compose vuelve a
#    adjuntar "default" automaticamente, que es el comportamiento original y el correcto.

# 2. Desplegar normalmente (push a main). Al recrearse, los contenedores sueltan las redes.

# 3. Solo entonces, borrarlas:
docker network rm edge data
```

También conviene revertir los párrafos sobre MisFinanzas añadidos a `deploy/README.md`.

## Qué conviene conservar

Dos cosas que salieron de esto y valen por sí mismas:

- **`REVOKE CONNECT ON DATABASE lactumama FROM PUBLIC`**, ya explicado.
- **La advertencia sobre `sed -i` en el `Caddyfile`**: está montado como archivo suelto, y `sed -i` crea un inodo nuevo que el contenedor no vería. Una edición futura parecería aplicarse y no haría nada. Vale la pena que quede documentado.

## Verificación

```bash
curl -sf https://lactumama.online/health && echo " <- OK"
docker ps --format 'table {{.Names}}\t{{.Status}}'
docker network ls | grep -E 'edge|data'   # no debe quedar ninguna
$compose exec db psql -U lactumama -d postgres -c '\l'   # solo lactumama
free -h                                    # el VPS entero vuelve a ser suyo
```
