import {
  hashServerAuthRefreshToken,
  type ProviderIdentity,
  type ServerAuthRefreshSessionRepository,
  type ServerAuthRoleRepository,
} from '@omgjs/labkit-server-auth';
import { IdentityConfigService } from './identity-config.service';
import { IdentitySessionService } from './session.service';
import { AccessTokenService } from './token.service';

const NOW = new Date('2026-05-04T12:00:00.000Z');
const ACCESS_TOKEN_EXPIRES_AT = new Date('2026-05-04T12:15:00.000Z');
const REFRESH_TOKEN_EXPIRES_AT = new Date('2026-05-04T12:02:00.000Z');

const providerIdentity: ProviderIdentity = {
  displayName: 'Ada Lovelace',
  permissions: ['chat:write'],
  provider: 'local',
  roles: ['user'],
  subject: 'ada@example.test',
  userId: 'user-1',
};

function createIdentitySessionService({
  accessTokenService = {
    getAccessTokenExpiresAt: jest.fn().mockReturnValue(ACCESS_TOKEN_EXPIRES_AT),
    issueAccessToken: jest.fn(async (_principal, sessionId) => {
      return `access:${sessionId}`;
    }),
  },
  identityConfig = {
    getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(120),
  },
  refreshSessionRepository = {
    createRefreshSession: jest.fn(async (input) => ({
      ...input,
      revokedAt: null,
    })),
    findRefreshSessionByTokenHash: jest.fn().mockResolvedValue(null),
    revokeActiveRefreshSessionsForUser: jest.fn().mockResolvedValue(undefined),
    revokeRefreshSession: jest.fn().mockResolvedValue(false),
    rotateRefreshSession: jest.fn().mockResolvedValue(undefined),
  },
  roleRepository = {
    findRolesByUserId: jest.fn().mockResolvedValue(['user']),
  },
}: {
  accessTokenService?: Pick<
    AccessTokenService,
    'getAccessTokenExpiresAt' | 'issueAccessToken'
  >;
  identityConfig?: Pick<IdentityConfigService, 'getRefreshTokenTtlSeconds'>;
  refreshSessionRepository?: jest.Mocked<ServerAuthRefreshSessionRepository>;
  roleRepository?: jest.Mocked<ServerAuthRoleRepository>;
} = {}) {
  const service = new IdentitySessionService(
    accessTokenService as AccessTokenService,
    identityConfig as IdentityConfigService,
    refreshSessionRepository,
    roleRepository,
  );

  return {
    accessTokenService,
    identityConfig,
    refreshSessionRepository,
    roleRepository,
    service,
  };
}

