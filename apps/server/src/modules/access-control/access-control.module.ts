import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { GraphqlAuthenticationGuard } from './guards/graphql-authentication.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [IdentityModule],
  providers: [GraphqlAuthenticationGuard, RolesGuard],
  exports: [GraphqlAuthenticationGuard, RolesGuard],
})
export class AccessControlModule {}
