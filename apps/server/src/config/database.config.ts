import { TypeOrmModuleOptions } from '@nestjs/typeorm';
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

export function getDatabaseConfig(): TypeOrmModuleOptions {
  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [MessageEntity],
    synchronize: parseBoolean(
      process.env.DATABASE_SYNCHRONIZE,
      process.env.NODE_ENV !== 'production',
    ),
    ssl: buildSslConfig(),
  };

  if (process.env.DATABASE_URL) {
    return {
      ...baseConfig,
      url: process.env.DATABASE_URL,
    };
  }

  return {
    ...baseConfig,
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseNumber(process.env.DATABASE_PORT, DEFAULT_DATABASE_PORT),
    username: process.env.DATABASE_USER ?? 'chatuser',
    password: process.env.DATABASE_PASSWORD ?? 'chatpass',
    database: process.env.DATABASE_NAME ?? 'chatdb',
  };
}
