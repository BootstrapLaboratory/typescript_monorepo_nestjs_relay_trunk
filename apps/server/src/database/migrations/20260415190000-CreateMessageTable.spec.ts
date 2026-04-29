jest.mock('typeorm', () => ({
  Table: jest.fn().mockImplementation((options) => options),
}));

import type { QueryRunner, Table } from 'typeorm';
import { CreateMessageTable20260415190000 } from './20260415190000-CreateMessageTable';

type QueryRunnerMock = Pick<QueryRunner, 'createTable' | 'dropTable'>;

function createQueryRunnerMock(): QueryRunnerMock {
  return {
    createTable: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
  };
}

describe('CreateMessageTable20260415190000', () => {
  const migration = new CreateMessageTable20260415190000();

  it('creates the message table', async () => {
    const queryRunner = createQueryRunnerMock();

    await migration.up(queryRunner as QueryRunner);

    expect(queryRunner.createTable).toHaveBeenCalledTimes(1);
    expect(queryRunner.createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'id', isPrimary: true }),
          expect.objectContaining({ name: 'author', isNullable: true }),
          expect.objectContaining({ name: 'body', isNullable: false }),
        ]) as Table['columns'],
        name: 'message',
      }),
    );
  });

  it('drops the message table on revert', async () => {
    const queryRunner = createQueryRunnerMock();

    await migration.down(queryRunner as QueryRunner);

    expect(queryRunner.dropTable).toHaveBeenCalledWith('message');
  });
});
