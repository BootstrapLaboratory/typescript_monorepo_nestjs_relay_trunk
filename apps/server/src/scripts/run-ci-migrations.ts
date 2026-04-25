import { spawnSync } from 'node:child_process';
import { buildCiDatabaseUrl } from './ci-env';

function runMigrations(): void {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['run', 'migration:run'], {
    env: {
      ...process.env,
      DATABASE_URL: buildCiDatabaseUrl(),
    },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
}

try {
  runMigrations();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
