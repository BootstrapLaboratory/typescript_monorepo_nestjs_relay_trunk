import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { getEnvFilePaths } from './env-paths';

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');
  if (separatorIndex < 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  if (!key) {
    return null;
  }

  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  return [key, stripWrappingQuotes(rawValue)];
}

export function loadEnvironmentFiles(): void {
  const originalKeys = new Set(Object.keys(process.env));
  const loadOrder = [...getEnvFilePaths()].reverse();

  for (const relativePath of loadOrder) {
    const absolutePath = resolve(process.cwd(), relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    const fileContents = readFileSync(absolutePath, 'utf8');
    for (const line of fileContents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;
      if (originalKeys.has(key)) {
        continue;
      }

      process.env[key] = value;
    }
  }
}
