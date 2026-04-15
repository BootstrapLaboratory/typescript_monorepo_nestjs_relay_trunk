import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { CreateMessageTable20260415190000 } from '../database/migrations/20260415190000-CreateMessageTable';
import { MessageEntity } from '../modules/chat/entities/message.entity';
import { parseBoolean, parseNumber } from './env.utils';

const DEFAULT_DATABASE_PORT = 5432;

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

function getDatabaseUrl(preferDirectUrl = false): string | undefined {
  if (preferDirectUrl && process.env.DATABASE_URL_DIRECT) {
    return process.env.DATABASE_URL_DIRECT;
  }

  return process.env.DATABASE_URL;
}

function getBaseDatabaseOptions(
  options: {
    preferDirectUrl?: boolean;
    synchronize: boolean;
    includeMigrations?: boolean;
  },
): DataSourceOptions {
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
