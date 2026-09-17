import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const candidates = process.platform === 'win32'
  ? ['.venv/Scripts/python.exe', 'py', 'python']
  : ['.venv/bin/python', 'python3', 'python'];
const executable = candidates.find((candidate) => candidate.includes('/') ? existsSync(candidate) : true);
const result = spawnSync(executable, process.argv.slice(2), { stdio: 'inherit', shell: false });
if (result.error) {
  console.error(`Não foi possível executar Python: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
