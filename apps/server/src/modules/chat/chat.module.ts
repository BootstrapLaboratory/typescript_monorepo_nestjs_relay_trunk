import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DateScalar } from '../common/scalars/date.scalar';
import { ChatPubSubService } from './chat-pubsub.service';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';
import { MessageEntity } from './entities/message.entity';
import { MapperProvider } from './mappers/message.profile';

export const CHAT_GRAPHQL_RESOLVERS = [ChatResolver] as const;
export const CHAT_GRAPHQL_SCALARS = [DateScalar] as const;

@Module({
  imports: [TypeOrmModule.forFeature([MessageEntity])],
  providers: [
    ...CHAT_GRAPHQL_RESOLVERS,
    ChatService,
    ChatPubSubService,
    ...CHAT_GRAPHQL_SCALARS,
    MapperProvider,
  ],
})
export class ChatModule {}
