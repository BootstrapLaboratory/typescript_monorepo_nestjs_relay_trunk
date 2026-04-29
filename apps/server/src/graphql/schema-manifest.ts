import type { Type } from '@nestjs/common';
import type { BuildSchemaOptions } from '@nestjs/graphql';
import {
  CHAT_GRAPHQL_RESOLVERS,
  CHAT_GRAPHQL_SCALARS,
} from '../modules/chat/chat.module';
import { IDENTITY_GRAPHQL_RESOLVERS } from '../modules/identity/identity.module';

export const GRAPHQL_SCHEMA_RESOLVERS: Array<Type<unknown>> = [
  ...CHAT_GRAPHQL_RESOLVERS,
  ...IDENTITY_GRAPHQL_RESOLVERS,
];

export const GRAPHQL_SCHEMA_SCALARS: Array<Type<unknown>> = [
  ...CHAT_GRAPHQL_SCALARS,
];

export const GRAPHQL_SCHEMA_BUILD_OPTIONS: BuildSchemaOptions = {
  orphanedTypes: [],
};
