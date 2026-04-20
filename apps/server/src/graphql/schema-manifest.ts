import type { BuildSchemaOptions } from '@nestjs/graphql';
import {
  CHAT_GRAPHQL_RESOLVERS,
  CHAT_GRAPHQL_SCALARS,
} from '../modules/chat/chat.module';

export const GRAPHQL_SCHEMA_RESOLVERS: Function[] = [
  ...CHAT_GRAPHQL_RESOLVERS,
];

export const GRAPHQL_SCHEMA_SCALARS: Function[] = [...CHAT_GRAPHQL_SCALARS];

export const GRAPHQL_SCHEMA_BUILD_OPTIONS: BuildSchemaOptions = {
  orphanedTypes: [],
};
