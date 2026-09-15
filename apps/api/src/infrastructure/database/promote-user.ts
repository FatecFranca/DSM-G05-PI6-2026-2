import { z } from 'zod';
import { getConfig } from '../../config.js';
import { PostgresDatabase } from './postgres-database.js';

const position = process.argv.indexOf('--email');
const email = z.string().trim().toLowerCase().email().max(254).parse(process.argv[position + 1]);
const database = new PostgresDatabase(getConfig().databaseUrl, 1);
try {
  const result = await database.query<{ email: string }>(
    "UPDATE users SET role='admin' WHERE email=$1 AND active=true RETURNING email",
    [email],
  );
  if (!result.rows[0]) throw new Error('Usuário ativo não encontrado. Cadastre a conta antes de promovê-la.');
  console.info(`Usuário promovido a administrador: ${result.rows[0].email}`);
} finally {
  await database.close();
}
