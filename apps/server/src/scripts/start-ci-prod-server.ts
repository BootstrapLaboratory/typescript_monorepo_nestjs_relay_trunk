import { spawn } from 'node:child_process';
import { closeSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { buildCiDatabaseUrl } from './ci-env';

const DEFAULT_SERVER_SMOKE_LOG = '/tmp/server-smoke.log';
const DEFAULT_SERVER_PID_FILE = '/tmp/server-smoke.pid';

function startServer(): void {
  const serverSmokeLog =
    process.env.SERVER_SMOKE_LOG || DEFAULT_SERVER_SMOKE_LOG;
  const serverPidFile = process.env.SERVER_PID_FILE || DEFAULT_SERVER_PID_FILE;
  const logFd = openSync(serverSmokeLog, 'w');

  rmSync(serverPidFile, { force: true });

  const child = spawn(process.execPath, ['dist/main.js'], {
    detached: true,
    env: {
      ...process.env,
      DATABASE_URL: buildCiDatabaseUrl(),
    },
    stdio: ['ignore', logFd, logFd],
  });

  closeSync(logFd);
  child.unref();

  writeFileSync(serverPidFile, `${child.pid}\n`, 'utf8');

  if (process.env.GITHUB_ENV) {
    writeFileSync(process.env.GITHUB_ENV, `SERVER_PID=${child.pid}\n`, {
      encoding: 'utf8',
      flag: 'a',
    });
  }
}

try {
  startServer();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
