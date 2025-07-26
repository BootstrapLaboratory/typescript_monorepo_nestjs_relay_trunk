import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/* GRAPHQL */
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

/* TYPEORM */
import { TypeOrmModule } from '@nestjs/typeorm';

import { join } from 'path';

/* internal modules */
import { ChatModule } from './modules/chat/chat.module';
import { MessageEntity } from './modules/chat/entities/message.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV}`,
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    ChatModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      subscriptions: {
        'graphql-ws': true,
      },
      // 🔑 force introspection on even in "production"
      introspection: true, // ← ADD THIS :contentReference[oaicite:0]{index=0}
      plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
      playground: false, // if you want the old GraphQL Playground
      autoSchemaFile: join(process.cwd(), '__generated__/schema.gql'),
      sortSchema: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5433', 10),
      username: 'chatuser',
      password: 'chatpass',
      database: 'chatdb',
      entities: [MessageEntity],
      synchronize: true, // WARN: do not use it in production - you can easily loose all your data
    }),
  ],
})
export class AppModule {}
