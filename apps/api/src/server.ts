import { buildApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const app = await buildApp();

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) { return; }
  shuttingDown = true;
  app.log.info({ signal }, 'Encerrando API');
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, 'Falha ao encerrar a API');
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
