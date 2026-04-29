import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { IsNull, Repository } from 'typeorm';
import { IdentityConfigService } from './identity-config.service';
import { IdentityRefreshSessionEntity } from './entities/identity-refresh-session.entity';
import { IdentityUserRoleEntity } from './entities/identity-user-role.entity';
import {
  AuthSessionResult,
  Principal,
  ProviderIdentity,
} from './identity.types';
import { RefreshTokenService } from './refresh-token.service';
import { AccessTokenService } from './token.service';

@Injectable()
export class IdentitySessionService {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly identityConfig: IdentityConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    @InjectRepository(IdentityRefreshSessionEntity)
    private readonly refreshSessionRepo: Repository<IdentityRefreshSessionEntity>,
    @InjectRepository(IdentityUserRoleEntity)
    private readonly roleRepo: Repository<IdentityUserRoleEntity>,
  ) {}

  async createSession(identity: ProviderIdentity): Promise<AuthSessionResult> {
    const refreshToken = this.refreshTokenService.generateRefreshToken();
    const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();
    const sessionId = randomUUID();
    const principal: Principal = {
      permissions: identity.permissions,
      provider: identity.provider,
      roles: identity.roles,
      sessionId,
      subject: identity.subject,
      userId: identity.userId,
    };
    const accessTokenExpiresAt =
      this.accessTokenService.getAccessTokenExpiresAt();

    await this.refreshSessionRepo.save(
      this.refreshSessionRepo.create({
        expiresAt: refreshTokenExpiresAt,
        id: sessionId,
        provider: identity.provider,
        providerSubject: identity.subject,
        tokenHash: this.refreshTokenService.hashRefreshToken(refreshToken),
        userId: Number(identity.userId),
      }),
    );

    return {
      accessToken: await this.accessTokenService.issueAccessToken(
        principal,
        sessionId,
        accessTokenExpiresAt,
      ),
      accessTokenExpiresAt,
      principal,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionResult> {
    const tokenHash = this.refreshTokenService.hashRefreshToken(refreshToken);
    const session = await this.refreshSessionRepo.findOneBy({ tokenHash });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      await this.revokeAllSessionsForUser(session.userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      session.revokedAt = new Date();
      await this.refreshSessionRepo.save(session);
      throw new UnauthorizedException('Refresh token has expired');
    }

    const roles = await this.getRoles(session.userId);
    const result = await this.createSession({
      permissions: [],
      provider: session.provider,
      roles,
      subject: session.providerSubject,
      userId: String(session.userId),
    });

    session.revokedAt = new Date();
    session.lastUsedAt = session.revokedAt;
    session.replacedBySessionId = result.principal.sessionId;
    await this.refreshSessionRepo.save(session);

    return result;
  }

  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    const tokenHash = this.refreshTokenService.hashRefreshToken(refreshToken);
    const session = await this.refreshSessionRepo.findOneBy({ tokenHash });
    if (!session || session.revokedAt) {
      return false;
    }

    session.revokedAt = new Date();
    await this.refreshSessionRepo.save(session);
    return true;
  }

  async revokeAllSessionsForUser(userId: number): Promise<void> {
    await this.refreshSessionRepo.update(
      {
        revokedAt: IsNull(),
        userId,
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  private async getRoles(userId: number): Promise<string[]> {
    const roles = await this.roleRepo.findBy({ userId });
    return roles.map((role) => role.role);
  }

  private getRefreshTokenExpiresAt(): Date {
    return new Date(
      Date.now() + this.identityConfig.getRefreshTokenTtlSeconds() * 1000,
    );
  }
}
