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
import {
  isVerbosePubSubLoggingEnabled,
  logStructuredEvent,
} from '../../logging/structured-log';

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
      logStructuredEvent(this.logger, 'log', 'chat_pubsub_driver_selected', {
        driver: this.driver,
      });
      return;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      const error = new Error('REDIS_URL is required when PUBSUB_DRIVER=redis');
      logStructuredEvent(
        this.logger,
        'error',
        'chat_pubsub_init_failed',
        {
          driver: this.driver,
          reason: 'missing_redis_url',
        },
        error,
      );
      throw error;
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
      void this.handleRedisMessage(channel, payload);
    });

    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await this.subscriber.subscribe(MESSAGE_ADDED_CHANNEL);

      logStructuredEvent(this.logger, 'log', 'chat_pubsub_driver_selected', {
        driver: this.driver,
        channel: MESSAGE_ADDED_CHANNEL,
      });
    } catch (error) {
      logStructuredEvent(
        this.logger,
        'error',
        'chat_pubsub_init_failed',
        {
          driver: this.driver,
          channel: MESSAGE_ADDED_CHANNEL,
        },
        error,
      );

      await Promise.all([
        this.closeRedisClient(this.publisher, 'publisher'),
        this.closeRedisClient(this.subscriber, 'subscriber'),
      ]);
      throw error;
    }
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
        const error = new Error('Redis publisher is not initialized');
        logStructuredEvent(
          this.logger,
          'error',
          'chat_pubsub_publish_failed',
          {
            driver: this.driver,
            channel: MESSAGE_ADDED_CHANNEL,
            messageId: message.id,
            reason: 'publisher_not_initialized',
          },
          error,
        );
        throw error;
      }

      try {
        await this.publisher.publish(
          MESSAGE_ADDED_CHANNEL,
          JSON.stringify(payload),
        );
        if (isVerbosePubSubLoggingEnabled()) {
          logStructuredEvent(this.logger, 'log', 'chat_pubsub_publish', {
            channel: MESSAGE_ADDED_CHANNEL,
            driver: this.driver,
            messageId: message.id,
          });
        }
      } catch (error) {
        logStructuredEvent(
          this.logger,
          'error',
          'chat_pubsub_publish_failed',
          {
            channel: MESSAGE_ADDED_CHANNEL,
            driver: this.driver,
            messageId: message.id,
          },
          error,
        );
        throw error;
      }

      return;
    }

    try {
      await this.localPubSub.publish(MESSAGE_ADDED_EVENT, payload);
      if (isVerbosePubSubLoggingEnabled()) {
        logStructuredEvent(this.logger, 'log', 'chat_pubsub_publish', {
          channel: MESSAGE_ADDED_EVENT,
          driver: this.driver,
          messageId: message.id,
        });
      }
    } catch (error) {
      logStructuredEvent(
        this.logger,
        'error',
        'chat_pubsub_publish_failed',
        {
          channel: MESSAGE_ADDED_EVENT,
          driver: this.driver,
          messageId: message.id,
        },
        error,
      );
      throw error;
    }
  }

  messageAddedIterator(): AsyncIterableIterator<MessageAddedPayload> {
    return this.localPubSub.asyncIterableIterator<MessageAddedPayload>(
      MESSAGE_ADDED_EVENT,
    );
  }

  private attachRedisLogging(client: Redis, role: string): void {
    client.on('error', (error) => {
      logStructuredEvent(
        this.logger,
        'error',
        'redis_client_error',
        {
          driver: this.driver,
          role,
        },
        error,
      );
    });

    client.on('reconnecting', () => {
      logStructuredEvent(this.logger, 'warn', 'redis_client_reconnecting', {
        driver: this.driver,
        role,
      });
    });

    client.on('ready', () => {
      logStructuredEvent(this.logger, 'log', 'redis_client_ready', {
        driver: this.driver,
        role,
      });
    });

    client.on('close', () => {
      logStructuredEvent(this.logger, 'warn', 'redis_client_closed', {
        driver: this.driver,
        role,
      });
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
      logStructuredEvent(
        this.logger,
        'warn',
        'redis_client_quit_failed',
        {
          driver: this.driver,
          role,
        },
        error,
      );
      client.disconnect();
    }
  }

  private async handleRedisMessage(
    channel: string,
    payload: string,
  ): Promise<void> {
    if (channel !== MESSAGE_ADDED_CHANNEL) {
      return;
    }

    let parsedPayload: MessageAddedPayload;

    try {
      parsedPayload = JSON.parse(payload) as MessageAddedPayload;
    } catch (error) {
      logStructuredEvent(
        this.logger,
        'error',
        'chat_pubsub_deliver_parse_failed',
        {
          channel,
          driver: this.driver,
        },
        error,
      );
      return;
    }

    try {
      await this.localPubSub.publish(MESSAGE_ADDED_EVENT, parsedPayload);
      if (isVerbosePubSubLoggingEnabled()) {
        logStructuredEvent(this.logger, 'log', 'chat_pubsub_deliver', {
          channel,
          driver: this.driver,
          messageId: parsedPayload.MessageAdded.id,
        });
      }
    } catch (error) {
      logStructuredEvent(
        this.logger,
        'error',
        'chat_pubsub_deliver_failed',
        {
          channel,
          driver: this.driver,
          messageId: parsedPayload.MessageAdded.id,
        },
        error,
      );
    }
  }
}
