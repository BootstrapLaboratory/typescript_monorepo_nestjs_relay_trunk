import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { parseList, parseNumber } from './config/env.utils';
import { logStructuredEvent } from './logging/structured-log';

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  logStructuredEvent(bootstrapLogger, 'log', 'app_bootstrap_start', {
    nodeEnv: process.env.NODE_ENV ?? null,
  });

  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
    );

    const configService = app.get(ConfigService);
    const corsOrigins = parseList(configService.get<string>('CORS_ORIGIN'));
    const corsOrigin =
      corsOrigins.length === 0 || corsOrigins.includes('*')
        ? true
        : corsOrigins;

    app.enableCors({
      origin: corsOrigin,
    });

    app.enableShutdownHooks();

    const port = parseNumber(configService.get<string>('PORT'), 3000);
    const host = configService.get<string>('HOST') ?? '0.0.0.0';
    const graphqlPath = configService.get<string>('GRAPHQL_PATH') ?? '/graphql';
    const pubsubDriver =
      configService.get<string>('PUBSUB_DRIVER')?.trim().toLowerCase() ??
      'memory';

    logStructuredEvent(bootstrapLogger, 'log', 'app_bootstrap_configured', {
      host,
      port,
      graphqlPath,
      pubsubDriver,
      corsOrigin: corsOrigin === true ? '*' : corsOrigins,
    });

    await app.listen(port, host);

    logStructuredEvent(bootstrapLogger, 'log', 'app_listening', {
      host,
      port,
      graphqlPath,
      healthPath: '/health',
    });
  } catch (error) {
    logStructuredEvent(
      bootstrapLogger,
      'error',
      'app_bootstrap_failed',
      {
        nodeEnv: process.env.NODE_ENV ?? null,
      },
      error,
    );
    throw error;
  }
}
void bootstrap().catch(() => {
  process.exit(1);
});
