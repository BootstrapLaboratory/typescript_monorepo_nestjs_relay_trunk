import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthResolver } from './auth.resolver';
import { IdentityAccountEntity } from './entities/identity-account.entity';
import { IdentityRefreshSessionEntity } from './entities/identity-refresh-session.entity';
import { IdentityUserRoleEntity } from './entities/identity-user-role.entity';
import { IdentityUserEntity } from './entities/identity-user.entity';
import { IDENTITY_PROVIDERS } from './identity.types';
import { IdentityConfigService } from './identity-config.service';
import { IdentityProviderRegistry } from './identity-provider-registry.service';
import { IdentityService } from './identity.service';
import { LocalIdentityProvider } from './local-identity.provider';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshTokenTransportService } from './refresh-token-transport.service';
import { IdentitySessionService } from './session.service';
import { AccessTokenService } from './token.service';

export const IDENTITY_GRAPHQL_RESOLVERS = [AuthResolver] as const;

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IdentityAccountEntity,
      IdentityRefreshSessionEntity,
      IdentityUserEntity,
      IdentityUserRoleEntity,
    ]),
  ],
  providers: [
    ...IDENTITY_GRAPHQL_RESOLVERS,
    AccessTokenService,
    IdentityConfigService,
    IdentityProviderRegistry,
    IdentityService,
    IdentitySessionService,
    LocalIdentityProvider,
    PasswordService,
    RefreshTokenService,
    RefreshTokenTransportService,
    {
      provide: IDENTITY_PROVIDERS,
      useFactory: (localProvider: LocalIdentityProvider) => {
        return [localProvider];
      },
      inject: [LocalIdentityProvider],
    },
  ],
  exports: [AccessTokenService, IdentityConfigService, IdentityService],
})
export class IdentityModule {}
