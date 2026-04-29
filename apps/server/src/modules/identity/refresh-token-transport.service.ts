import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IdentityConfigService } from './identity-config.service';
import { AuthSessionResult } from './identity.types';
import { IdentityGraphqlContext } from './graphql/identity-graphql.context';

@Injectable()
export class RefreshTokenTransportService {
  constructor(private readonly identityConfig: IdentityConfigService) {}

  deliverRefreshToken(
    context: IdentityGraphqlContext,
    result: AuthSessionResult,
  ): string | undefined {
    if (this.identityConfig.getRefreshTokenTransport() === 'response_body') {
      return result.refreshToken;
    }

    const reply = context.reply;
    if (!reply?.setCookie) {
      throw new Error('Cookie refresh transport requires a response object');
    }

    reply.setCookie(
      this.identityConfig.getRefreshCookieName(),
      result.refreshToken,
      {
        httpOnly: true,
        maxAge: this.identityConfig.getRefreshTokenTtlSeconds(),
        path: this.identityConfig.getRefreshCookiePath(),
        sameSite: this.identityConfig.getRefreshCookieSameSite(),
        secure: this.identityConfig.isRefreshCookieSecure(),
      },
    );

    return undefined;
  }

  extractRefreshToken(
    context: IdentityGraphqlContext,
    explicitRefreshToken?: string,
  ): string {
    if (this.identityConfig.getRefreshTokenTransport() === 'response_body') {
      if (!explicitRefreshToken) {
        throw new UnauthorizedException('Refresh token is required');
      }

      return explicitRefreshToken;
    }

    const refreshToken =
      context.req?.cookies?.[this.identityConfig.getRefreshCookieName()];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token cookie is required');
    }

    return refreshToken;
  }

  clearRefreshToken(context: IdentityGraphqlContext): void {
    if (this.identityConfig.getRefreshTokenTransport() !== 'cookie') {
      return;
    }

    context.reply?.clearCookie?.(this.identityConfig.getRefreshCookieName(), {
      path: this.identityConfig.getRefreshCookiePath(),
      sameSite: this.identityConfig.getRefreshCookieSameSite(),
      secure: this.identityConfig.isRefreshCookieSecure(),
    });
  }
}
