import { Module } from '@nestjs/common';
import { ServerAuthTypeormModule } from '@omgjs/labkit-server-auth-typeorm';
import {
  IDENTITY_PROVIDERS,
  IdentityProviderRegistry,
  ServerAuthLocalIdentityProvider,
  createIdentityProviderRegistryConfigProvider,
  createServerAuthLocalIdentityProviderProvider,
  createServerAuthRefreshTokenTransportProvider,
} from '@omgjs/labkit-server-auth';
import { AuthLifecycleService } from './auth-lifecycle.service';
import { AuthResolver } from './auth.resolver';
import { IdentityConfigService } from './identity-config.service';
import { IdentityService } from './identity.service';
import { PasswordService } from './password.service';
import { IdentitySessionService } from './session.service';
import { AccessTokenService } from './token.service';

export const IDENTITY_GRAPHQL_RESOLVERS = [AuthResolver] as const;

@Module({
  imports: [ServerAuthTypeormModule],
  providers: [
    ...IDENTITY_GRAPHQL_RESOLVERS,
    AccessTokenService,
    AuthLifecycleService,
    IdentityConfigService,
    createIdentityProviderRegistryConfigProvider(IdentityConfigService),
    createServerAuthLocalIdentityProviderProvider({
      configReaderToken: IdentityConfigService,
      passwordHasherToken: PasswordService,
    }),
    createServerAuthRefreshTokenTransportProvider({
      configReaderToken: IdentityConfigService,
    }),
    IdentityProviderRegistry,
    IdentityService,
    IdentitySessionService,
    PasswordService,
    {
      provide: IDENTITY_PROVIDERS,
      useFactory: (localProvider: ServerAuthLocalIdentityProvider) => {
        return [localProvider];
      },
      inject: [ServerAuthLocalIdentityProvider],
    },
  ],
  exports: [
    AccessTokenService,
    AuthLifecycleService,
    IdentityConfigService,
    IdentityService,
  ],
})
export class IdentityModule {}
