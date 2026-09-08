import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { getConfig } from '../../config.js';
import { PostgresDatabase } from './postgres-database.js';

const seedPath = fileURLToPath(
  new URL('../../../../../infra/database/seed.sql', import.meta.url),
);
const config = getConfig();
const database = new PostgresDatabase(config.databaseUrl, 1);

try {
  const sql = await readFile(seedPath, 'utf8');
  await database.transaction((client) => client.query(sql));
  console.info('Dados iniciais inseridos/atualizados.');
} finally {
  await database.close();
}
