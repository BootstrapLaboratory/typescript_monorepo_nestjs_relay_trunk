import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { parseList, parseNumber } from './config/env.utils';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const configService = app.get(ConfigService);
  const corsOrigins = parseList(configService.get<string>('CORS_ORIGIN'));
  const corsOrigin = corsOrigins.length === 0 || corsOrigins.includes('*')
    ? true
    : corsOrigins;

  app.enableCors({
    origin: corsOrigin,
  });

  app.enableShutdownHooks();

  const port = parseNumber(configService.get<string>('PORT'), 3000);
  const host = configService.get<string>('HOST') ?? '0.0.0.0';

  await app.listen(port, host);
}
void bootstrap();
