jest.mock('typeorm', () => {
  const decorator = () => () => undefined;

  return {
    Column: decorator,
    CreateDateColumn: decorator,
    DataSource: jest.fn().mockImplementation((options) => ({
      initialize: jest.fn().mockResolvedValue({ options }),
    })),
    Entity: decorator,
    JoinColumn: decorator,
    ManyToOne: decorator,
    OneToMany: decorator,
    PrimaryColumn: decorator,
    PrimaryGeneratedColumn: decorator,
    Table: jest.fn().mockImplementation((options) => options),
    TableForeignKey: jest.fn().mockImplementation((options) => options),
    Unique: decorator,
    UpdateDateColumn: decorator,
  };
});

import { getDatabaseConfig } from './database.config';

const ENV_KEYS_TO_RESET = [
  'NODE_ENV',
  'DATABASE_URL',
  'DATABASE_URL_DIRECT',
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'DATABASE_SYNCHRONIZE',
  'DATABASE_RUN_MIGRATIONS_ON_START',
  'DATABASE_SSL',
  'DATABASE_SSL_REJECT_UNAUTHORIZED',
] as const;

describe('getDatabaseConfig', () => {
  const originalEnvValues = new Map<string, string | undefined>();

  beforeAll(() => {
    for (const key of ENV_KEYS_TO_RESET) {
      originalEnvValues.set(key, process.env[key]);
    }
  });

  beforeEach(() => {
    for (const key of ENV_KEYS_TO_RESET) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS_TO_RESET) {
      const originalValue = originalEnvValues.get(key);
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  it('runs migrations on application start when configured', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_SYNCHRONIZE = 'false';
    process.env.DATABASE_RUN_MIGRATIONS_ON_START = 'true';
    process.env.DATABASE_SSL = 'false';

    const config = getDatabaseConfig();

    expect(config.synchronize).toBe(false);
    expect(config.migrationsRun).toBe(true);

    const migrations = config.migrations as
      | Array<string | { name: string }>
      | undefined;
    expect(
      migrations?.map((migration) =>
        typeof migration === 'string' ? migration : migration.name,
      ),
    ).toContain('CreateMessageTable20260415190000');
    expect(
      migrations?.map((migration) =>
        typeof migration === 'string' ? migration : migration.name,
      ),
    ).toContain('CreateIdentityTables20260429143000');
  });

  it('rejects schema synchronization with migrations on application start', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_SYNCHRONIZE = 'true';
    process.env.DATABASE_RUN_MIGRATIONS_ON_START = 'true';

    expect(() => getDatabaseConfig()).toThrow(
      'DATABASE_SYNCHRONIZE=true cannot be used with DATABASE_RUN_MIGRATIONS_ON_START=true',
    );
  });
});
