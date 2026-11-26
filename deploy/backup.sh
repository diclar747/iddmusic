#!/bin/sh
# Copia de seguridad diaria de la base y de los archivos subidos. Ejemplo de cron (3:00 AM):
#   0 3 * * * cd /opt/iddmusic && sh deploy/backup.sh >> backups/backup.log 2>&1
set -e
cd "$(dirname "$0")/.."
. ./.env
DIR=backups; mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M)
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-idd_user}" -Fc "${POSTGRES_DB:-idd_music}" > "$DIR/db-$STAMP.dump"
docker compose run --rm --no-deps -v "$PWD/$DIR:/out" --entrypoint sh api -c "tar czf /out/uploads-$STAMP.tgz -C /srv/backend/storage uploads"
find "$DIR" -name 'db-*.dump' -mtime +30 -delete
find "$DIR" -name 'uploads-*.tgz' -mtime +30 -delete
echo "$(date) backup OK: $DIR/db-$STAMP.dump"
