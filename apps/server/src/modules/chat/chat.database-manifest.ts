import type { ServerDatabaseFeatureManifest } from '@omgjs/labkit-server-database';
import { CreateMessageTable20260415190000 } from '../../database/migrations/20260415190000-CreateMessageTable';
import { MessageEntity } from './entities/message.entity';

export const CHAT_DATABASE_ENTITIES = [MessageEntity] as const;
export const CHAT_DATABASE_MIGRATIONS = [
  CreateMessageTable20260415190000,
] as const;

export const chatDatabaseManifest = {
  entities: CHAT_DATABASE_ENTITIES,
  migrations: CHAT_DATABASE_MIGRATIONS,
} satisfies ServerDatabaseFeatureManifest;
