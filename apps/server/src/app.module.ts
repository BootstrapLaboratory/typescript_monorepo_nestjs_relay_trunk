import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/* GRAPHQL */
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

/* TYPEORM */
import { TypeOrmModule } from '@nestjs/typeorm';

import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import { join } from 'path';

/* internal modules */
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getEnvFilePaths } from './config/env-paths';
import { ChatModule } from './modules/chat/chat.module';
import {
  createLoggedDataSource,
  getDatabaseConfig,
} from './config/database.config';
import {
  isGraphqlSubscriptionLoggingEnabled,
  logStructuredEvent,
} from './logging/structured-log';

const subscriptionLogger = new Logger('GraphQLSubscriptions');

type GraphqlWsExtra = {
  connectionId?: string;
  request?: IncomingMessage;
};

function getGraphqlWsExtra(extra: unknown): GraphqlWsExtra {
  return (extra ?? {}) as GraphqlWsExtra;
}

function getClientIp(request: IncomingMessage | undefined): string | null {
  if (!request) {
    return null;
  }

  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.split(',')[0]?.trim() ?? null;
  }

  return request.socket.remoteAddress ?? null;
}

function logSubscriptionEvent(
  event: string,
  details: Record<string, unknown>,
): void {
  if (!isGraphqlSubscriptionLoggingEnabled()) {
    return;
  }

  logStructuredEvent(subscriptionLogger, 'log', event, details);
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: getEnvFilePaths(),
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ChatModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        path: configService.get<string>('GRAPHQL_PATH') ?? '/graphql',
        subscriptions: {
          'graphql-ws': {
            connectionInitWaitTimeout: 15_000,
            onConnect: (ctx) => {
              const extra = getGraphqlWsExtra(ctx.extra);
              const connectionId = randomUUID();
              extra.connectionId = connectionId;

              logSubscriptionEvent('graphql_subscription_connect', {
                connectionId,
                ip: getClientIp(extra.request),
                path: extra.request?.url ?? null,
              });
            },
            onDisconnect: (ctx, code, reason) => {
              const extra = getGraphqlWsExtra(ctx.extra);

              logSubscriptionEvent('graphql_subscription_disconnect', {
                connectionId: extra.connectionId ?? null,
                code: code ?? null,
                reason: reason ?? null,
              });
            },
            onSubscribe: (ctx, id, payload) => {
              const extra = getGraphqlWsExtra(ctx.extra);

              logSubscriptionEvent('graphql_subscription_subscribe', {
                connectionId: extra.connectionId ?? null,
                operationId: id,
                operationName: payload.operationName ?? null,
              });
            },
          },
        },
        // Keep schema exploration available while the project is still being
        // migrated to its hosted production setup.
        introspection: true,
        plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
        playground: false,
        autoSchemaFile: join(process.cwd(), '__generated__/schema.gql'),
        sortSchema: true,
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => getDatabaseConfig(),
      dataSourceFactory: async (options) => createLoggedDataSource(options),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
