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
/* internal modules */
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getEnvFilePaths } from './config/env-paths';
import {
  createLoggedDataSource,
  getDatabaseConfig,
} from './config/database.config';
import {
  isGraphqlSubscriptionLoggingEnabled,
  logStructuredEvent,
} from './logging/structured-log';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { extractBearerToken } from './modules/access-control/bearer-token';
import { extractGraphqlWsAuthorization } from './modules/access-control/graphql-ws-auth';
import { ChatModule } from './modules/chat/chat.module';
import { IdentityGraphqlContext } from './modules/identity/graphql/identity-graphql.context';
import { IdentityModule } from './modules/identity/identity.module';
import { Principal } from './modules/identity/identity.types';
import { AccessTokenService } from './modules/identity/token.service';

const subscriptionLogger = new Logger('GraphQLSubscriptions');

type GraphqlWsExtra = {
  connectionId?: string;
  principal?: Principal | null;
  request?: IncomingMessage;
};

function getGraphqlWsExtra(extra: unknown): GraphqlWsExtra {
  if (typeof extra === 'object' && extra !== null) {
    return extra;
  }

  return {};
}

async function resolvePrincipalFromAuthorization(
  accessTokenService: AccessTokenService,
  authorizationHeader: string | string[] | undefined,
): Promise<Principal | null> {
  const bearerToken = extractBearerToken(authorizationHeader);
  if (!bearerToken) {
    return null;
  }

  return accessTokenService.verifyAccessToken(bearerToken);
}

function getGraphqlContextParts(
  contextOrRequest:
    | {
        extra?: unknown;
        reply?: IdentityGraphqlContext['reply'];
        req?: IdentityGraphqlContext['req'];
      }
    | IdentityGraphqlContext['req']
    | undefined,
  reply?: IdentityGraphqlContext['reply'],
): {
  extra?: unknown;
  reply?: IdentityGraphqlContext['reply'];
  req?: IdentityGraphqlContext['req'];
} {
  if (
    typeof contextOrRequest === 'object' &&
    contextOrRequest !== null &&
    ('extra' in contextOrRequest ||
      'req' in contextOrRequest ||
      'reply' in contextOrRequest)
  ) {
    return {
      extra: contextOrRequest.extra,
      reply: contextOrRequest.reply ?? reply,
      req: contextOrRequest.req,
    };
  }

  return {
    reply,
    req: contextOrRequest as IdentityGraphqlContext['req'],
  };
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
    IdentityModule,
    AccessControlModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [IdentityModule],
      inject: [ConfigService, AccessTokenService],
      useFactory: (
        configService: ConfigService,
        accessTokenService: AccessTokenService,
      ) => {
        return {
          path: configService.get<string>('GRAPHQL_PATH') ?? '/graphql',
          context: async (
            contextOrRequest:
              | {
                  extra?: unknown;
                  reply?: IdentityGraphqlContext['reply'];
                  req?: IdentityGraphqlContext['req'];
                }
              | IdentityGraphqlContext['req']
              | undefined,
            reply?: IdentityGraphqlContext['reply'],
          ): Promise<IdentityGraphqlContext> => {
            const {
              extra,
              req,
              reply: contextReply,
            } = getGraphqlContextParts(contextOrRequest, reply);
            const wsExtra = getGraphqlWsExtra(extra);
            return {
              principal:
                wsExtra.principal ??
                (await resolvePrincipalFromAuthorization(
                  accessTokenService,
                  req?.headers?.authorization,
                )),
              reply: contextReply,
              req,
            };
          },
          subscriptions: {
            'graphql-ws': {
              connectionInitWaitTimeout: 15_000,
              onConnect: async (ctx) => {
                const extra = getGraphqlWsExtra(ctx.extra);
                const connectionId = randomUUID();
                extra.connectionId = connectionId;
                extra.principal = await resolvePrincipalFromAuthorization(
                  accessTokenService,
                  extractGraphqlWsAuthorization(ctx.connectionParams),
                );

                logSubscriptionEvent('graphql_subscription_connect', {
                  connectionId,
                  ip: getClientIp(extra.request),
                  path: extra.request?.url ?? null,
                  principalUserId: extra.principal?.userId ?? null,
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
          // GraphQL SDL is generated ahead of time into libs/api/schema.gql.
          // Runtime boot should not own or mutate the shared contract file.
          autoSchemaFile: true,
          sortSchema: true,
        };
      },
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
