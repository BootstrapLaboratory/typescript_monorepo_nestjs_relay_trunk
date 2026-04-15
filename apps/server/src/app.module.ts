import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

/* GRAPHQL */
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

/* TYPEORM */
import { TypeOrmModule } from '@nestjs/typeorm';

import { join } from 'path';

/* internal modules */
import { ChatModule } from './modules/chat/chat.module';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ChatModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        path: configService.get<string>('GRAPHQL_PATH') ?? '/graphql',
        subscriptions: {
          'graphql-ws': true,
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
    }),
  ],
})
export class AppModule {}
