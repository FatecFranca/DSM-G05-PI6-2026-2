import { buildApp } from './app.js';
import { getConfig } from './config.js';

const config = getConfig();
const app = await buildApp();

const shutdown = async (signal) => {
  app.log.info({ signal }, 'Encerrando API');
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
