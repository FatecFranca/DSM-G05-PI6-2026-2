#!/usr/bin/env bash
set -euo pipefail

backup_dir="${BACKUP_DIR:-/home/MerlinTroll/backups/estoque-inteligente}"
retention_days="${BACKUP_RETENTION_DAYS:-3}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_dir}/estoque-inteligente-${timestamp}.dump"
temporary="${target}.partial"

if [[ ! "${retention_days}" =~ ^[1-9][0-9]*$ ]]; then
  echo 'BACKUP_RETENTION_DAYS deve ser um inteiro positivo.' >&2
  exit 2
fi

umask 077
install -d -m 0700 "${backup_dir}"
trap 'rm -f "${temporary}"' EXIT
docker exec estoque-postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6' >"${temporary}"
docker exec -i estoque-postgres pg_restore --list <"${temporary}" >/dev/null
mv "${temporary}" "${target}"
find "${backup_dir}" -maxdepth 1 -type f -name 'estoque-inteligente-*.dump' -mtime "+${retention_days}" -delete
printf 'Backup validado: %s\n' "${target}"
