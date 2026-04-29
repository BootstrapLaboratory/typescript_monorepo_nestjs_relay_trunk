import { UnauthorizedException } from '@nestjs/common';
import { IdentityConfigService } from './identity-config.service';
import { Principal } from './identity.types';
import { AccessTokenService } from './token.service';

function createAccessTokenService(): AccessTokenService {
  return new AccessTokenService({
    getAccessTokenSecret: () =>
      'test-only-access-token-secret-at-least-32-chars',
    getAccessTokenTtlSeconds: () => 60,
  } as unknown as IdentityConfigService);
}

describe('AccessTokenService', () => {
  it('issues and verifies normalized principals', async () => {
    const service = createAccessTokenService();
    const principal: Principal = {
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

  it('rejects invalid access tokens', async () => {
    const service = createAccessTokenService();

    await expect(service.verifyAccessToken('not-a-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
