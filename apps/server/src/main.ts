import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Allow your React dev server to talk to Nest
  app.enableCors({
    origin: '*',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
