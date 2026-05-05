import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ChatPubSubService } from './chat-pubsub.service';
import { Message } from './dto/message.model';

type MockRedisHandler = (...args: string[]) => void;

type MockRedisClient = {
  readonly handlers: Record<string, MockRedisHandler>;
  readonly options: unknown;
  readonly redisUrl: string;
  connect: jest.Mock<Promise<void>>;
  disconnect: jest.Mock<void>;
  on: jest.Mock<MockRedisClient, [string, MockRedisHandler]>;
  publish: jest.Mock<Promise<number>, [string, string]>;
  quit: jest.Mock<Promise<string>>;
  subscribe: jest.Mock<Promise<number>, [string]>;
};

const mockRedisClients: MockRedisClient[] = [];

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((redisUrl: string, options: unknown) => {
    const client: MockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      handlers: {},
      on: jest.fn(function on(
        this: MockRedisClient,
        event: string,
        handler: MockRedisHandler,
      ) {
        this.handlers[event] = handler;
        return this;
      }),
      options,
      publish: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      redisUrl,
      subscribe: jest.fn().mockResolvedValue(1),
    };

    mockRedisClients.push(client);
    return client;
  });
});

const MESSAGE_ADDED_CHANNEL = 'chat.message-added';

const message: Message = {
  author: 'Ada',
  body: 'Hello from the pub/sub boundary',
  id: 'message-1',
};

function createConfigService(
  values: Record<string, string | undefined>,
): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

async function expectNextMessage(
  iterator: AsyncIterableIterator<{ MessageAdded: Message }>,
): Promise<void> {
  await expect(
    Promise.race([
      iterator.next(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error('Timed out waiting for message')),
          50,
        );
      }),
    ]),
  ).resolves.toEqual({
    done: false,
    value: {
      MessageAdded: message,
    },
  });
}

describe('ChatPubSubService', () => {
  const originalVerbosePubSub = process.env.LOG_VERBOSE_PUBSUB;

  beforeEach(() => {
    process.env.LOG_VERBOSE_PUBSUB = 'false';
    mockRedisClients.length = 0;
    jest.mocked(Redis).mockClear();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    if (originalVerbosePubSub === undefined) {
      delete process.env.LOG_VERBOSE_PUBSUB;
    } else {
      process.env.LOG_VERBOSE_PUBSUB = originalVerbosePubSub;
    }

    jest.restoreAllMocks();
  });

  it('uses in-memory fanout when Redis is not selected', async () => {
    const service = new ChatPubSubService(
      createConfigService({
        PUBSUB_DRIVER: 'memory',
      }),
    );
    const iterator = service.messageAddedIterator();

    try {
      await service.onModuleInit();
      const nextMessage = expectNextMessage(iterator);

      await service.publishMessageAdded(message);

      await nextMessage;
      expect(Redis).not.toHaveBeenCalled();
    } finally {
      await iterator.return?.();
      await service.onModuleDestroy();
    }
  });

  it('initializes Redis clients and bridges Redis messages to local subscribers', async () => {
    const service = new ChatPubSubService(
      createConfigService({
        PUBSUB_DRIVER: 'Redis',
        REDIS_URL: 'redis://localhost:6379',
      }),
    );
    const iterator = service.messageAddedIterator();

    try {
      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledTimes(2);
      expect(Redis).toHaveBeenNthCalledWith(1, 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });
      expect(Redis).toHaveBeenNthCalledWith(2, 'redis://localhost:6379', {
        lazyConnect: true,
        maxRetriesPerRequest: null,
      });

      const [publisher, subscriber] = mockRedisClients;
      expect(publisher.connect).toHaveBeenCalled();
      expect(subscriber.connect).toHaveBeenCalled();
      expect(subscriber.subscribe).toHaveBeenCalledWith(MESSAGE_ADDED_CHANNEL);

      await service.publishMessageAdded(message);

      expect(publisher.publish).toHaveBeenCalledWith(
        MESSAGE_ADDED_CHANNEL,
        JSON.stringify({
          MessageAdded: message,
        }),
      );

      const nextMessage = expectNextMessage(iterator);
      subscriber.handlers.message(
        MESSAGE_ADDED_CHANNEL,
        JSON.stringify({
          MessageAdded: message,
        }),
      );

      await nextMessage;
    } finally {
      await iterator.return?.();
      await service.onModuleDestroy();
    }

    expect(mockRedisClients[0].quit).toHaveBeenCalled();
    expect(mockRedisClients[1].quit).toHaveBeenCalled();
  });

  it('rejects Redis configuration without a Redis URL', async () => {
    const service = new ChatPubSubService(
      createConfigService({
        PUBSUB_DRIVER: 'redis',
      }),
    );

    await expect(service.onModuleInit()).rejects.toThrow(
      'REDIS_URL is required when PUBSUB_DRIVER=redis',
    );
    expect(Redis).not.toHaveBeenCalled();
  });
});
