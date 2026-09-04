const parsePort = (value) => {
  const port = Number(value ?? 3333);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  return port;
};

export function getConfig(env = process.env) {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: parsePort(env.PORT),
    logLevel: env.LOG_LEVEL ?? 'info',
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:3000',
    isProduction: env.NODE_ENV === 'production',
  };
}
