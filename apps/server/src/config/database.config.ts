import { Logger } from '@nestjs/common';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { serverAuthTypeormDatabaseManifest } from '@omgjs/labkit-server-auth-typeorm';
import { chatDatabaseManifest } from '../modules/chat/chat.database-manifest';
import {
  assertDatabaseMigrationSafety,
  composeServerDatabaseManifests,
  readDatabaseRuntimeFlags,
  readPostgresConnectionUrl,
  readPostgresDiscreteConnectionOptions,
  readPostgresSslConfig,
  summarizePostgresConnection,
} from '@omgjs/labkit-server-database';
import { createEnvironmentConfigReader } from '@omgjs/labkit-server-config';
import { logStructuredEvent } from '@omgjs/labkit-server-observability';

const databaseLogger = new Logger('Database');
const envConfigReader = createEnvironmentConfigReader(process.env);
type TypeOrmEntity = Extract<
  NonNullable<DataSourceOptions['entities']>,
  readonly unknown[]
>[number];
type TypeOrmMigration = Extract<
  NonNullable<DataSourceOptions['migrations']>,
  readonly unknown[]
>[number];
const serverDatabaseManifest = composeServerDatabaseManifests<
  TypeOrmEntity,
  TypeOrmMigration
>([chatDatabaseManifest, serverAuthTypeormDatabaseManifest]);

function getBaseDatabaseOptions(options: {
  preferDirectUrl?: boolean;
  synchronize: boolean;
  includeMigrations?: boolean;
  migrationsRun?: boolean;
}): DataSourceOptions {
  const includeMigrations =
    options.includeMigrations || options.migrationsRun === true;
  const baseConfig: DataSourceOptions = {
    type: 'postgres',
    entities: serverDatabaseManifest.entities,
    synchronize: options.synchronize,
    migrationsRun: options.migrationsRun,
    ssl: readPostgresSslConfig(envConfigReader, {
      nodeEnv: process.env.NODE_ENV,
    }),
    migrationsTableName: 'typeorm_migrations',
  };
  const migrationConfig = includeMigrations
    ? { migrations: serverDatabaseManifest.migrations }
    : {};

  const databaseUrl = readPostgresConnectionUrl(envConfigReader, {
    preferDirectUrl: options.preferDirectUrl,
  });
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
    ...readPostgresDiscreteConnectionOptions(envConfigReader),
  };
}

export function getDatabaseConfig(): TypeOrmModuleOptions {
  const runtimeFlags = readDatabaseRuntimeFlags(envConfigReader, {
    nodeEnv: process.env.NODE_ENV,
  });
  assertDatabaseMigrationSafety(runtimeFlags);

  return getBaseDatabaseOptions({
    synchronize: runtimeFlags.synchronize,
    includeMigrations: runtimeFlags.runMigrationsOnStart,
    migrationsRun: runtimeFlags.runMigrationsOnStart,
  });
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

  const summary = summarizePostgresConnection(options);
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
