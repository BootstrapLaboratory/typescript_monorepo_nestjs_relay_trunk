import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DateScalar } from '../common/scalars/date.scalar';
import { ChatPubSubService } from './chat-pubsub.service';
import { ChatResolver } from './chat.resolver';
import { ChatService } from './chat.service';
import { MessageEntity } from './entities/message.entity';
import { MapperProvider } from './mappers/message.profile';

@Module({
  imports: [TypeOrmModule.forFeature([MessageEntity])],
  providers: [
    ChatResolver,
    ChatService,
    ChatPubSubService,
    DateScalar,
    MapperProvider,
  ],
})
export class ChatModule {}
