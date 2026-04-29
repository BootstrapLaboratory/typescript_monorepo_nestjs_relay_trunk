import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IdentityGraphqlContext } from '../../identity/graphql/identity-graphql.context';
import { AccessTokenService } from '../../identity/token.service';
import { IS_PUBLIC_KEY } from '../access-control.constants';
import { extractBearerToken } from '../bearer-token';

@Injectable()
export class GraphqlAuthenticationGuard implements CanActivate {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const gqlContext =
      GqlExecutionContext.create(context).getContext<IdentityGraphqlContext>();
    if (gqlContext.principal) {
      return true;
    }

    const bearerToken = extractBearerToken(
      gqlContext.req?.headers?.authorization,
    );
    if (!bearerToken) {
      throw new UnauthorizedException('Authentication is required');
    }

    gqlContext.principal =
      await this.accessTokenService.verifyAccessToken(bearerToken);
    return true;
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
