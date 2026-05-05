import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/* TYPEORM */
import { TypeOrmModule } from '@nestjs/typeorm';

import { createServerAuthAccessTokenGraphqlModule } from '@omgjs/labkit-server-auth';
import { getEnvFilePaths } from '@omgjs/labkit-server-config';
/* internal modules */
import { AppController } from './app.controller';
import { AppService } from './app.service';
import {
  createLoggedDataSource,
  getDatabaseConfig,
} from './config/database.config';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { ChatModule } from './modules/chat/chat.module';
import { IdentityModule } from './modules/identity/identity.module';
import { AccessTokenService } from './modules/identity/token.service';

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
    createServerAuthAccessTokenGraphqlModule({
      imports: [IdentityModule],
      accessTokenServiceToken: AccessTokenService,
      configReaderToken: ConfigService,
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
