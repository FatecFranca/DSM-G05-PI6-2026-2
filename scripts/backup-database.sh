#!/usr/bin/env bash
set -euo pipefail

backup_dir="${BACKUP_DIR:-/home/MerlinTroll/backups/estoque-inteligente}"
retention_days="${BACKUP_RETENTION_DAYS:-3}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${backup_dir}/estoque-inteligente-${timestamp}.dump"
temporary="${target}.partial"
listing="${temporary}.list"

if [[ ! "${retention_days}" =~ ^[1-9][0-9]*$ ]]; then
  echo 'BACKUP_RETENTION_DAYS deve ser um inteiro positivo.' >&2
  exit 2
fi

umask 077
install -d -m 0700 "${backup_dir}"
trap 'rm -f "${temporary}" "${listing}"' EXIT
database_name="$(node -e 'const url=new URL(process.env.DATABASE_URL); process.stdout.write(decodeURIComponent(url.pathname.slice(1)))')"
docker exec -e BACKUP_DATABASE="${database_name}" estoque-postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$BACKUP_DATABASE" --format=custom --compress=6' >"${temporary}"
docker exec -i estoque-postgres pg_restore --list <"${temporary}" >"${listing}"
if [[ "$(stat -c %s "${temporary}")" -lt 1048576 ]] \
  || ! grep -q 'TABLE DATA public products' "${listing}" \
  || ! grep -q 'TABLE DATA public dataset_versions' "${listing}"; then
  echo 'Backup inválido: tamanho ou tabelas essenciais não conferem.' >&2
  exit 1
fi
mv "${temporary}" "${target}"
find "${backup_dir}" -maxdepth 1 -type f -name 'estoque-inteligente-*.dump' -mtime "+${retention_days}" -delete
printf 'Backup validado: %s\n' "${target}"
