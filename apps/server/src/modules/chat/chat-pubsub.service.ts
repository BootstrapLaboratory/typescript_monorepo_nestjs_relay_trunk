import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from 'graphql-subscriptions';
import Redis from 'ioredis';
import { Message } from './dto/message.model';

const MESSAGE_ADDED_EVENT = 'MessageAdded';
const MESSAGE_ADDED_CHANNEL = 'chat.message-added';

type MessageAddedPayload = {
  MessageAdded: Message;
};

type PubSubDriver = 'memory' | 'redis';

@Injectable()
export class ChatPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatPubSubService.name);
  private readonly localPubSub = new PubSub();
  private readonly driver: PubSubDriver;

  private publisher?: Redis;
  private subscriber?: Redis;

  constructor(private readonly configService: ConfigService) {
    const configuredDriver = this.configService
      .get<string>('PUBSUB_DRIVER')
      ?.trim()
      .toLowerCase();

    this.driver = configuredDriver === 'redis' ? 'redis' : 'memory';
  }

  async onModuleInit(): Promise<void> {
    if (this.driver !== 'redis') {
      this.logger.log('Using in-memory chat pub/sub');
      return;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new Error('REDIS_URL is required when PUBSUB_DRIVER=redis');
    }

    this.publisher = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.subscriber = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });

    this.attachRedisLogging(this.publisher, 'publisher');
    this.attachRedisLogging(this.subscriber, 'subscriber');

    this.subscriber.on('message', (channel, payload) => {
      if (channel !== MESSAGE_ADDED_CHANNEL) {
        return;
      }

      let parsedPayload: MessageAddedPayload;

      try {
        parsedPayload = JSON.parse(payload) as MessageAddedPayload;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown JSON parse failure';
        this.logger.error(
          `Failed to parse Redis payload for ${MESSAGE_ADDED_CHANNEL}: ${message}`,
        );
        return;
      }

      void this.localPubSub.publish(MESSAGE_ADDED_EVENT, parsedPayload);
    });

    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    await this.subscriber.subscribe(MESSAGE_ADDED_CHANNEL);

    this.logger.log('Using Redis-backed chat pub/sub');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.closeRedisClient(this.publisher, 'publisher'),
      this.closeRedisClient(this.subscriber, 'subscriber'),
    ]);
  }

  async publishMessageAdded(message: Message): Promise<void> {
    const payload: MessageAddedPayload = {
      MessageAdded: message,
    };

    if (this.driver === 'redis') {
      if (!this.publisher) {
        throw new Error('Redis publisher is not initialized');
      }

      await this.publisher.publish(
        MESSAGE_ADDED_CHANNEL,
        JSON.stringify(payload),
      );
      return;
    }

    await this.localPubSub.publish(MESSAGE_ADDED_EVENT, payload);
  }

  messageAddedIterator(): AsyncIterableIterator<MessageAddedPayload> {
    return this.localPubSub.asyncIterableIterator<MessageAddedPayload>(
      MESSAGE_ADDED_EVENT,
    );
  }

  private attachRedisLogging(client: Redis, role: string): void {
    client.on('error', (error) => {
      this.logger.error(
        `Redis ${role} error: ${error.message}`,
        error.stack,
      );
    });

    client.on('reconnecting', () => {
      this.logger.warn(`Redis ${role} reconnecting`);
    });

    client.on('ready', () => {
      this.logger.log(`Redis ${role} ready`);
    });
  }

  private async closeRedisClient(
    client: Redis | undefined,
    role: string,
  ): Promise<void> {
    if (!client) {
      return;
    }

    try {
      await client.quit();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown Redis shutdown error';
      this.logger.warn(
        `Redis ${role} quit failed, disconnecting instead: ${message}`,
      );
      client.disconnect();
    }
  }
}
