import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3333),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  corsOrigins: string[];
  databaseUrl: string;
  databasePoolMax: number;
};

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(env);

  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    corsOrigins: parsed.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    databaseUrl: parsed.DATABASE_URL,
    databasePoolMax: parsed.DB_POOL_MAX,
  };
}
