import { NotFoundException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { NewMessageInput } from './dto/new-message.input';
import { Message } from './dto/message.model';
import { ChatService } from './chat.service';

const pubSub = new PubSub();

@Resolver(() => Message)
export class ChatResolver {
  constructor(private readonly chatService: ChatService) {}

  @Query(() => Message)
  async getMessage(@Args('id') id: string): Promise<Message> {
    const Message = await this.chatService.findOneById(id);
    if (!Message) {
      throw new NotFoundException(id);
    }
    return Message;
  }

  @Query(() => [Message])
  getMessages(): Promise<Message[]> {
    return this.chatService.findAll();
  }

  @Mutation(() => Message)
  async addMessage(
    @Args('newMessageData') newMessageData: NewMessageInput,
  ): Promise<Message> {
    const Message = await this.chatService.create(newMessageData);
    void pubSub.publish('MessageAdded', { MessageAdded: Message });
    return Message;
  }

  @Mutation(() => Boolean)
  async removeMessage(@Args('id') id: number) {
    return this.chatService.remove(id);
  }

  @Subscription(() => Message)
  MessageAdded() {
    return pubSub.asyncIterableIterator('MessageAdded');
  }
}