describe('IdentitySessionService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates refresh sessions through Labkit repository contracts', async () => {
    const createRefreshSession = jest.fn(async (input) => ({
      ...input,
      revokedAt: null,
    }));
    const refreshSessionRepository = {
      createRefreshSession,
      findRefreshSessionByTokenHash: jest.fn().mockResolvedValue(null),
      revokeActiveRefreshSessionsForUser: jest
        .fn()
        .mockResolvedValue(undefined),
      revokeRefreshSession: jest.fn().mockResolvedValue(false),
      rotateRefreshSession: jest.fn().mockResolvedValue(undefined),
    } satisfies jest.Mocked<ServerAuthRefreshSessionRepository>;
    const { accessTokenService, identityConfig, service } =
      createIdentitySessionService({ refreshSessionRepository });

    const result = await service.createSession(providerIdentity);

    expect(identityConfig.getRefreshTokenTtlSeconds).toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: `access:${result.principal.sessionId}`,
      accessTokenExpiresAt: ACCESS_TOKEN_EXPIRES_AT,
      principal: {
        ...providerIdentity,
        sessionId: result.principal.sessionId,
      },
      refreshToken: result.refreshToken,
      refreshTokenExpiresAt: REFRESH_TOKEN_EXPIRES_AT,
    });
    expect(createRefreshSession).toHaveBeenCalledWith({
      expiresAt: REFRESH_TOKEN_EXPIRES_AT,
      id: result.principal.sessionId,
      provider: 'local',
      providerSubject: 'ada@example.test',
      tokenHash: hashServerAuthRefreshToken(result.refreshToken),
      userId: 'user-1',
    });
    expect(accessTokenService.issueAccessToken).toHaveBeenCalledWith(
      result.principal,
      result.principal.sessionId,
      ACCESS_TOKEN_EXPIRES_AT,
    );
  });

  it('refreshes sessions by creating a new session and rotating the old one', async () => {
    const findRolesByUserId = jest.fn().mockResolvedValue(['user']);
    const refreshSessionRepository = {
      createRefreshSession: jest.fn(async (input) => ({
        ...input,
        revokedAt: null,
      })),
      findRefreshSessionByTokenHash: jest.fn().mockResolvedValue({
        expiresAt: new Date('2026-05-04T12:30:00.000Z'),
        id: 'old-session',
        provider: 'local',
        providerSubject: 'ada@example.test',
        revokedAt: null,
        tokenHash: hashServerAuthRefreshToken('old-refresh-token'),
        user: {
          displayName: 'Ada Lovelace',
          email: 'ada@example.test',
          isActive: true,
          userId: 'user-1',
        },
        userId: 'user-1',
      }),
      revokeActiveRefreshSessionsForUser: jest
        .fn()
        .mockResolvedValue(undefined),
      revokeRefreshSession: jest.fn().mockResolvedValue(false),
      rotateRefreshSession: jest.fn().mockResolvedValue(undefined),
    } satisfies jest.Mocked<ServerAuthRefreshSessionRepository>;
    const roleRepository = {
      findRolesByUserId,
    } satisfies jest.Mocked<ServerAuthRoleRepository>;
    const { accessTokenService, service } = createIdentitySessionService({
      refreshSessionRepository,
      roleRepository,
    });

    const result = await service.refreshSession('old-refresh-token');

    expect(
      refreshSessionRepository.findRefreshSessionByTokenHash,
    ).toHaveBeenCalledWith(hashServerAuthRefreshToken('old-refresh-token'));
    expect(findRolesByUserId).toHaveBeenCalledWith('user-1');
    expect(refreshSessionRepository.createRefreshSession).toHaveBeenCalledWith({
      expiresAt: REFRESH_TOKEN_EXPIRES_AT,
      id: result.principal.sessionId,
      provider: 'local',
      providerSubject: 'ada@example.test',
      tokenHash: hashServerAuthRefreshToken(result.refreshToken),
      userId: 'user-1',
    });
    expect(refreshSessionRepository.rotateRefreshSession).toHaveBeenCalledWith({
      lastUsedAt: NOW,
      replacedBySessionId: result.principal.sessionId,
      revokedAt: NOW,
      sessionId: 'old-session',
    });
    expect(accessTokenService.issueAccessToken).toHaveBeenCalledWith(
      result.principal,
      result.principal.sessionId,
      ACCESS_TOKEN_EXPIRES_AT,
    );
    expect(result.principal).toEqual({
      displayName: 'Ada Lovelace',
      permissions: [],
      provider: 'local',
      roles: ['user'],
      sessionId: result.principal.sessionId,
      subject: 'ada@example.test',
      userId: 'user-1',
    });
    expect(result.refreshTokenExpiresAt).toEqual(REFRESH_TOKEN_EXPIRES_AT);
  });

  it('revokes individual refresh tokens and all active user sessions', async () => {
    const refreshSessionRepository = {
      createRefreshSession: jest.fn(async (input) => ({
        ...input,
        revokedAt: null,
      })),
      findRefreshSessionByTokenHash: jest.fn().mockResolvedValue(null),
      revokeActiveRefreshSessionsForUser: jest
        .fn()
        .mockResolvedValue(undefined),
      revokeRefreshSession: jest.fn().mockResolvedValue(true),
      rotateRefreshSession: jest.fn().mockResolvedValue(undefined),
    } satisfies jest.Mocked<ServerAuthRefreshSessionRepository>;
    const { service } = createIdentitySessionService({
      refreshSessionRepository,
    });

    await expect(service.revokeRefreshToken('refresh-token')).resolves.toBe(
      true,
    );
    await expect(
      service.revokeAllSessionsForUser('user-1'),
    ).resolves.toBeUndefined();

    expect(refreshSessionRepository.revokeRefreshSession).toHaveBeenCalledWith({
      revokedAt: NOW,
      tokenHash: hashServerAuthRefreshToken('refresh-token'),
    });
    expect(
      refreshSessionRepository.revokeActiveRefreshSessionsForUser,
    ).toHaveBeenCalledWith({
      revokedAt: NOW,
      userId: 'user-1',
    });
  });
});
