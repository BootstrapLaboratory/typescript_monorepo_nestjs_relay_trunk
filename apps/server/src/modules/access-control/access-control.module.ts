import { Module, type Provider } from '@nestjs/common';
import {
  GraphqlAuthenticationGuard,
  RolesGuard,
  SERVER_AUTH_ACCESS_TOKEN_VERIFIER,
  type ServerAuthAccessTokenVerifier,
} from '@omgjs/labkit-server-auth';
import { IdentityModule } from '../identity/identity.module';
import { Principal } from '../identity/identity.types';
import { AccessTokenService } from '../identity/token.service';

const accessTokenVerifierProvider: Provider = {
  provide: SERVER_AUTH_ACCESS_TOKEN_VERIFIER,
  useFactory: (
    accessTokenService: AccessTokenService,
  ): ServerAuthAccessTokenVerifier<Principal> => {
    return (accessToken) => accessTokenService.verifyAccessToken(accessToken);
  },
  inject: [AccessTokenService],
};

@Module({
  imports: [IdentityModule],
  providers: [
    accessTokenVerifierProvider,
    GraphqlAuthenticationGuard,
    RolesGuard,
  ],
  exports: [GraphqlAuthenticationGuard, RolesGuard],
})
export class AccessControlModule {}
