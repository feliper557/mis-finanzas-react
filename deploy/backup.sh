#!/usr/bin/env bash
# Volcado diario de la base de MisFinanzas, cifrado y subido fuera del servidor.
#
# Es una copia del backup.sh de Lactumama con la base cambiada. Deliberadamente NO se modifica
# el suyo: es un archivo menos que tocar en la otra aplicacion.
#
# Uso (por cron):
#   15 4 * * * AGE_RECIPIENT=age1... /opt/misfinanzas/backup.sh >> /opt/misfinanzas/backups/backup.log 2>&1
set -euo pipefail

: "${AGE_RECIPIENT:?define AGE_RECIPIENT con la clave publica de age}"

DIR=/opt/misfinanzas/backups
FECHA=$(date +%F)
ARCHIVO="$DIR/misfinanzas-$FECHA.sql.gz.age"
# Nombre del contenedor de PostgreSQL de Lactumama, que es el que aloja tambien esta base.
DB_CONTAINER="${DB_CONTAINER:-lactumama-db-1}"

mkdir -p "$DIR"

# Se lee con el rol misfinanzas, que no tiene acceso a la base de Lactumama.
docker exec -i "$DB_CONTAINER" \
  env PGPASSWORD="${POSTGRES_MISFINANZAS_PASSWORD:?define POSTGRES_MISFINANZAS_PASSWORD}" \
  pg_dump -U misfinanzas -d misfinanzas \
  | gzip \
  | age --recipient "$AGE_RECIPIENT" \
  > "$ARCHIVO"

echo "$(date -Is) volcado $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

rclone copy "$ARCHIVO" backups:misfinanzas/

# Retencion local de 7 dias; la copia remota la gestiona el proveedor.
find "$DIR" -name 'misfinanzas-*.sql.gz.age' -mtime +7 -delete
