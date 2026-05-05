import { Injectable, UnauthorizedException } from '@nestjs/common';
import { sign, verify } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import {
  createServerAuthAccessTokenClaims,
  createServerAuthPrincipalFromAccessTokenPayload,
  getServerAuthAccessTokenExpiresAt,
  getServerAuthAccessTokenExpiresInSeconds,
} from '@omgjs/labkit-server-auth';
import { IdentityConfigService } from './identity-config.service';
import { Principal } from './identity.types';

@Injectable()
export class AccessTokenService {
  constructor(private readonly identityConfig: IdentityConfigService) {}

  getAccessTokenExpiresAt(now = new Date()): Date {
    return getServerAuthAccessTokenExpiresAt(
      this.identityConfig.getAccessTokenTtlSeconds(),
      now,
    );
  }

  async issueAccessToken(
    principal: Principal,
    sessionId: string,
    expiresAt: Date,
  ): Promise<string> {
    const expiresInSeconds =
      getServerAuthAccessTokenExpiresInSeconds(expiresAt);

    return sign(
      createServerAuthAccessTokenClaims(principal, sessionId),
      this.identityConfig.getAccessTokenSecret(),
      {
        algorithm: 'HS256',
        expiresIn: expiresInSeconds,
        jwtid: randomUUID(),
        subject: principal.userId,
      },
    );
  }

  async verifyAccessToken(accessToken: string): Promise<Principal> {
    try {
      const payload = verify(
        accessToken,
        this.identityConfig.getAccessTokenSecret(),
        {
          algorithms: ['HS256'],
        },
      );

      if (typeof payload === 'string') {
        throw new UnauthorizedException('Invalid access token claims');
      }

      const principal =
        createServerAuthPrincipalFromAccessTokenPayload(payload);
      if (!principal) {
        throw new UnauthorizedException('Invalid access token claims');
      }

      return principal;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }
}
