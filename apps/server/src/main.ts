import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import {
  readServerCorsOptions,
  readServerRuntimeOptions,
  summarizeServerCorsOrigin,
} from '@omgjs/labkit-server-config';
import { logStructuredEvent } from '@omgjs/labkit-server-observability';
import { AppModule } from './app.module';

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
    await app.register(fastifyCookie);

    const corsOptions = readServerCorsOptions(configService);

    app.enableCors(corsOptions);
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    app.enableShutdownHooks();

    const runtimeOptions = readServerRuntimeOptions(configService);

    logStructuredEvent(bootstrapLogger, 'log', 'app_bootstrap_configured', {
      host: runtimeOptions.host,
      port: runtimeOptions.port,
      graphqlPath: runtimeOptions.graphqlPath,
      pubsubDriver: runtimeOptions.pubsubDriver,
      corsCredentials: corsOptions.credentials,
      corsOrigin: summarizeServerCorsOrigin(corsOptions.origin),
    });

    await app.listen(runtimeOptions.port, runtimeOptions.host);

    logStructuredEvent(bootstrapLogger, 'log', 'app_listening', {
      host: runtimeOptions.host,
      port: runtimeOptions.port,
      graphqlPath: runtimeOptions.graphqlPath,
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
