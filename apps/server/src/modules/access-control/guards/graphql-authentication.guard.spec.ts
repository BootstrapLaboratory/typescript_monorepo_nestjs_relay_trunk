import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Principal } from '../../identity/identity.types';
import { AccessTokenService } from '../../identity/token.service';
import { GraphqlAuthenticationGuard } from './graphql-authentication.guard';

function createExecutionContext(): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('GraphqlAuthenticationGuard', () => {
  const principal: Principal = {
    permissions: [],
    provider: 'local',
    roles: ['user'],
    subject: 'user@example.com',
    userId: '1',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows public handlers without resolving a token', async () => {
    const verifyAccessToken = jest.fn();
    const accessTokenService = {
      verifyAccessToken,
    } as unknown as AccessTokenService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new GraphqlAuthenticationGuard(accessTokenService, reflector);

    await expect(guard.canActivate(createExecutionContext())).resolves.toBe(
      true,
    );
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('resolves a principal from the GraphQL authorization header', async () => {
    const gqlContext = {
      req: {
        headers: {
          authorization: 'Bearer access-token',
        },
      },
    };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => gqlContext,
    } as unknown as GqlExecutionContext);

    const verifyAccessToken = jest.fn().mockResolvedValue(principal);
    const accessTokenService = {
      verifyAccessToken,
    } as unknown as AccessTokenService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new GraphqlAuthenticationGuard(accessTokenService, reflector);

    await expect(guard.canActivate(createExecutionContext())).resolves.toBe(
      true,
    );
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(gqlContext).toEqual(
      expect.objectContaining({
        principal,
      }),
    );
  });

  it('rejects protected handlers without a bearer token', async () => {
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: {
          headers: {},
        },
      }),
    } as unknown as GqlExecutionContext);

    const guard = new GraphqlAuthenticationGuard(
      {
        verifyAccessToken: jest.fn(),
      } as unknown as AccessTokenService,
      {
        getAllAndOverride: jest.fn().mockReturnValue(undefined),
      } as unknown as Reflector,
    );

    await expect(guard.canActivate(createExecutionContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
