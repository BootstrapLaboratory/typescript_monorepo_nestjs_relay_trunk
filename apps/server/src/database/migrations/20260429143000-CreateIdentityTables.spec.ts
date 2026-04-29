jest.mock('typeorm', () => ({
  Table: jest.fn().mockImplementation((options) => options),
  TableForeignKey: jest.fn().mockImplementation((options) => options),
}));

import type { QueryRunner, Table } from 'typeorm';
import { CreateIdentityTables20260429143000 } from './20260429143000-CreateIdentityTables';

type QueryRunnerMock = Pick<
  QueryRunner,
  'createForeignKey' | 'createTable' | 'dropTable'
>;

function createQueryRunnerMock(): QueryRunnerMock {
  return {
    createForeignKey: jest.fn().mockResolvedValue(undefined),
    createTable: jest.fn().mockResolvedValue(undefined),
    dropTable: jest.fn().mockResolvedValue(undefined),
  };
}

describe('CreateIdentityTables20260429143000', () => {
  const migration = new CreateIdentityTables20260429143000();

  it('creates the local identity tables', async () => {
    const queryRunner = createQueryRunnerMock();

    await migration.up(queryRunner as QueryRunner);

    expect(queryRunner.createTable).toHaveBeenCalledTimes(4);
    expect(queryRunner.createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'id', isPrimary: true }),
          expect.objectContaining({ name: 'email', isNullable: true }),
          expect.objectContaining({ name: 'is_active', default: true }),
        ]) as Table['columns'],
        name: 'identity_user',
      }),
    );
    expect(queryRunner.createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'provider', isNullable: false }),
          expect.objectContaining({ name: 'subject', isNullable: false }),
          expect.objectContaining({ name: 'password_hash', isNullable: true }),
        ]) as Table['columns'],
        name: 'identity_account',
      }),
    );
    expect(queryRunner.createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'user_id', isNullable: false }),
          expect.objectContaining({ name: 'role', isNullable: false }),
        ]) as Table['columns'],
        name: 'identity_user_role',
      }),
    );
    expect(queryRunner.createTable).toHaveBeenCalledWith(
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ name: 'token_hash', isNullable: false }),
          expect.objectContaining({ name: 'expires_at', isNullable: false }),
          expect.objectContaining({ name: 'revoked_at', isNullable: true }),
        ]) as Table['columns'],
        name: 'identity_refresh_session',
      }),
    );
    expect(queryRunner.createForeignKey).toHaveBeenCalledTimes(3);
  });

  it('drops identity tables in dependency order on revert', async () => {
    const queryRunner = createQueryRunnerMock();

    await migration.down(queryRunner as QueryRunner);

    expect(queryRunner.dropTable).toHaveBeenNthCalledWith(
      1,
      'identity_refresh_session',
    );
    expect(queryRunner.dropTable).toHaveBeenNthCalledWith(
      2,
      'identity_user_role',
    );
    expect(queryRunner.dropTable).toHaveBeenNthCalledWith(
      3,
      'identity_account',
    );
    expect(queryRunner.dropTable).toHaveBeenNthCalledWith(4, 'identity_user');
  });
});
