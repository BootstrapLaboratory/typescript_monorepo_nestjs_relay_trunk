import { UnauthorizedException } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { ServerAuthRefreshTokenTransportService } from '@omgjs/labkit-server-auth';
import { AuthPayload } from './dto/auth-payload.model';
import { LoginInput } from './dto/login.input';
import { PrincipalModel } from './dto/principal.model';
import { RefreshInput } from './dto/refresh.input';
import { RegisterInput } from './dto/register.input';
import { IdentityGraphqlContext } from './graphql/identity-graphql.context';
import { AuthLifecycleService } from './auth-lifecycle.service';
import { IdentityService } from './identity.service';
import { AuthSessionResult, Principal } from './identity.types';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authLifecycle: AuthLifecycleService,
    private readonly identityService: IdentityService,
    private readonly refreshTokenTransport: ServerAuthRefreshTokenTransportService,
  ) {}

  @Mutation(() => AuthPayload)
  async login(
    @Args('input') input: LoginInput,
    @Context() context: IdentityGraphqlContext,
  ): Promise<AuthPayload> {
    try {
      const result = await this.identityService.login(input);
      const payload = this.toAuthPayload(context, result);
      await this.authLifecycle.loginSucceeded(result.principal);
      return payload;
    } catch (error) {
      await this.authLifecycle.loginFailed(error, input.provider);
      throw error;
    }
  }

  @Mutation(() => AuthPayload)
  async register(
    @Args('input') input: RegisterInput,
    @Context() context: IdentityGraphqlContext,
  ): Promise<AuthPayload> {
    try {
      const result = await this.identityService.register(input);
      const payload = this.toAuthPayload(context, result);
      await this.authLifecycle.registrationSucceeded(result.principal);
      return payload;
    } catch (error) {
      await this.authLifecycle.registrationFailed(error, input.provider);
      throw error;
    }
  }

  @Mutation(() => AuthPayload)
  async refresh(
    @Args('input', { nullable: true, type: () => RefreshInput })
    input: RefreshInput | undefined,
    @Context() context: IdentityGraphqlContext,
  ): Promise<AuthPayload> {
    try {
      const refreshToken = this.refreshTokenTransport.extractRefreshToken(
        context,
        input?.refreshToken,
      );
      const result = await this.identityService.refresh(refreshToken);
      const payload = this.toAuthPayload(context, result);
      await this.authLifecycle.refreshSucceeded(result.principal);
      return payload;
    } catch (error) {
      await this.authLifecycle.refreshFailed(error);
      throw error;
    }
  }

  @Mutation(() => Boolean)
  async logout(
    @Args('input', { nullable: true, type: () => RefreshInput })
    input: RefreshInput | undefined,
    @Context() context: IdentityGraphqlContext,
  ): Promise<boolean> {
    try {
      const refreshToken = this.refreshTokenTransport.extractRefreshToken(
        context,
        input?.refreshToken,
      );
      const revoked =
        await this.identityService.revokeRefreshToken(refreshToken);
      this.refreshTokenTransport.clearRefreshToken(context);
      await this.authLifecycle.logoutSucceeded(context.principal, revoked);
      return revoked;
    } catch (error) {
      await this.authLifecycle.logoutFailed(error, context.principal);
      throw error;
    }
  }

  @Mutation(() => Boolean)
  async logoutAll(
    @Context() context: IdentityGraphqlContext,
  ): Promise<boolean> {
    const principal = context.principal;
    try {
      if (!principal) {
        throw new UnauthorizedException('Authentication is required');
      }

      await this.identityService.revokeAllForPrincipal(principal);
      this.refreshTokenTransport.clearRefreshToken(context);
      await this.authLifecycle.sessionsRevoked(principal);
      return true;
    } catch (error) {
      await this.authLifecycle.sessionsRevokeFailed(error, principal);
      throw error;
    }
  }

  private toAuthPayload(
    context: IdentityGraphqlContext,
    result: AuthSessionResult,
  ): AuthPayload {
    return {
      accessToken: result.accessToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
      principal: this.toPrincipalModel(result.principal),
      refreshToken: this.refreshTokenTransport.deliverRefreshToken(
        context,
        result.refreshToken,
      ),
      refreshTokenExpiresAt: result.refreshTokenExpiresAt.toISOString(),
    };
  }

  private toPrincipalModel(principal: Principal): PrincipalModel {
    return {
      displayName: principal.displayName ?? undefined,
      permissions: [...principal.permissions],
      provider: principal.provider,
      roles: [...principal.roles],
      subject: principal.subject,
      userId: principal.userId,
    };
  }
}
