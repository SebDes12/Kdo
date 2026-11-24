#!/usr/bin/env bash
# Teste le schéma et les règles RLS sur un Postgres local jetable (15+).
# Usage : PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=kdo_test_$$
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
run() { psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null; }
for f in db/migrations/*.sql; do run "$f"; done
run db/tests/rls_test.sql
echo "Tous les tests SQL sont passés."
