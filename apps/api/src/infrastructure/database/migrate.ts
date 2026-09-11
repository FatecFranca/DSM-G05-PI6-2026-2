import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getConfig } from '../../config.js';
import { PostgresDatabase } from './postgres-database.js';

const migrations = [
  ['001_initial_schema', 'schema.sql'],
  ['002_authentication', 'migrations/002_authentication.sql'],
] as const;

const config = getConfig();
const database = new PostgresDatabase(config.databaseUrl, 1);

try {
  for (const [migrationName, filename] of migrations) {
  const schemaPath = fileURLToPath(new URL(`../../../../../infra/database/${filename}`, import.meta.url));
  const sql = await readFile(schemaPath, 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');

  const applied = await database.transaction(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    await client.query("SELECT pg_advisory_xact_lock(hashtext('estoque_inteligente_migrations'))");
    const existing = await client.query<{ checksum: string }>(
      'SELECT checksum FROM schema_migrations WHERE name = $1',
      [migrationName],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`A migração ${migrationName} foi alterada depois de aplicada.`);
      }
      return false;
    }
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
      [migrationName, checksum],
    );
    return true;
  });

  console.info(applied ? `Migração aplicada: ${migrationName}` : `Migração já aplicada: ${migrationName}`);
  }
} finally {
  await database.close();
}
