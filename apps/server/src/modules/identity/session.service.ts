import { Inject, Injectable } from '@nestjs/common';
import {
  SERVER_AUTH_REFRESH_SESSION_REPOSITORY,
  SERVER_AUTH_ROLE_REPOSITORY,
  ServerAuthSessionOrchestrator,
  type ServerAuthRefreshSessionRepository,
  type ServerAuthRoleRepository,
} from '@omgjs/labkit-server-auth';
import { IdentityConfigService } from './identity-config.service';
import { AuthSessionResult, ProviderIdentity } from './identity.types';
import { AccessTokenService } from './token.service';

@Injectable()
export class IdentitySessionService {
  private readonly sessionOrchestrator: ServerAuthSessionOrchestrator;

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly identityConfig: IdentityConfigService,
    @Inject(SERVER_AUTH_REFRESH_SESSION_REPOSITORY)
    private readonly refreshSessionRepository: ServerAuthRefreshSessionRepository,
    @Inject(SERVER_AUTH_ROLE_REPOSITORY)
    private readonly roleRepository: ServerAuthRoleRepository,
  ) {
    this.sessionOrchestrator = new ServerAuthSessionOrchestrator({
      getAccessTokenExpiresAt: () =>
        this.accessTokenService.getAccessTokenExpiresAt(),
      getRefreshTokenTtlSeconds: () =>
        this.identityConfig.getRefreshTokenTtlSeconds(),
      issueAccessToken: ({ accessTokenExpiresAt, principal, sessionId }) =>
        this.accessTokenService.issueAccessToken(
          principal,
          sessionId,
          accessTokenExpiresAt,
        ),
      refreshSessionRepository: this.refreshSessionRepository,
      roleRepository: this.roleRepository,
    });
  }

  async createSession(identity: ProviderIdentity): Promise<AuthSessionResult> {
    return this.sessionOrchestrator.createSession(identity);
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionResult> {
    return this.sessionOrchestrator.refreshSession(refreshToken);
  }

  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    return this.sessionOrchestrator.revokeRefreshToken(refreshToken);
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.sessionOrchestrator.revokeAllSessionsForUser(userId);
  }
}
