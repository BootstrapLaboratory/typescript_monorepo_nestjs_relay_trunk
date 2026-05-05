import { UnauthorizedException } from '@nestjs/common';
import { decode, sign, type JwtPayload } from 'jsonwebtoken';
import { IdentityConfigService } from './identity-config.service';
import { Principal } from './identity.types';
import { AccessTokenService } from './token.service';

const ACCESS_TOKEN_SECRET = 'test-only-access-token-secret-at-least-32-chars';

function createAccessTokenService(): AccessTokenService {
  return new AccessTokenService({
    getAccessTokenSecret: () => ACCESS_TOKEN_SECRET,
    getAccessTokenTtlSeconds: () => 60,
  } as unknown as IdentityConfigService);
}

function decodeTokenPayload(token: string): JwtPayload {
  const payload = decode(token);
  if (!payload || typeof payload === 'string') {
    throw new Error('Expected a JWT object payload');
  }

  return payload;
}

describe('AccessTokenService', () => {
  it('issues and verifies normalized principals', async () => {
    const service = createAccessTokenService();
    const principal: Principal = {
      displayName: 'Test User',
      permissions: ['message:read'],
      provider: 'local',
      roles: ['user'],
      subject: 'user@example.com',
      userId: '1',
    };

    const token = await service.issueAccessToken(
      principal,
      'session-id',
      service.getAccessTokenExpiresAt(),
    );

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      ...principal,
      sessionId: 'session-id',
    });
  });

  it('issues JWTs with expected auth claims and explicit expiry', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-04T10:00:00.000Z'));

    try {
      const service = createAccessTokenService();
      const principal: Principal = {
        displayName: 'Test User',
        permissions: ['message:read', 'message:write'],
        provider: 'local',
        roles: ['user', 'moderator'],
        subject: 'user@example.com',
        userId: '1',
      };

      const token = await service.issueAccessToken(
        principal,
        'session-id',
        new Date('2026-05-04T10:01:30.000Z'),
      );
      const payload = decodeTokenPayload(token);

      expect(payload).toEqual(
        expect.objectContaining({
          displayName: 'Test User',
          exp: 1777888890,
          iat: 1777888800,
          permissions: ['message:read', 'message:write'],
          provider: 'local',
          providerSubject: 'user@example.com',
          roles: ['user', 'moderator'],
          sessionId: 'session-id',
          sub: '1',
        }),
      );
      expect(typeof payload.jti).toBe('string');
      expect(payload.jti).toHaveLength(36);
    } finally {
      jest.useRealTimers();
    }
  });

  it('omits null display names from JWT claims', async () => {
    const service = createAccessTokenService();
    const principal: Principal = {
      displayName: null,
      permissions: [],
      provider: 'local',
      roles: ['user'],
      subject: 'user@example.com',
      userId: '1',
    };

    const token = await service.issueAccessToken(
      principal,
      'session-id',
      service.getAccessTokenExpiresAt(),
    );
    const payload = decodeTokenPayload(token);

    expect(payload).not.toHaveProperty('displayName');
    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      permissions: [],
      provider: 'local',
      roles: ['user'],
      sessionId: 'session-id',
      subject: 'user@example.com',
      userId: '1',
    });
  });

  it('rejects signed tokens with invalid auth claim shapes', async () => {
    const service = createAccessTokenService();
    const token = sign(
      {
        permissions: ['message:read'],
        provider: 'local',
        providerSubject: 'user@example.com',
        roles: 'user',
        sessionId: 'session-id',
      },
      ACCESS_TOKEN_SECRET,
      {
        algorithm: 'HS256',
        expiresIn: 60,
        subject: '1',
      },
    );

    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects invalid access tokens', async () => {
    const service = createAccessTokenService();

    await expect(service.verifyAccessToken('not-a-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
