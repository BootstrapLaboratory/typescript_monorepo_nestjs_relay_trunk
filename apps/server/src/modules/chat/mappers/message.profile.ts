// src/modules/chat/message.profile.ts
import { createMapper, createMap } from '@automapper/core';
import { classes } from '@automapper/classes';
import { MessageEntity } from '../entities/message.entity';
import { Message } from '../dto/message.model';
import { NewMessageInput } from '../dto/new-message.input';

// 1) Make the mapper
export const mapper = createMapper({
  strategyInitializer: classes(),
});

// 2) Define your maps
// map entity → GraphQL model
createMap(mapper, MessageEntity, Message);
// map input → entity
createMap(mapper, NewMessageInput, MessageEntity);

// 3) Export a Nest provider
export const MapperProvider = {
  provide: 'MESSAGE_MAPPER',
  useValue: mapper,
};
