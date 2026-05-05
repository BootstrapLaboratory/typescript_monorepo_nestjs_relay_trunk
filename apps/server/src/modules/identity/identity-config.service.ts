import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  readConfigBoolean,
  readConfigList,
  readConfigNumber,
  readConfigString,
  readCookieSameSite,
  readRefreshTokenTransport,
  readRequiredConfigString,
  type CookieSameSite,
  type RefreshTokenTransport,
} from '@omgjs/labkit-server-config';

@Injectable()
export class IdentityConfigService {
  constructor(private readonly configService: ConfigService) {}

  getEnabledProviders(): string[] {
    const providers = readConfigList(this.configService, 'AUTH_PROVIDERS');
    return providers.length > 0 ? providers : ['local'];
  }

  getDefaultLoginProvider(): string {
    return readConfigString(
      this.configService,
      'AUTH_DEFAULT_LOGIN_PROVIDER',
      this.getEnabledProviders()[0] || 'local',
    );
  }

  getRegistrationProvider(): string {
    return readConfigString(
      this.configService,
      'AUTH_REGISTRATION_PROVIDER',
      'local',
    );
  }

  getAccessTokenSecret(): string {
    return readRequiredConfigString(
      this.configService,
      'AUTH_ACCESS_TOKEN_SECRET',
      {
        message:
          'AUTH_ACCESS_TOKEN_SECRET must be configured with at least 32 characters',
        minLength: 32,
      },
    );
  }

  getAccessTokenTtlSeconds(): number {
    return readConfigNumber(
      this.configService,
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      15 * 60,
    );
  }

  getRefreshTokenTtlSeconds(): number {
    return readConfigNumber(
      this.configService,
      'AUTH_REFRESH_TOKEN_TTL_SECONDS',
      14 * 24 * 60 * 60,
    );
  }

  getRefreshTokenTransport(): RefreshTokenTransport {
    return readRefreshTokenTransport(this.configService);
  }

  getRefreshCookieName(): string {
    return readConfigString(
      this.configService,
      'AUTH_REFRESH_COOKIE_NAME',
      'refresh_token',
    );
  }

  getRefreshCookiePath(): string {
    return readConfigString(
      this.configService,
      'AUTH_REFRESH_COOKIE_PATH',
      '/graphql',
    );
  }

  getRefreshCookieSameSite(): CookieSameSite {
    return readCookieSameSite(
      this.configService,
      'AUTH_REFRESH_COOKIE_SAME_SITE',
    );
  }

  isRefreshCookieSecure(): boolean {
    return readConfigBoolean(
      this.configService,
      'AUTH_REFRESH_COOKIE_SECURE',
      process.env.NODE_ENV === 'production',
    );
  }

  getDefaultRole(): string {
    return readConfigString(
      this.configService,
      'AUTH_LOCAL_DEFAULT_ROLE',
      'user',
    );
  }
}
