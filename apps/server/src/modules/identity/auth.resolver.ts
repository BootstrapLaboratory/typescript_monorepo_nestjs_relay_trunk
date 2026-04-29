import { UnauthorizedException } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { AuthPayload } from './dto/auth-payload.model';
import { LoginInput } from './dto/login.input';
import { RefreshInput } from './dto/refresh.input';
import { RegisterInput } from './dto/register.input';
import { IdentityGraphqlContext } from './graphql/identity-graphql.context';
import { IdentityService } from './identity.service';
import { AuthSessionResult, Principal } from './identity.types';
import { RefreshTokenTransportService } from './refresh-token-transport.service';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly identityService: IdentityService,
    private readonly refreshTokenTransport: RefreshTokenTransportService,
  ) {}

  @Mutation(() => AuthPayload)
  async login(
    @Args('input') input: LoginInput,
    @Context() context: IdentityGraphqlContext,
  ): Promise<AuthPayload> {
    return this.toAuthPayload(context, await this.identityService.login(input));
  }

  @Mutation(() => AuthPayload)
  async register(
    @Args('input') input: RegisterInput,
    @Context() context: IdentityGraphqlContext,
  ): Promise<AuthPayload> {
    return this.toAuthPayload(
      context,
      await this.identityService.register(input),
    );
  }

  @Mutation(() => AuthPayload)
  async refresh(
    @Args('input', { nullable: true, type: () => RefreshInput })
    input: RefreshInput | undefined,
    @Context() context: IdentityGraphqlContext,
  ): Promise<AuthPayload> {
    const refreshToken = this.refreshTokenTransport.extractRefreshToken(
      context,
      input?.refreshToken,
    );
    return this.toAuthPayload(
      context,
      await this.identityService.refresh(refreshToken),
    );
  }

  @Mutation(() => Boolean)
  async logout(
    @Args('input', { nullable: true, type: () => RefreshInput })
    input: RefreshInput | undefined,
    @Context() context: IdentityGraphqlContext,
  ): Promise<boolean> {
    const refreshToken = this.refreshTokenTransport.extractRefreshToken(
      context,
      input?.refreshToken,
    );
    const revoked = await this.identityService.revokeRefreshToken(refreshToken);
    this.refreshTokenTransport.clearRefreshToken(context);
    return revoked;
  }

  @Mutation(() => Boolean)
  async logoutAll(
    @Context() context: IdentityGraphqlContext,
  ): Promise<boolean> {
    const principal = context.principal;
    if (!principal) {
      throw new UnauthorizedException('Authentication is required');
    }

    await this.identityService.revokeAllForPrincipal(principal);
    this.refreshTokenTransport.clearRefreshToken(context);
    return true;
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
        result,
      ),
      refreshTokenExpiresAt: result.refreshTokenExpiresAt.toISOString(),
    };
  }

  private toPrincipalModel(principal: Principal) {
    return {
      displayName: principal.displayName,
      permissions: principal.permissions,
      provider: principal.provider,
      roles: principal.roles,
      subject: principal.subject,
      userId: principal.userId,
    };
  }
}
