import { NotFoundException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { NewMessageInput } from './dto/new-message.input';
import { Message } from './dto/message.model';
import { ChatService } from './chat.service';

const pubSub = new PubSub();

@Resolver((of) => Message)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}

  @Query((returns) => Message)
  async getMessage(@Args('id') id: string): Promise<Message> {
    const Message = await this.chatService.findOneById(id);
    if (!Message) {
      throw new NotFoundException(id);
    }
    return Message;
  }

  @Query((returns) => [Message])
  getMessages(): Promise<Message[]> {
    return this.chatService.findAll();
  }

  @Mutation((returns) => Message)
  async addMessage(
    @Args('newMessageData') newMessageData: NewMessageInput,
  ): Promise<Message> {
    const Message = await this.chatService.create(newMessageData);
    pubSub.publish('MessageAdded', { MessageAdded: Message });
    return Message;
  }

  @Mutation((returns) => Boolean)
  async removeMessage(@Args('id') id: number) {
    return this.chatService.remove(id);
  }

  @Subscription((returns) => Message)
  MessageAdded() {
    return pubSub.asyncIterableIterator('MessageAdded');
  }
}
