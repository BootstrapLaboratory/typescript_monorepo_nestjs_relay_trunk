import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { IdentityConfigService } from './identity-config.service';
import { Principal } from './identity.types';

type AccessTokenClaims = {
  provider: string;
  providerSubject: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
};

@Injectable()
export class AccessTokenService {
  constructor(private readonly identityConfig: IdentityConfigService) {}

  getAccessTokenExpiresAt(now = new Date()): Date {
    return new Date(
      now.getTime() + this.identityConfig.getAccessTokenTtlSeconds() * 1000,
    );
  }

  async issueAccessToken(
    principal: Principal,
    sessionId: string,
    expiresAt: Date,
  ): Promise<string> {
    const expiresInSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );

    return sign(
      {
        permissions: principal.permissions,
        provider: principal.provider,
        providerSubject: principal.subject,
        roles: principal.roles,
        sessionId,
      } satisfies AccessTokenClaims,
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

      const jwtPayload = payload as JwtPayload & Partial<AccessTokenClaims>;
      const userId = jwtPayload.sub;
      const provider = jwtPayload.provider;
      const providerSubject = jwtPayload.providerSubject;
      const roles = jwtPayload.roles;
      const permissions = jwtPayload.permissions;
      const sessionId = jwtPayload.sessionId;

      if (
        typeof userId !== 'string' ||
        typeof provider !== 'string' ||
        typeof providerSubject !== 'string' ||
        !Array.isArray(roles) ||
        !Array.isArray(permissions) ||
        typeof sessionId !== 'string'
      ) {
        throw new UnauthorizedException('Invalid access token claims');
      }

      return {
        permissions: permissions.filter((value): value is string => {
          return typeof value === 'string';
        }),
        provider,
        roles: roles.filter((value): value is string => {
          return typeof value === 'string';
        }),
        sessionId,
        subject: providerSubject,
        userId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }
}
