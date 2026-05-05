import { UnauthorizedException } from '@nestjs/common';
import {
  IdentityProviderCapability,
  type AuthSessionResult,
  type IdentityProvider,
  type ProviderIdentity,
} from '@omgjs/labkit-server-auth';
import { IdentityService } from './identity.service';
import { IdentitySessionService } from './session.service';

const providerIdentity: ProviderIdentity = {
  displayName: 'Ada',
  permissions: ['chat:write'],
  provider: 'local',
  roles: ['user'],
  subject: 'ada@example.com',
  userId: 'user-1',
};

const authSession: AuthSessionResult = {
  accessToken: 'access-token',
  accessTokenExpiresAt: new Date('2026-05-04T10:00:00.000Z'),
  principal: {
    displayName: 'Ada',
    permissions: ['chat:write'],
    provider: 'local',
    roles: ['user'],
    subject: 'ada@example.com',
    userId: 'user-1',
  },
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: new Date('2026-06-03T10:00:00.000Z'),
};

function createIdentityService({
  loginProvider,
  registrationProvider = loginProvider,
  sessionService = {
    createSession: jest.fn().mockResolvedValue(authSession),
    refreshSession: jest.fn().mockResolvedValue(authSession),
    revokeAllSessionsForUser: jest.fn().mockResolvedValue(undefined),
    revokeRefreshToken: jest.fn().mockResolvedValue(true),
  },
}: {
  loginProvider: IdentityProvider;
  registrationProvider?: IdentityProvider;
  sessionService?: Pick<
    IdentitySessionService,
    | 'createSession'
    | 'refreshSession'
    | 'revokeAllSessionsForUser'
    | 'revokeRefreshToken'
  >;
}) {
  const providerRegistry = {
    getLoginProvider: jest.fn().mockReturnValue(loginProvider),
    getRegistrationProvider: jest.fn().mockReturnValue(registrationProvider),
  };
  const identityService = new IdentityService(
    providerRegistry as never,
    sessionService as IdentitySessionService,
  );

  return {
    identityService,
    providerRegistry,
    sessionService,
  };
}

describe('IdentityService', () => {
  it('selects the login provider and creates a session for the returned identity', async () => {
    const login = jest.fn().mockResolvedValue(providerIdentity);
    const loginProvider: IdentityProvider = {
      capabilities: [IdentityProviderCapability.Login],
      id: 'local',
      login,
    };
    const { identityService, providerRegistry, sessionService } =
      createIdentityService({ loginProvider });

    await expect(
      identityService.login({
        email: 'ada@example.com',
        password: 'correct-password',
        provider: 'local',
      }),
    ).resolves.toEqual(authSession);

    expect(providerRegistry.getLoginProvider).toHaveBeenCalledWith('local');
    expect(login).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'correct-password',
    });
    expect(sessionService.createSession).toHaveBeenCalledWith(providerIdentity);
  });

  it('selects the registration provider and creates a session for the registered identity', async () => {
    const register = jest.fn().mockResolvedValue(providerIdentity);
    const registrationProvider: IdentityProvider = {
      capabilities: [IdentityProviderCapability.Registration],
      id: 'local',
      register,
    };
    const { identityService, providerRegistry, sessionService } =
      createIdentityService({
        loginProvider: registrationProvider,
        registrationProvider,
      });

    await expect(
      identityService.register({
        displayName: 'Ada',
        email: 'ada@example.com',
        password: 'correct-password',
        provider: 'local',
      }),
    ).resolves.toEqual(authSession);

    expect(providerRegistry.getRegistrationProvider).toHaveBeenCalledWith(
      'local',
    );
    expect(register).toHaveBeenCalledWith({
      displayName: 'Ada',
      email: 'ada@example.com',
      password: 'correct-password',
    });
    expect(sessionService.createSession).toHaveBeenCalledWith(providerIdentity);
  });

  it('rejects login providers without a login implementation', async () => {
    const loginProvider: IdentityProvider = {
      capabilities: [IdentityProviderCapability.Login],
      id: 'external',
    };
    const { identityService, sessionService } = createIdentityService({
      loginProvider,
    });

    await expect(
      identityService.login({
        email: 'ada@example.com',
        password: 'correct-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('rejects registration providers without a register implementation', async () => {
    const registrationProvider: IdentityProvider = {
      capabilities: [IdentityProviderCapability.Registration],
      id: 'external',
    };
    const { identityService, sessionService } = createIdentityService({
      loginProvider: registrationProvider,
      registrationProvider,
    });

    await expect(
      identityService.register({
        email: 'ada@example.com',
        password: 'correct-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('delegates refresh and revocation operations to the session service', async () => {
    const loginProvider: IdentityProvider = {
      capabilities: [IdentityProviderCapability.Login],
      id: 'local',
      login: jest.fn().mockResolvedValue(providerIdentity),
    };
    const { identityService, sessionService } = createIdentityService({
      loginProvider,
    });

    await expect(identityService.refresh('refresh-token')).resolves.toEqual(
      authSession,
    );
    await expect(
      identityService.revokeRefreshToken('refresh-token'),
    ).resolves.toBe(true);
    await expect(
      identityService.revokeAllForPrincipal(authSession.principal),
    ).resolves.toBeUndefined();

    expect(sessionService.refreshSession).toHaveBeenCalledWith('refresh-token');
    expect(sessionService.revokeRefreshToken).toHaveBeenCalledWith(
      'refresh-token',
    );
    expect(sessionService.revokeAllSessionsForUser).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
