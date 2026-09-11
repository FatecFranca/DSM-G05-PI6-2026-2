import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'test/auth.integration.test.ts'], {
  stdio: 'inherit', env: { ...process.env, AUTH_INTEGRATION: '1' },
});
process.exit(result.status ?? 1);
