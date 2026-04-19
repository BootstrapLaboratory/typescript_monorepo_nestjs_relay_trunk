import { Logger } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { CreateMessageTable20260415190000 } from '../database/migrations/20260415190000-CreateMessageTable';
import { MessageEntity } from '../modules/chat/entities/message.entity';
import { parseBoolean, parseNumber } from './env.utils';
import { logStructuredEvent } from '../logging/structured-log';

const DEFAULT_DATABASE_PORT = 5432;
const databaseLogger = new Logger('Database');

function buildSslConfig() {
  const sslEnabled = parseBoolean(
    process.env.DATABASE_SSL,
    process.env.NODE_ENV === 'production',
  );

  if (!sslEnabled) {
    return false;
  }

  return {
    rejectUnauthorized: parseBoolean(
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
      false,
    ),
  };
}

function normalizeDatabaseUrl(databaseUrl: string): string {
  try {
    const parsedUrl = new URL(databaseUrl);

    // `pg-connection-string` warns that `sslmode=require` will change
    // semantics in the next major release. Pinning to `verify-full` keeps the
    // current behavior explicit without requiring secret rotation.
    if (
      parsedUrl.searchParams.get('sslmode') === 'require' &&
      !parsedUrl.searchParams.has('uselibpqcompat')
    ) {
      parsedUrl.searchParams.set('sslmode', 'verify-full');
      return parsedUrl.toString();
    }
  } catch {
    return databaseUrl;
  }

  return databaseUrl;
}

function getDatabaseUrl(preferDirectUrl = false): string | undefined {
  if (preferDirectUrl && process.env.DATABASE_URL_DIRECT) {
    return normalizeDatabaseUrl(process.env.DATABASE_URL_DIRECT);
  }

  return process.env.DATABASE_URL
    ? normalizeDatabaseUrl(process.env.DATABASE_URL)
    : undefined;
}

function getDatabaseConnectionSummary(
  options: DataSourceOptions,
): Record<string, unknown> {
  const databaseUrl = (options as DataSourceOptions & { url?: string }).url;

  if (databaseUrl) {
    try {
      const parsedUrl = new URL(databaseUrl);

      return {
        connectionSource: 'url',
        host: parsedUrl.hostname || null,
        port: parsedUrl.port ? Number(parsedUrl.port) : DEFAULT_DATABASE_PORT,
        database: parsedUrl.pathname.replace(/^\/+/, '') || null,
        sslMode: parsedUrl.searchParams.get('sslmode'),
        pooledConnection: parsedUrl.hostname.includes('-pooler'),
        synchronize: options.synchronize ?? null,
      };
    } catch {
      return {
        connectionSource: 'url',
        synchronize: options.synchronize ?? null,
      };
    }
  }

  return {
    connectionSource: 'discrete_fields',
    host:
      (options as DataSourceOptions & { host?: string }).host ?? 'localhost',
    port:
      (options as DataSourceOptions & { port?: number }).port ??
      DEFAULT_DATABASE_PORT,
    database:
      (options as DataSourceOptions & { database?: string }).database ?? null,
    synchronize: options.synchronize ?? null,
  };
}

function getBaseDatabaseOptions(options: {
  preferDirectUrl?: boolean;
  synchronize: boolean;
  includeMigrations?: boolean;
}): DataSourceOptions {
  const baseConfig: DataSourceOptions = {
    type: 'postgres',
    entities: [MessageEntity],
    synchronize: options.synchronize,
    ssl: buildSslConfig(),
    migrationsTableName: 'typeorm_migrations',
  };
  const migrationConfig = options.includeMigrations
    ? {
        migrations: [CreateMessageTable20260415190000],
      }
    : {};

  const databaseUrl = getDatabaseUrl(options.preferDirectUrl);
  if (databaseUrl) {
    return {
      ...baseConfig,
      ...migrationConfig,
      url: databaseUrl,
    };
  }

  return {
    ...baseConfig,
    ...migrationConfig,
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseNumber(process.env.DATABASE_PORT, DEFAULT_DATABASE_PORT),
    username: process.env.DATABASE_USER ?? 'chatuser',
    password: process.env.DATABASE_PASSWORD ?? 'chatpass',
    database: process.env.DATABASE_NAME ?? 'chatdb',
  };
}

export function getDatabaseConfig(): TypeOrmModuleOptions {
  return getBaseDatabaseOptions({
    synchronize: parseBoolean(
      process.env.DATABASE_SYNCHRONIZE,
      process.env.NODE_ENV !== 'production',
    ),
  }) as TypeOrmModuleOptions;
}

export function getMigrationDataSourceOptions(): DataSourceOptions {
  return getBaseDatabaseOptions({
    preferDirectUrl: true,
    synchronize: false,
    includeMigrations: true,
  });
}

export async function createLoggedDataSource(
  options?: DataSourceOptions,
): Promise<DataSource> {
  if (!options) {
    throw new Error(
      'TypeORM options are required to initialize the DataSource',
    );
  }

  const summary = getDatabaseConnectionSummary(options);
  logStructuredEvent(databaseLogger, 'log', 'database_connect_start', summary);

  const dataSource = new DataSource(options);

  try {
    const initializedDataSource = await dataSource.initialize();

    logStructuredEvent(
      databaseLogger,
      'log',
      'database_connect_ready',
      summary,
    );

    return initializedDataSource;
  } catch (error) {
    logStructuredEvent(
      databaseLogger,
      'error',
      'database_connect_failed',
      summary,
      error,
    );
    throw error;
  }
}
