import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseBoolean, parseList, parseNumber } from '../../config/env.utils';

export type RefreshTokenTransport = 'cookie' | 'response_body';
export type CookieSameSite = 'strict' | 'lax' | 'none';

@Injectable()
export class IdentityConfigService {
  constructor(private readonly configService: ConfigService) {}

  getEnabledProviders(): string[] {
    const providers = parseList(
      this.configService.get<string>('AUTH_PROVIDERS'),
    );
    return providers.length > 0 ? providers : ['local'];
  }

  getDefaultLoginProvider(): string {
    return (
      this.configService.get<string>('AUTH_DEFAULT_LOGIN_PROVIDER')?.trim() ||
      this.getEnabledProviders()[0] ||
      'local'
    );
  }

  getRegistrationProvider(): string {
    return (
      this.configService.get<string>('AUTH_REGISTRATION_PROVIDER')?.trim() ||
      'local'
    );
  }

  getAccessTokenSecret(): string {
    const secret = this.configService.get<string>('AUTH_ACCESS_TOKEN_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error(
        'AUTH_ACCESS_TOKEN_SECRET must be configured with at least 32 characters',
      );
    }

    return secret;
  }

  getAccessTokenTtlSeconds(): number {
    return parseNumber(
      this.configService.get<string>('AUTH_ACCESS_TOKEN_TTL_SECONDS'),
      15 * 60,
    );
  }

  getRefreshTokenTtlSeconds(): number {
    return parseNumber(
      this.configService.get<string>('AUTH_REFRESH_TOKEN_TTL_SECONDS'),
      14 * 24 * 60 * 60,
    );
  }

  getRefreshTokenTransport(): RefreshTokenTransport {
    const configuredTransport = this.configService
      .get<string>('AUTH_REFRESH_TOKEN_TRANSPORT')
      ?.trim()
      .toLowerCase();

    return configuredTransport === 'response_body' ? 'response_body' : 'cookie';
  }

  getRefreshCookieName(): string {
    return (
      this.configService.get<string>('AUTH_REFRESH_COOKIE_NAME')?.trim() ||
      'refresh_token'
    );
  }

  getRefreshCookiePath(): string {
    return (
      this.configService.get<string>('AUTH_REFRESH_COOKIE_PATH')?.trim() ||
      '/graphql'
    );
  }

  getRefreshCookieSameSite(): CookieSameSite {
    const sameSite = this.configService
      .get<string>('AUTH_REFRESH_COOKIE_SAME_SITE')
      ?.trim()
      .toLowerCase();

    if (sameSite === 'strict' || sameSite === 'none') {
      return sameSite;
    }

    return 'lax';
  }

  isRefreshCookieSecure(): boolean {
    return parseBoolean(
      this.configService.get<string>('AUTH_REFRESH_COOKIE_SECURE'),
      process.env.NODE_ENV === 'production',
    );
  }

  getDefaultRole(): string {
    return (
      this.configService.get<string>('AUTH_LOCAL_DEFAULT_ROLE')?.trim() ||
      'user'
    );
  }
}
