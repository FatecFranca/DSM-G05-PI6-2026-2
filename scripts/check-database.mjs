import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../apps/api/.env', import.meta.url)), quiet: true });
if (process.argv.includes('--stop')) {
  console.error('O PostgreSQL instalado é compartilhado com outros bancos. Não será parado automaticamente. Use Serviços do Windows somente quando for seguro.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Configure DATABASE_URL em apps/api/.env. Não compartilhe a senha.');
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const result = await client.query('SELECT current_database() AS database, current_user AS username, inet_server_port() AS port');
  console.info('PostgreSQL conectado:', result.rows[0]);
} catch (error) {
  console.error(`Conexão indisponível (${error.code ?? 'erro'}). Confira o serviço PostgreSQL do Windows e a configuração local. Nenhuma senha foi exibida.`);
  process.exitCode = 1;
} finally {
  await client.end();
}
